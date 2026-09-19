import { describe, expect, it, vi } from 'vitest';

import type { ReviewDecisionRecord } from '../../src/db/run-repository';
import { getDemoCase } from '../../src/fixtures/cases';
import { generateApprovedReply } from '../../src/gateway/generate-reply';

const caseFixture = getDemoCase('DEMO-001')!;
const review: ReviewDecisionRecord = {
  id: 'review-1',
  caseId: caseFixture.id,
  idempotencyKey: 'idem-001',
  action: 'modify_refund',
  refundCents: 2400,
  note: 'Approved partial refund',
  createdAt: '2026-09-19T01:00:00.000Z',
};

describe('generateApprovedReply', () => {
  it('rejects generation before a review exists', async () => {
    const generateText = vi.fn();
    await expect(generateApprovedReply({ caseFixture, review: undefined }, { generateText }))
      .rejects.toThrowError('REVIEW_REQUIRED');
    expect(generateText).not.toHaveBeenCalled();
  });

  it('uses GPT-5 Nano with only approved, public reply facts', async () => {
    const generateText = vi.fn(async (_options: { model: 'openai/gpt-5-nano'; prompt: string }) => ({
      text: 'We approved a $24.00 partial refund.',
      response: { modelId: 'openai/gpt-5-nano' },
      usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
    }));
    const result = await generateApprovedReply({ caseFixture, review }, { generateText });

    expect(result.draft).toContain('$24.00');
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ model: 'openai/gpt-5-nano' }));
    const prompt = generateText.mock.calls[0]![0].prompt as string;
    expect(prompt).toContain('modify_refund');
    expect(prompt).toContain('2400');
    expect(prompt).toContain(caseFixture.refundPolicy);
    expect(prompt).toContain(caseFixture.language);
    expect(prompt).not.toContain(caseFixture.groundTruth.department);
    expect(prompt).toMatch(/do not invent/i);
  });
});
