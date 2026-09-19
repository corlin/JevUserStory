import { randomUUID } from 'node:crypto';

import type { CaseFixture } from '../domain/types';
import { findCase } from '../db/case-repository';
import {
  saveReviewDecision,
  type ReviewAction,
  type ReviewDecisionRecord,
} from '../db/run-repository';
import { getDefaultDatabase } from './case-service';

const REVIEW_ACTIONS = new Set<ReviewAction>([
  'confirm_refund',
  'modify_refund',
  'escalate',
  'reject',
]);

export type ReviewInput = {
  caseId: string;
  idempotencyKey: string;
  action: string;
  refundCents: number;
  note: string;
};

export type PublicReviewDecision = ReviewDecisionRecord & { simulation: true };

export type ReviewService = {
  recordReview(input: ReviewInput): Promise<PublicReviewDecision>;
};

type ReviewDependencies = {
  findCase(caseId: string): CaseFixture | undefined;
  saveReviewDecision(record: ReviewDecisionRecord): ReviewDecisionRecord;
  createId(): string;
  now(): Date;
};

function verifiedRefundLimit(caseFixture: CaseFixture): number {
  const capturedAmounts = caseFixture.payments
    .filter((payment) => payment.status === 'captured')
    .map((payment) => payment.amountCents);
  return Math.min(caseFixture.order.totalCents, Math.max(0, ...capturedAmounts));
}

export function createReviewService(dependencies: ReviewDependencies): ReviewService {
  return {
    async recordReview(input) {
      if (!/^DEMO-\d{3}$/.test(input.caseId)) throw new Error('CASE_NOT_FOUND');
      const caseFixture = dependencies.findCase(input.caseId);
      if (!caseFixture) throw new Error('CASE_NOT_FOUND');
      if (!REVIEW_ACTIONS.has(input.action as ReviewAction)) throw new Error('INVALID_REVIEW_ACTION');
      if (!Number.isInteger(input.refundCents) || input.refundCents < 0) throw new Error('INVALID_REFUND_AMOUNT');
      if (input.refundCents > verifiedRefundLimit(caseFixture)) throw new Error('REFUND_EXCEEDS_VERIFIED_AMOUNT');
      if ((input.action === 'escalate' || input.action === 'reject') && input.refundCents !== 0) {
        throw new Error('INVALID_REFUND_AMOUNT');
      }
      if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length < 8) {
        throw new Error('INVALID_IDEMPOTENCY_KEY');
      }

      const saved = dependencies.saveReviewDecision({
        id: dependencies.createId(),
        caseId: input.caseId,
        idempotencyKey: input.idempotencyKey,
        action: input.action as ReviewAction,
        refundCents: input.refundCents,
        note: String(input.note ?? '').slice(0, 1000),
        createdAt: dependencies.now().toISOString(),
      });
      return { ...saved, simulation: true };
    },
  };
}

let resolvedDefaultReviewService: ReviewService | undefined;

function getResolvedDefaultReviewService(): ReviewService {
  if (resolvedDefaultReviewService) return resolvedDefaultReviewService;
  const database = getDefaultDatabase();
  resolvedDefaultReviewService = createReviewService({
    findCase: (caseId) => findCase(database, caseId),
    saveReviewDecision: (record) => saveReviewDecision(database, record),
    createId: randomUUID,
    now: () => new Date(),
  });
  return resolvedDefaultReviewService;
}

export const defaultReviewService: ReviewService = {
  recordReview: (input) => getResolvedDefaultReviewService().recordReview(input),
};
