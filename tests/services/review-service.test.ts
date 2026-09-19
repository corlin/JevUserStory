import { describe, expect, it } from 'vitest';

import { seedCases, findCase } from '../../src/db/case-repository';
import { openDatabase } from '../../src/db/client';
import { countReviewDecisions, saveReviewDecision } from '../../src/db/run-repository';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { createReviewService } from '../../src/services/review-service';

function setup() {
  const database = openDatabase(':memory:');
  seedCases(database, DEMO_CASES);
  let sequence = 0;
  const service = createReviewService({
    findCase: (caseId) => findCase(database, caseId),
    saveReviewDecision: (record) => saveReviewDecision(database, record),
    createId: () => `review-${++sequence}`,
    now: () => new Date('2026-09-19T01:00:00.000Z'),
  });
  return { database, service };
}

describe('review service', () => {
  it('records a retry once and returns the original simulated decision', async () => {
    const { database, service } = setup();
    const input = {
      caseId: 'DEMO-001',
      idempotencyKey: 'idem-001',
      action: 'modify_refund' as const,
      refundCents: 2400,
      note: 'Partial refund approved after review.',
    };

    const first = await service.recordReview(input);
    const retry = await service.recordReview(input);

    expect(first.id).toBe('review-1');
    expect(retry.id).toBe(first.id);
    expect(retry.simulation).toBe(true);
    expect(countReviewDecisions(database)).toBe(1);
    database.close();
  });

  it.each([
    ['negative refund', { action: 'modify_refund', refundCents: -1 }, 'INVALID_REFUND_AMOUNT'],
    ['above verified amount', { action: 'modify_refund', refundCents: 4901 }, 'REFUND_EXCEEDS_VERIFIED_AMOUNT'],
    ['unknown action', { action: 'charge_card', refundCents: 0 }, 'INVALID_REVIEW_ACTION'],
  ])('rejects %s', async (_label, override, code) => {
    const { database, service } = setup();
    await expect(service.recordReview({
      caseId: 'DEMO-001',
      idempotencyKey: 'idem-invalid',
      action: override.action,
      refundCents: override.refundCents,
      note: 'test',
    })).rejects.toThrowError(code);
    expect(countReviewDecisions(database)).toBe(0);
    database.close();
  });
});
