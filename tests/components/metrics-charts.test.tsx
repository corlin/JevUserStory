import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalibrationChart } from '../../components/metrics/calibration-chart';
import { ConfusionMatrix } from '../../components/metrics/confusion-matrix';
import { CoverageRiskChart } from '../../components/metrics/coverage-risk-chart';
import { PerformanceSummary } from '../../components/metrics/performance-summary';
import type { BooleanMetric, ChoiceMetric, SystemPerformanceMetrics } from '../../src/domain/types';

describe('metrics chart components', () => {
  it('renders calibration chart with accessible svg and bins', () => {
    const mockBooleanMetric: BooleanMetric = {
      questionId: 'refund_requested',
      accuracy: 0.93,
      precision: 0.95,
      recall: 0.92,
      f1: 0.935,
      ece: 0.038,
      bins: Array.from({ length: 10 }, (_, i) => ({
        binIndex: i,
        binLower: i / 10,
        binUpper: (i + 1) / 10,
        averageConfidence: i / 10 + 0.05,
        empiricalAccuracy: i / 10 + 0.04,
        count: 3,
      })),
    };

    render(<CalibrationChart metric={mockBooleanMetric} title="退款意图校准图 (ECE)" />);
    expect(screen.getByRole('img', { name: /退款意图校准图/ })).toBeInTheDocument();
    expect(screen.getAllByText(/3.8%/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders confusion matrix with accuracy summary', () => {
    const mockChoiceMetric: ChoiceMetric = {
      questionId: 'department',
      accuracy: 0.90,
      macroF1: 0.88,
      total: 30,
      correct: 27,
    };

    render(<ConfusionMatrix metric={mockChoiceMetric} title="部门路由准确率" />);
    expect(screen.getByText('部门路由准确率')).toBeInTheDocument();
    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('27 / 30')).toBeInTheDocument();
  });

  it('renders coverage-risk trade-off chart', () => {
    render(
      <CoverageRiskChart
        autoRate={0.65}
        reviewRate={0.25}
        blockRate={0.10}
        falseAutomationRate={0.02}
      />
    );
    expect(screen.getByText('策略覆盖与风险分布')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('renders performance summary cards', () => {
    const perf: SystemPerformanceMetrics = {
      p50LatencyMs: 160,
      p95LatencyMs: 240,
      p99LatencyMs: 280,
      averageLatencyMs: 175,
      totalInputTokens: 14500,
      totalOutputTokens: 850,
      totalTokens: 15350,
      estimatedCostUsd: 0.0027,
    };

    render(<PerformanceSummary performance={perf} />);
    expect(screen.getByText('160 ms')).toBeInTheDocument();
    expect(screen.getByText('15,350')).toBeInTheDocument();
    expect(screen.getByText('$0.0027')).toBeInTheDocument();
  });
});
