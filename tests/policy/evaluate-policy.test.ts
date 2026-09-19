import { describe, expect, it } from 'vitest';

import type { EvaluationOutcome, NormalizedAnswer, QuestionId } from '../../src/domain/types';
import { getDemoCase } from '../../src/fixtures/cases';
import { evaluatePolicy } from '../../src/policy/evaluate-policy';

const choice = (value: string): NormalizedAnswer => ({
  type: 'choice',
  choice: value,
  probabilities: { [value]: 0.97, other: 0.03 },
  topProbability: 0.97,
  topTwoMargin: 0.94,
});

const score = (value: number): NormalizedAnswer => ({
  type: 'score',
  score: value,
  probabilities: { '0': 0.01, '1': 0.01, '2': 0.97, '3': 0.01 },
});

const clearSafeAnswers: Record<QuestionId, NormalizedAnswer> = {
  department: choice('billing'),
  requested_resolution: choice('refund'),
  refund_requested: { type: 'boolean', probability: 0.97 },
  urgent: { type: 'boolean', probability: 0.1 },
  policy_supports_action: { type: 'boolean', probability: 0.96 },
  prompt_injection: { type: 'boolean', probability: 0.02 },
  frustration: score(1.2),
  severity: score(2),
  evidence_quality: score(2.8),
};

describe('evaluatePolicy', () => {
  const safeCase = getDemoCase('DEMO-001')!;

  it('allows a clear, verified, low-value refund automatically', () => {
    expect(evaluatePolicy(safeCase, { status: 'valid', answers: clearSafeAnswers })).toEqual({
      action: 'auto',
      reasonCodes: ['REFUND_ELIGIBLE'],
      proposedRefundCents: 4900,
      policyVersion: 'resolveops-policy-v1',
    });
  });

  it('routes prompt injection and uncertain booleans to review', () => {
    const injection = evaluatePolicy(safeCase, {
      status: 'valid',
      answers: {
        ...clearSafeAnswers,
        prompt_injection: { type: 'boolean', probability: 0.84 },
      },
    });
    expect(injection.action).toBe('review');
    expect(injection.reasonCodes).toContain('PROMPT_INJECTION_REVIEW');

    const uncertainAnswers = {
      ...clearSafeAnswers,
      refund_requested: { type: 'boolean' as const, probability: 0.5 },
    };
    const uncertain = evaluatePolicy(safeCase, { status: 'valid', answers: uncertainAnswers });
    expect(uncertain.action).toBe('review');
    expect(uncertain.reasonCodes).toContain('BOOLEAN_UNCERTAIN');
  });

  it('fails closed for invalid model output', () => {
    const outcome: EvaluationOutcome = {
      status: 'invalid',
      errorCode: 'INVALID_EVALUATION_RESPONSE',
    };
    expect(evaluatePolicy(safeCase, outcome)).toEqual({
      action: 'review',
      reasonCodes: ['INVALID_EVALUATION_RESPONSE'],
      proposedRefundCents: 0,
      policyVersion: 'resolveops-policy-v1',
    });
  });

  it('requires confirmation for a high-value refund', () => {
    const highValueCase = {
      ...safeCase,
      order: { ...safeCase.order, totalCents: 12_000 },
      payments: safeCase.payments.map((payment) => ({ ...payment, amountCents: 12_000 })),
    };
    const decision = evaluatePolicy(highValueCase, { status: 'valid', answers: clearSafeAnswers });
    expect(decision.action).toBe('confirm');
    expect(decision.reasonCodes).toContain('HIGH_VALUE_CONFIRMATION');
  });

  it('routes an unverified payment to review', () => {
    const unverifiedCase = {
      ...safeCase,
      payments: safeCase.payments.map((payment) => ({ ...payment, status: 'pending' as const })),
    };
    const decision = evaluatePolicy(unverifiedCase, { status: 'valid', answers: clearSafeAnswers });
    expect(decision.action).toBe('review');
    expect(decision.reasonCodes).toContain('PAYMENT_NOT_VERIFIED');
  });

  it('requires deterministic duplicate-charge facts before automatic refund', () => {
    const singleChargeCase = { ...safeCase, payments: [safeCase.payments[0]!] };
    const decision = evaluatePolicy(singleChargeCase, { status: 'valid', answers: clearSafeAnswers });
    expect(decision.action).toBe('review');
    expect(decision.reasonCodes).toContain('REFUND_GROUND_NOT_VERIFIED');
  });

  it('routes low evidence and diffuse typed distributions to review', () => {
    const lowEvidence = {
      ...clearSafeAnswers,
      evidence_quality: {
        type: 'score' as const,
        score: 0,
        probabilities: { '0': 1, '1': 0, '2': 0, '3': 0 },
      },
    };
    expect(evaluatePolicy(safeCase, { status: 'valid', answers: lowEvidence }).reasonCodes)
      .toContain('EVIDENCE_INSUFFICIENT');

    const diffuseChoice = {
      ...clearSafeAnswers,
      department: {
        type: 'choice' as const,
        choice: 'billing',
        probabilities: { billing: 0.45, shipping: 0.4, other: 0.15 },
        topProbability: 0.45,
        topTwoMargin: 0.05,
      },
    };
    expect(evaluatePolicy(safeCase, { status: 'valid', answers: diffuseChoice }).reasonCodes)
      .toContain('CHOICE_UNCERTAIN');
  });
});
