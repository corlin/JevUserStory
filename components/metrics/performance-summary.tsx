import type { SystemPerformanceMetrics } from '../../src/domain/types';

type PerformanceSummaryProps = {
  performance: SystemPerformanceMetrics;
};

export function PerformanceSummary({ performance }: PerformanceSummaryProps) {
  return (
    <div className="card metric-chart-card">
      <div className="chart-header">
        <div>
          <h4>系统延迟与 Token 经济学</h4>
          <small>真实 Gateway 延迟分位数与使用量</small>
        </div>
        <span className="status-badge status-review">P50: {performance.p50LatencyMs} ms</span>
      </div>

      <div className="metric-stats-grid" style={{ marginTop: '0.75rem' }}>
        <div className="stat-box">
          <span className="stat-value">{performance.p50LatencyMs} ms</span>
          <span className="stat-label">P50 延迟</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{performance.p95LatencyMs} ms</span>
          <span className="stat-label">P95 延迟</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{performance.totalTokens.toLocaleString()}</span>
          <span className="stat-label">总消耗 Token</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">${performance.estimatedCostUsd.toFixed(4)}</span>
          <span className="stat-label">预估批次成本</span>
        </div>
      </div>
    </div>
  );
}
