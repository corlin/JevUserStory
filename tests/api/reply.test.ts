import { describe, expect, it, vi } from 'vitest';

import { createPostReplyHandler } from '../../app/api/cases/[caseId]/reply/route';
import type { ReviewDecisionRecord } from '../../src/db/run-repository';
import { getDemoCase } from '../../src/fixtures/cases';

const caseFixture = getDemoCase('DEMO-003')!;
const context = { params: Promise.resolve({ caseId: caseFixture.id }) };
const request = () => new Request(`http://localhost/api/cases/${caseFixture.id}/reply`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ reviewId: 'review-1' }),
});

describe('POST /api/cases/:caseId/reply', () => {
  it('rejects generation before an approved review exists', async () => {
    const generateApprovedReply = vi.fn();
    const handler = createPostReplyHandler({
      findCase: () => caseFixture,
      findReviewDecision: () => undefined,
      generateApprovedReply,
      verifyReply: vi.fn(),
      saveReplyRun: vi.fn(),
      createId: () => 'reply-1',
      now: () => new Date(0),
    });
    const response = await handler(request(), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: { code: 'REVIEW_REQUIRED' } });
    expect(generateApprovedReply).not.toHaveBeenCalled();
  });

  it('saves an over-promising GPT draft as review_required', async () => {
    const review: ReviewDecisionRecord = {
      id: 'review-1', caseId: caseFixture.id, idempotencyKey: 'idem-001', action: 'modify_refund',
      refundCents: 4900, note: 'Partial refund only', createdAt: '2026-09-19T01:00:00.000Z',
    };
    const saveReplyRun = vi.fn((record) => record);
    const handler = createPostReplyHandler({
      findCase: () => caseFixture,
      findReviewDecision: () => review,
      generateApprovedReply: async () => ({
        draft: 'We promise a full refund for your $89.00 order.',
        modelId: 'openai/gpt-5-nano',
        usage: {},
      }),
      verifyReply: async () => ({
        status: 'review_required',
        answers: {
          exceeds_approved_action: { probability: 0.98 },
          contradicts_refund_policy: { probability: 0.8 },
          exposes_internal_details: { probability: 0.02 },
        },
        reasonCodes: ['EXCEEDS_APPROVED_ACTION', 'CONTRADICTS_REFUND_POLICY'],
      }),
      saveReplyRun,
      createId: () => 'reply-1',
      now: () => new Date('2026-09-19T02:00:00.000Z'),
    });
    const response = await handler(request(), context);
    const body = await response.json() as { status: string; draft: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('review_required');
    expect(body.draft).toContain('full refund');
    expect(saveReplyRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'review_required' }));
  });
});
