import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolicySimulator } from '../../components/decision-lab/policy-simulator';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { POLICY_V1 } from '../../src/policy/policy-v1';
import { generateBaselineAnswers } from '../../src/services/experiment-service';
import type { ExperimentCaseResultRecord } from '../../src/domain/types';

afterEach(() => {
  cleanup();
});

describe('policy simulator component', () => {
  const mockResults: ExperimentCaseResultRecord[] = DEMO_CASES.slice(0, 5).map((fixture) => ({
    id: `RES-${fixture.id}`,
    experimentId: 'EXP-TEST',
    caseId: fixture.id,
    answers: generateBaselineAnswers(fixture),
    groundTruth: fixture.groundTruth,
    latencyMs: 150,
    usage: { inputTokens: 400, outputTokens: 20, totalTokens: 420 },
    policyAction: 'auto',
    reasonCodes: ['REFUND_ELIGIBLE'],
    proposedRefundCents: 1000,
    createdAt: new Date().toISOString(),
  }));

  it('renders threshold sliders and reacts to threshold adjustments', () => {
    render(
      <PolicySimulator
        cases={DEMO_CASES.slice(0, 5)}
        initialThresholds={POLICY_V1}
        results={mockResults}
      />
    );

    expect(screen.getByText('策略模拟器 (Zero-cost Policy Simulator)')).toBeInTheDocument();
    expect(screen.getByLabelText(/自动退款门槛/)).toBeInTheDocument();

    const refundSlider = screen.getByLabelText(/自动退款门槛/);
    fireEvent.change(refundSlider, { target: { value: '0.99' } });

    // When threshold is set to 0.99, fewer cases qualify for auto
    expect(screen.getByText(/0.99/)).toBeInTheDocument();
  });

  it('allows saving simulated policy as new version', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <PolicySimulator
        cases={DEMO_CASES.slice(0, 5)}
        initialThresholds={POLICY_V1}
        onSavePolicy={handleSave}
        results={mockResults}
      />
    );

    const saveTrigger = screen.getByRole('button', { name: /另存为新策略/ });
    fireEvent.click(saveTrigger);

    const versionInput = screen.getByLabelText(/策略版本号/);
    fireEvent.change(versionInput, { target: { value: 'resolveops-policy-v2-test' } });

    const submitBtn = screen.getByRole('button', { name: /确认发布策略/ });
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'resolveops-policy-v2-test',
      })
    );
  });
});
