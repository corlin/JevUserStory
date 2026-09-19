'use client';

import type { PolicyDecisionRecord } from '../src/db/run-repository';
import type { ReplyRunRecord } from '../src/db/run-repository';
import type { PublicReviewDecision } from '../src/services/review-service';
import { StatusBadge } from './ui/status-badge';

type PolicyDecisionProps = {
  decision?: PolicyDecisionRecord;
  loading?: boolean;
  onEvaluate: () => void;
  review?: PublicReviewDecision;
  reply?: ReplyRunRecord;
  replyError?: string;
  generatingReply?: boolean;
  onGenerateReply?: () => void;
};

export function PolicyDecision({
  decision,
  loading = false,
  onEvaluate,
  review,
  reply,
  replyError,
  generatingReply = false,
  onGenerateReply,
}: PolicyDecisionProps) {
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
      {review && onGenerateReply ? (
        <div className="reply-action">
          <button disabled={generatingReply} onClick={onGenerateReply} type="button">
            {generatingReply ? '生成并验证中…' : '生成并验证客户回复'}
          </button>
          {replyError ? <code role="alert">{replyError}</code> : null}
        </div>
      ) : null}
      {reply ? (
        <div className="reply-preview">
          <div><span>Customer reply</span><StatusBadge tone={reply.status === 'approved' ? 'success' : 'warning'}>{reply.status}</StatusBadge></div>
          <p>{reply.draft}</p>
          {reply.verification.reasonCodes.length > 0 ? <small>{reply.verification.reasonCodes.join(' · ')}</small> : null}
        </div>
      ) : null}
    </section>
  );
}
