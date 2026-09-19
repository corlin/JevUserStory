import { describe, expect, it } from 'vitest';
import type { ExperimentCaseResultRecord } from '../../src/domain/types';
import { calculateExperimentMetrics } from '../../src/metrics/metrics-engine';

describe('metrics engine', () => {
  it('calculates perfect choice accuracy and macro F1', () => {
    const mockResults: ExperimentCaseResultRecord[] = [
      {
        id: 'R1',
        experimentId: 'EXP-1',
        caseId: 'DEMO-001',
        answers: {
          department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9, shipping: 0.1 }, topProbability: 0.9, topTwoMargin: 0.8 },
          requested_resolution: { type: 'choice', choice: 'refund', probabilities: { refund: 0.95 }, topProbability: 0.95, topTwoMargin: 0.9 },
          refund_requested: { type: 'boolean', probability: 0.95 },
          urgent: { type: 'boolean', probability: 0.1 },
          policy_supports_action: { type: 'boolean', probability: 0.95 },
          prompt_injection: { type: 'boolean', probability: 0.05 },
          frustration: { type: 'score', score: 3, probabilities: { 3: 0.9 } },
          severity: { type: 'score', score: 2, probabilities: { 2: 0.8 } },
          evidence_quality: { type: 'score', score: 3, probabilities: { 3: 0.95 } },
        },
        groundTruth: {
          department: 'billing',
          requested_resolution: 'refund',
          refund_requested: true,
          urgent: false,
          policy_supports_action: true,
          prompt_injection: false,
          frustration: 3,
          severity: 2,
          evidence_quality: 3,
        },
        latencyMs: 150,
        usage: { inputTokens: 500, outputTokens: 50, totalTokens: 550 },
        policyAction: 'auto',
        reasonCodes: ['REFUND_ELIGIBLE'],
        proposedRefundCents: 2000,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'R2',
        experimentId: 'EXP-1',
        caseId: 'DEMO-002',
        answers: {
          department: { type: 'choice', choice: 'shipping', probabilities: { shipping: 0.85, billing: 0.15 }, topProbability: 0.85, topTwoMargin: 0.7 },
          requested_resolution: { type: 'choice', choice: 'tracking_info', probabilities: { tracking_info: 0.9 }, topProbability: 0.9, topTwoMargin: 0.8 },
          refund_requested: { type: 'boolean', probability: 0.1 },
          urgent: { type: 'boolean', probability: 0.9 },
          policy_supports_action: { type: 'boolean', probability: 0.2 },
          prompt_injection: { type: 'boolean', probability: 0.85 },
          frustration: { type: 'score', score: 1, probabilities: { 1: 0.9 } },
          severity: { type: 'score', score: 1, probabilities: { 1: 0.8 } },
          evidence_quality: { type: 'score', score: 1, probabilities: { 1: 0.9 } },
        },
        groundTruth: {
          department: 'shipping',
          requested_resolution: 'tracking_info',
          refund_requested: false,
          urgent: true,
          policy_supports_action: false,
          prompt_injection: true,
          frustration: 1,
          severity: 1,
          evidence_quality: 1,
        },
        latencyMs: 250,
        usage: { inputTokens: 600, outputTokens: 60, totalTokens: 660 },
        policyAction: 'block',
        reasonCodes: ['PROMPT_INJECTION_REVIEW'],
        proposedRefundCents: 0,
        createdAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateExperimentMetrics('EXP-1', mockResults);

    expect(metrics.totalCases).toBe(2);
    expect(metrics.choiceMetrics.department.accuracy).toBe(1);
    expect(metrics.choiceMetrics.department.macroF1).toBe(1);

    expect(metrics.booleanMetrics.refund_requested.accuracy).toBe(1);
    expect(metrics.booleanMetrics.refund_requested.precision).toBe(1);
    expect(metrics.booleanMetrics.refund_requested.recall).toBe(1);
    expect(metrics.booleanMetrics.refund_requested.f1).toBe(1);
    expect(metrics.booleanMetrics.refund_requested.bins).toHaveLength(10);

    expect(metrics.scoreMetrics.frustration.mae).toBe(0);
    expect(metrics.scoreMetrics.frustration.withinOneAccuracy).toBe(1);

    expect(metrics.business.autoCount).toBe(1);
    expect(metrics.business.autoRate).toBe(0.5);
    expect(metrics.business.blockCount).toBe(1);
    expect(metrics.business.blockRate).toBe(0.5);
    expect(metrics.business.falseAutomationCount).toBe(0);

    expect(metrics.performance.averageLatencyMs).toBe(200);
    expect(metrics.performance.totalInputTokens).toBe(1100);
    expect(metrics.performance.totalOutputTokens).toBe(110);
  });

  it('correctly quantifies expected calibration error (ECE)', () => {
    // Overconfident wrong prediction: predicts prob 0.95, but ground truth is false
    const miscalibratedResults: ExperimentCaseResultRecord[] = [
      {
        id: 'R3',
        experimentId: 'EXP-2',
        caseId: 'DEMO-003',
        answers: {
          department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.9 }, topProbability: 0.9, topTwoMargin: 0.8 },
          requested_resolution: { type: 'choice', choice: 'refund', probabilities: { refund: 0.9 }, topProbability: 0.9, topTwoMargin: 0.8 },
          refund_requested: { type: 'boolean', probability: 0.95 },
          urgent: { type: 'boolean', probability: 0.95 },
          policy_supports_action: { type: 'boolean', probability: 0.95 },
          prompt_injection: { type: 'boolean', probability: 0.95 },
          frustration: { type: 'score', score: 3, probabilities: { 3: 0.9 } },
          severity: { type: 'score', score: 3, probabilities: { 3: 0.9 } },
          evidence_quality: { type: 'score', score: 3, probabilities: { 3: 0.9 } },
        },
        groundTruth: {
          department: 'billing',
          requested_resolution: 'refund',
          refund_requested: false,
          urgent: false,
          policy_supports_action: false,
          prompt_injection: false,
          frustration: 3,
          severity: 3,
          evidence_quality: 3,
        },
        latencyMs: 100,
        usage: { inputTokens: 500, outputTokens: 50, totalTokens: 550 },
        policyAction: 'auto',
        reasonCodes: ['REFUND_ELIGIBLE'],
        proposedRefundCents: 1000,
        createdAt: new Date().toISOString(),
      },
    ];

    const metrics = calculateExperimentMetrics('EXP-2', miscalibratedResults);
    // Bin [0.9, 1.0] has avg conf = 0.95, empirical acc = 0 -> |0.95 - 0| = 0.95 ECE
    expect(metrics.booleanMetrics.refund_requested.ece).toBeCloseTo(0.95, 2);
    // It auto-refunded when groundTruth policy_supports_action or refund_requested was false -> false automation
    expect(metrics.business.falseAutomationCount).toBe(1);
    expect(metrics.business.falseAutomationRate).toBe(1);
  });
});
