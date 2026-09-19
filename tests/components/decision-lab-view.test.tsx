import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionLabView } from '../../components/decision-lab/decision-lab-view';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { generateBaselineAnswers } from '../../src/services/experiment-service';
import { POLICY_V1 } from '../../src/policy/policy-v1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Decision Lab live evaluation feedback', () => {
  it('shows the public Gateway error when a live run fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: 'GATEWAY_AUTHENTICATION_FAILED' } }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )));
    const fixture = DEMO_CASES[0];

    render(
      <DecisionLabView
        activePolicyThresholds={POLICY_V1}
        allCases={DEMO_CASES}
        initialExperiment={{
          id: 'EXP-BASELINE-V1',
          modelId: 'typesafe-ai/jev',
          questionVersion: 'resolveops-questions-v1',
          policyVersion: 'resolveops-policy-v1',
          datasetSlice: 'all',
          status: 'completed',
          sourceType: 'baseline',
          totalCases: 1,
          completedCases: 1,
          createdAt: '2026-09-19T00:00:00.000Z',
        }}
        initialResults={[{
          id: 'RES-1',
          experimentId: 'EXP-BASELINE-V1',
          caseId: fixture.id,
          answers: generateBaselineAnswers(fixture),
          groundTruth: fixture.groundTruth,
          latencyMs: 100,
          usage: { totalTokens: 10 },
          policyAction: 'review',
          reasonCodes: [],
          proposedRefundCents: 0,
          createdAt: '2026-09-19T00:00:00.000Z',
        }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /运行实时评测/ }));

    await waitFor(() => {
      expect(screen.getByText(/Gateway 凭据无效或未配置/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pre-evaluated Baseline/)).toBeInTheDocument();
  });
});
