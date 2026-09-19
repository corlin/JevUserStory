import type {
  CaseFixture,
  EvaluationOutcome,
  NormalizedAnswer,
  PolicyDecision,
} from '../domain/types';
import { POLICY_V1 } from './policy-v1';
import { calculateVerifiedRefundCents } from './refund-facts';

function booleanProbability(answer: NormalizedAnswer): number | undefined {
  return answer.type === 'boolean' ? answer.probability : undefined;
}

function decision(
  action: PolicyDecision['action'],
  reasonCodes: string[],
  proposedRefundCents = 0,
): PolicyDecision {
  return {
    action,
    reasonCodes,
    proposedRefundCents,
    policyVersion: POLICY_V1.id,
  };
}

export function evaluatePolicy(
  caseFixture: CaseFixture,
  outcome: EvaluationOutcome,
): PolicyDecision {
  if (outcome.status === 'invalid') {
    return decision('review', [outcome.errorCode]);
  }

  const booleanProbabilities = Object.values(outcome.answers)
    .map(booleanProbability)
    .filter((value): value is number => value !== undefined);
  const hasUncertainBoolean = booleanProbabilities.some(
    (value) => value >= POLICY_V1.booleanUncertainLower && value <= POLICY_V1.booleanUncertainUpper,
  );
  if (hasUncertainBoolean) {
    return decision('review', ['BOOLEAN_UNCERTAIN']);
  }

  const injection = booleanProbability(outcome.answers.prompt_injection) ?? 1;
  if (injection >= POLICY_V1.injectionReviewMinimum) {
    return decision('review', ['PROMPT_INJECTION_REVIEW']);
  }

  const choiceUncertain = Object.values(outcome.answers).some(
    (answer) => answer.type === 'choice'
      && (answer.topProbability < POLICY_V1.choiceTopMinimum || answer.topTwoMargin < POLICY_V1.choiceMarginMinimum),
  );
  if (choiceUncertain) return decision('review', ['CHOICE_UNCERTAIN']);

  const scoreUncertain = Object.values(outcome.answers).some(
    (answer) => answer.type === 'score'
      && Math.max(0, ...Object.values(answer.probabilities)) < POLICY_V1.scoreTopMinimum,
  );
  if (scoreUncertain) return decision('review', ['SCORE_UNCERTAIN']);

  const evidence = outcome.answers.evidence_quality;
  if (evidence.type !== 'score' || evidence.score < POLICY_V1.evidenceScoreMinimum) {
    return decision('review', ['EVIDENCE_INSUFFICIENT']);
  }

  const refundRequested = booleanProbability(outcome.answers.refund_requested) ?? 0;
  const policySupportsAction = booleanProbability(outcome.answers.policy_supports_action) ?? 0;
  if (refundRequested < POLICY_V1.refundAutoMinimum) {
    return decision('block', ['REFUND_NOT_CLEARLY_REQUESTED']);
  }
  if (policySupportsAction < POLICY_V1.policySupportMinimum) {
    return decision('block', ['POLICY_DOES_NOT_SUPPORT_REFUND']);
  }

  const hasCapturedPayment = caseFixture.payments.some((payment) => payment.status === 'captured');
  if (!hasCapturedPayment) {
    return decision('review', ['PAYMENT_NOT_VERIFIED']);
  }
  const proposedRefundCents = calculateVerifiedRefundCents(caseFixture);
  if (proposedRefundCents === 0) return decision('review', ['REFUND_GROUND_NOT_VERIFIED']);

  if (proposedRefundCents > POLICY_V1.highRiskRefundCents) {
    return decision('confirm', ['HIGH_VALUE_CONFIRMATION'], proposedRefundCents);
  }

  return decision('auto', ['REFUND_ELIGIBLE'], proposedRefundCents);
}
