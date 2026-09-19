import { describe, expect, it, vi } from 'vitest';

import { createPostReviewHandler } from '../../app/api/cases/[caseId]/review/route';

function request(body: unknown) {
  return new Request('http://localhost/api/cases/DEMO-001/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ caseId: 'DEMO-001' }) };

describe('POST /api/cases/:caseId/review', () => {
  it('returns a visibly simulated review decision', async () => {
    const recordReview = vi.fn(async (input) => ({
      ...input,
      id: 'review-1',
      createdAt: '2026-09-19T01:00:00.000Z',
      simulation: true as const,
    }));
    const handler = createPostReviewHandler({ recordReview });
    const response = await handler(request({
      idempotencyKey: 'idem-001', action: 'confirm_refund', refundCents: 4900, note: 'Approved',
    }), context);
    const body = await response.json() as { simulation: boolean };

    expect(response.status).toBe(201);
    expect(body.simulation).toBe(true);
    expect(recordReview).toHaveBeenCalledWith(expect.objectContaining({ caseId: 'DEMO-001' }));
  });

  it('returns a stable 400 code for an invalid action', async () => {
    const handler = createPostReviewHandler({
      recordReview: async () => { throw new Error('INVALID_REVIEW_ACTION'); },
    });
    const response = await handler(request({
      idempotencyKey: 'idem-001', action: 'charge_card', refundCents: 0, note: '',
    }), context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: 'INVALID_REVIEW_ACTION' } });
  });
});
