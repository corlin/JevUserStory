type CoverageRiskChartProps = {
  autoRate: number;
  reviewRate: number;
  blockRate: number;
  falseAutomationRate: number;
};

export function CoverageRiskChart({
  autoRate,
  reviewRate,
  blockRate,
  falseAutomationRate,
}: CoverageRiskChartProps) {
  const autoPct = Math.round(autoRate * 100);
  const reviewPct = Math.round(reviewRate * 100);
  const blockPct = Math.round(blockRate * 100);
  const falseAutoPct = Math.round(falseAutomationRate * 100);

  return (
    <div className="card metric-chart-card">
      <div className="chart-header">
        <div>
          <h4>策略覆盖与风险分布</h4>
          <small>确定性路由动作分流比例与错漏风险</small>
        </div>
        <span className="status-badge status-auto">自动化: {autoPct}%</span>
      </div>

      <div className="segmented-bar-container" style={{ margin: '1rem 0' }}>
        <div
          className="segmented-bar"
          style={{
            display: 'flex',
            height: '16px',
            borderRadius: '4px',
            overflow: 'hidden',
            backgroundColor: '#e2e8f0',
          }}
        >
          <div
            title={`自动处理 (Auto): ${autoPct}%`}
            style={{ width: `${autoPct}%`, backgroundColor: '#16a34a' }}
          />
          <div
            title={`人工复核 (Review): ${reviewPct}%`}
            style={{ width: `${reviewPct}%`, backgroundColor: '#eab308' }}
          />
          <div
            title={`安全阻断 (Block): ${blockPct}%`}
            style={{ width: `${blockPct}%`, backgroundColor: '#dc2626' }}
          />
        </div>
      </div>

      <div className="legend-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
        <div className="legend-item">
          <small style={{ color: '#16a34a', fontWeight: 'bold' }}>● 自动处理</small>
          <div><strong>{autoPct}%</strong></div>
        </div>
        <div className="legend-item">
          <small style={{ color: '#ca8a04', fontWeight: 'bold' }}>● 转人工</small>
          <div><strong>{reviewPct}%</strong></div>
        </div>
        <div className="legend-item">
          <small style={{ color: '#dc2626', fontWeight: 'bold' }}>● 风险阻止</small>
          <div><strong>{blockPct}%</strong></div>
        </div>
        <div className="legend-item">
          <small style={{ color: '#7c3aed', fontWeight: 'bold' }}>▲ 错误自动退款</small>
          <div><strong>{falseAutoPct}%</strong></div>
        </div>
      </div>
    </div>
  );
}
