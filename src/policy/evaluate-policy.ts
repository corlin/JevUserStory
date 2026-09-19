import type {
  CaseFixture,
  EvaluationOutcome,
  NormalizedAnswer,
  PolicyDecision,
  PolicyThresholds,
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
  policyVersion: string = POLICY_V1.id,
): PolicyDecision {
  return {
    action,
    reasonCodes,
    proposedRefundCents,
    policyVersion,
  };
}

export function evaluatePolicy(
  caseFixture: CaseFixture,
  outcome: EvaluationOutcome,
  policyConfig: PolicyThresholds = POLICY_V1,
): PolicyDecision {
  const policyVersion = policyConfig.id ?? POLICY_V1.id;
  if (outcome.status === 'invalid') {
    return decision('review', [outcome.errorCode], 0, policyVersion);
  }

  const booleanProbabilities = Object.values(outcome.answers)
    .map(booleanProbability)
    .filter((value): value is number => value !== undefined);
  const hasUncertainBoolean = booleanProbabilities.some(
    (value) => value >= policyConfig.booleanUncertainLower && value <= policyConfig.booleanUncertainUpper,
  );
  if (hasUncertainBoolean) {
    return decision('review', ['BOOLEAN_UNCERTAIN'], 0, policyVersion);
  }

  const injection = booleanProbability(outcome.answers.prompt_injection) ?? 1;
  if (injection >= policyConfig.injectionReviewMinimum) {
    return decision('review', ['PROMPT_INJECTION_REVIEW'], 0, policyVersion);
  }

  const choiceUncertain = Object.values(outcome.answers).some(
    (answer) => answer.type === 'choice'
      && (answer.topProbability < policyConfig.choiceTopMinimum || answer.topTwoMargin < policyConfig.choiceMarginMinimum),
  );
  if (choiceUncertain) return decision('review', ['CHOICE_UNCERTAIN'], 0, policyVersion);

  const scoreUncertain = Object.values(outcome.answers).some(
    (answer) => answer.type === 'score'
      && Math.max(0, ...Object.values(answer.probabilities)) < policyConfig.scoreTopMinimum,
  );
  if (scoreUncertain) return decision('review', ['SCORE_UNCERTAIN'], 0, policyVersion);

  const evidence = outcome.answers.evidence_quality;
  if (evidence.type !== 'score' || evidence.score < policyConfig.evidenceScoreMinimum) {
    return decision('review', ['EVIDENCE_INSUFFICIENT'], 0, policyVersion);
  }

  const refundRequested = booleanProbability(outcome.answers.refund_requested) ?? 0;
  const policySupportsAction = booleanProbability(outcome.answers.policy_supports_action) ?? 0;
  if (refundRequested < policyConfig.refundAutoMinimum) {
    return decision('block', ['REFUND_NOT_CLEARLY_REQUESTED'], 0, policyVersion);
  }
  if (policySupportsAction < policyConfig.policySupportMinimum) {
    return decision('block', ['POLICY_DOES_NOT_SUPPORT_REFUND'], 0, policyVersion);
  }

  const hasCapturedPayment = caseFixture.payments.some((payment) => payment.status === 'captured');
  if (!hasCapturedPayment) {
    return decision('review', ['PAYMENT_NOT_VERIFIED'], 0, policyVersion);
  }
  const proposedRefundCents = calculateVerifiedRefundCents(caseFixture);
  if (proposedRefundCents === 0) return decision('review', ['REFUND_GROUND_NOT_VERIFIED'], 0, policyVersion);

  if (proposedRefundCents > policyConfig.highRiskRefundCents) {
    return decision('confirm', ['HIGH_VALUE_CONFIRMATION'], proposedRefundCents, policyVersion);
  }

  return decision('auto', ['REFUND_ELIGIBLE'], proposedRefundCents, policyVersion);
}
