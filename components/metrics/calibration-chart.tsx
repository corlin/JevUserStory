import type { BooleanMetric } from '../../src/domain/types';

type CalibrationChartProps = {
  metric: BooleanMetric;
  title?: string;
};

export function CalibrationChart({ metric, title = '概率校准可靠性图 (Reliability Diagram)' }: CalibrationChartProps) {
  const ecePercent = (metric.ece * 100).toFixed(1);
  const size = 200;
  const padding = 28;
  const plotSize = size - padding * 2;

  return (
    <div className="card metric-chart-card">
      <div className="chart-header">
        <div>
          <h4>{title}</h4>
          <small>预期校准误差 (ECE): <strong>{ecePercent}%</strong></small>
        </div>
        <span className="status-badge status-auto">ECE: {ecePercent}%</span>
      </div>

      <svg
        aria-label={`${title}，ECE: ${ecePercent}%`}
        className="calibration-svg"
        height={size}
        role="img"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        {/* Background Grid */}
        <rect fill="var(--color-surface, #f8fafc)" height={plotSize} width={plotSize} x={padding} y={padding} rx="4" />
        
        {/* Diagonal Perfect Calibration Line */}
        <line
          stroke="var(--color-border-subtle, #cbd5e1)"
          strokeDasharray="4 4"
          strokeWidth="1.5"
          x1={padding}
          x2={padding + plotSize}
          y1={padding + plotSize}
          y2={padding}
        />

        {/* Calibration Bars */}
        {metric.bins.map((bin) => {
          if (bin.count === 0) return null;
          const barWidth = plotSize / 10 - 2;
          const x = padding + bin.binIndex * (plotSize / 10) + 1;
          const barHeight = bin.empiricalAccuracy * plotSize;
          const y = padding + plotSize - barHeight;

          return (
            <g key={bin.binIndex}>
              <rect
                fill="var(--color-brand, #2563eb)"
                height={Math.max(2, barHeight)}
                opacity="0.8"
                rx="1"
                width={barWidth}
                x={x}
                y={y}
              >
                <title>
                  {`置信区间 [${(bin.binLower * 100).toFixed(0)}%-${(bin.binUpper * 100).toFixed(0)}%]: 实际准确率 ${(bin.empiricalAccuracy * 100).toFixed(1)}% (${bin.count}案)`}
                </title>
              </rect>
            </g>
          );
        })}

        {/* Axes */}
        <line stroke="var(--color-text, #334155)" strokeWidth="1" x1={padding} x2={padding + plotSize} y1={padding + plotSize} y2={padding + plotSize} />
        <line stroke="var(--color-text, #334155)" strokeWidth="1" x1={padding} x2={padding} y1={padding} y2={padding + plotSize} />

        {/* Axis Labels */}
        <text fill="var(--color-muted, #64748b)" fontSize="9" textAnchor="middle" x={padding + plotSize / 2} y={size - 6}>
          预测置信度 (Confidence)
        </text>
        <text
          fill="var(--color-muted, #64748b)"
          fontSize="9"
          textAnchor="middle"
          transform={`rotate(-90 10 ${padding + plotSize / 2})`}
          x={10}
          y={padding + plotSize / 2}
        >
          实际正例率 (Empirical)
        </text>
      </svg>
    </div>
  );
}
