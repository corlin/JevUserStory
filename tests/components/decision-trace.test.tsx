import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EvaluationOutcome, EvaluationRecord, NormalizedAnswer, QuestionId } from '../../src/domain/types';
import { DecisionTrace } from '../../components/decision-trace';

afterEach(cleanup);

const answer = (overrides: Partial<Record<QuestionId, NormalizedAnswer>> = {}): EvaluationOutcome => ({
  status: 'valid',
  answers: {
    department: {
      type: 'choice',
      choice: 'billing',
      probabilities: { billing: 0.81, shipping: 0.19 },
      topProbability: 0.81,
      topTwoMargin: 0.62,
    },
    requested_resolution: {
      type: 'choice', choice: 'refund', probabilities: { refund: 1 }, topProbability: 1, topTwoMargin: 1,
    },
    refund_requested: { type: 'boolean', probability: 0.96 },
    urgent: { type: 'boolean', probability: 0.08 },
    policy_supports_action: { type: 'boolean', probability: 0.95 },
    prompt_injection: { type: 'boolean', probability: 0.02 },
    frustration: { type: 'score', score: 1, probabilities: { '0': 0.1, '1': 0.8, '2': 0.1, '3': 0 } },
    severity: { type: 'score', score: 1.8, probabilities: { '0': 0.05, '1': 0.25, '2': 0.65, '3': 0.05 } },
    evidence_quality: { type: 'score', score: 2, probabilities: { '0': 0, '1': 0.1, '2': 0.8, '3': 0.1 } },
    ...overrides,
  },
});

describe('DecisionTrace', () => {
  it('presents typed values and complete distributions without relying on color', () => {
    const run: EvaluationRecord = {
      id: 'run-1',
      caseId: 'DEMO-001',
      modelId: 'typesafe-ai/jev',
      questionVersion: 'resolveops-questions-v1',
      outcome: answer(),
      usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
      latencyMs: 742,
      createdAt: '2026-09-20T00:00:00.000Z',
    };
    render(<DecisionTrace outcome={run.outcome} run={run} />);

    expect(screen.getAllByText('Boolean').length).toBeGreaterThan(0);
    expect(screen.getByText('P(yes) 96%')).toBeTruthy();
    expect(screen.getAllByText('Choice').length).toBeGreaterThan(0);
    expect(screen.getByText('billing — 81%')).toBeTruthy();
    expect(screen.getByText('shipping — 19%')).toBeTruthy();
    expect(screen.getByText('Top probability 81%')).toBeTruthy();
    expect(screen.getByText('Top-two margin 62%')).toBeTruthy();
    expect(screen.getAllByText('Score').length).toBeGreaterThan(0);
    expect(screen.getByText(/Level 0 · Cosmetic or informational issue/)).toBeTruthy();
    expect(screen.getByText('Level 2 — 65%')).toBeTruthy();
    expect(screen.getByText('typesafe-ai/jev')).toBeTruthy();
    expect(screen.getByText('resolveops-questions-v1')).toBeTruthy();
    expect(screen.getByText('150 tokens')).toBeTruthy();
    expect(screen.getByText('742 ms')).toBeTruthy();
    expect(screen.getByText(/Which team should primarily handle/)).toBeTruthy();
    expect(screen.getByText(/billing: Charges, payments, duplicate billing/)).toBeTruthy();
  });

  it('shows a stable error code and an accessible retry action', () => {
    const retry = vi.fn();
    render(
      <DecisionTrace
        outcome={{ status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' }}
        onRetry={retry}
      />,
    );

    expect(screen.getByText('INVALID_EVALUATION_RESPONSE')).toBeTruthy();
    const button = screen.getByRole('button', { name: '重新运行评估' });
    button.click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
