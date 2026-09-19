type ProbabilityBarProps = {
  label: string;
  probability: number;
};

export function ProbabilityBar({ label, probability }: ProbabilityBarProps) {
  const percentage = Math.round(probability * 100);
  return (
    <div className="probability-row">
      <div className="probability-label">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div
        aria-label={`${label} ${percentage}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className="probability-track"
        role="progressbar"
      >
        <span className="probability-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
