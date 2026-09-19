import type { ChoiceMetric } from '../../src/domain/types';

type ConfusionMatrixProps = {
  metric: ChoiceMetric;
  title: string;
};

export function ConfusionMatrix({ metric, title }: ConfusionMatrixProps) {
  const accuracyPct = Math.round(metric.accuracy * 100);
  const macroF1Pct = Math.round(metric.macroF1 * 100);

  return (
    <div className="card metric-chart-card">
      <div className="chart-header">
        <div>
          <h4>{title}</h4>
          <small>多分类闭环一致性度量</small>
        </div>
        <span className="status-badge status-auto">{accuracyPct}%</span>
      </div>

      <div className="metric-stats-grid">
        <div className="stat-box">
          <span className="stat-value">{accuracyPct}%</span>
          <span className="stat-label">Top-1 准确率</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{macroF1Pct}%</span>
          <span className="stat-label">Macro-F1</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{metric.correct} / {metric.total}</span>
          <span className="stat-label">正确案数</span>
        </div>
      </div>

      <div className="probability-track" style={{ marginTop: '0.75rem', height: '8px' }}>
        <span
          className="probability-fill"
          style={{ width: `${accuracyPct}%`, background: 'var(--color-brand, #2563eb)' }}
        />
      </div>
    </div>
  );
}
