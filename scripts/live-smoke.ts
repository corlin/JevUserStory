import { experimental_evaluate as evaluate } from 'ai';

import type { QuestionId } from '../src/domain/types';
import { getDemoCase } from '../src/fixtures/cases';
import { generateApprovedReply } from '../src/gateway/generate-reply';
import { normalizeAnswers } from '../src/gateway/normalize-answer';
import { QUESTION_SET_V1 } from '../src/gateway/question-set-v1';
import { REPLY_VERIFICATION_QUESTIONS } from '../src/gateway/verify-reply';
import { POLICY_V1 } from '../src/policy/policy-v1';

async function main() {
  const caseFixture = getDemoCase('DEMO-001');
  if (!caseFixture) throw new Error('SMOKE_CASE_NOT_FOUND');

  const review = {
    id: 'live-smoke-review',
    caseId: caseFixture.id,
    idempotencyKey: 'live-smoke-idempotency',
    action: 'modify_refund' as const,
    refundCents: 2400,
    note: 'Live smoke test only; no real refund.',
    createdAt: new Date().toISOString(),
  };
  const generated = await generateApprovedReply({ caseFixture, review });
  const replyFacts = {
    draft: generated.draft,
    approvedAction: review.action,
    approvedRefundCents: review.refundCents,
    refundPolicy: caseFixture.refundPolicy,
  };
  const questions = { ...QUESTION_SET_V1, ...REPLY_VERIFICATION_QUESTIONS };
  const liveResult = await evaluate({
    model: 'typesafe-ai/jev',
    state: JSON.stringify({
      customer: caseFixture.customer,
      order: caseFixture.order,
      payments: caseFixture.payments,
      shipment: caseFixture.shipment,
      ...replyFacts,
    }),
    questions,
    maxRetries: 2,
  });
  const caseQuestionIds = Object.keys(QUESTION_SET_V1) as QuestionId[];
  const caseAnswers = Object.fromEntries(caseQuestionIds.map((id) => [id, liveResult.answers[id]]));
  const normalized = normalizeAnswers(caseAnswers, caseQuestionIds);
  const verificationEntries = Object.keys(REPLY_VERIFICATION_QUESTIONS).map((id) => {
    const answer = liveResult.answers[id as keyof typeof REPLY_VERIFICATION_QUESTIONS];
    if (answer.type !== 'boolean') throw new Error('INVALID_REPLY_VERIFICATION');
    return [id, answer.probability] as const;
  });
  const verificationReasonCodes = verificationEntries
    .filter(([, probability]) => probability >= POLICY_V1.replyReviewMinimum)
    .map(([id]) => id);

  console.log(JSON.stringify({
    evaluation: {
      modelId: liveResult.response.modelId,
      questionCount: Object.keys(normalized).length,
      answerTypes: [...new Set(Object.values(normalized).map((answer) => answer.type))].sort(),
    },
    reply: {
      modelId: generated.modelId,
      characterCount: generated.draft.length,
      verificationStatus: verificationReasonCodes.length > 0 ? 'review_required' : 'approved',
      verificationReasonCodes,
    },
  }, null, 2));
}

function safeFailureCode(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { statusCode?: unknown; lastError?: { statusCode?: unknown } }).statusCode
      ?? (error as { lastError?: { statusCode?: unknown } }).lastError?.statusCode;
    if (status === 429) return 'GATEWAY_RATE_LIMITED';
  }
  return error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
    ? error.message
    : 'LIVE_SMOKE_FAILED';
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ status: 'failed', code: safeFailureCode(error) }));
  process.exitCode = 1;
});
