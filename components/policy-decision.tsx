'use client';

import type { PolicyDecisionRecord } from '../src/db/run-repository';
import { StatusBadge } from './ui/status-badge';

type PolicyDecisionProps = {
  decision?: PolicyDecisionRecord;
  loading?: boolean;
  onEvaluate: () => void;
};

export function PolicyDecision({ decision, loading = false, onEvaluate }: PolicyDecisionProps) {
  return (
    <section className="action-dock" aria-labelledby="action-title">
      <div>
        <p className="section-kicker">模拟操作 · 不执行真实退款</p>
        <h2 id="action-title">{decision ? `Policy action: ${decision.action}` : 'Ready for evaluation'}</h2>
        <p className="action-copy">
          {decision ? decision.reasonCodes.join(' · ') : 'Jev evaluates nine typed questions; deterministic policy chooses the next step.'}
        </p>
      </div>
      <div className="action-controls">
        {decision ? <StatusBadge tone={decision.action === 'auto' ? 'success' : 'warning'}>{decision.action.toUpperCase()}</StatusBadge> : null}
        <button className="primary-button" disabled={loading} onClick={onEvaluate} type="button">
          {loading ? '正在评估…' : decision ? '再次运行 Jev' : '运行 Jev 评估'}
        </button>
      </div>
    </section>
  );
}
