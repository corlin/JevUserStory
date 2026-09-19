'use client';

import { useRef, useState } from 'react';

import type { PublicReviewDecision } from '../src/services/review-service';

type ReviewFormProps = {
  caseId: string;
  maximumRefundCents: number;
  onRecorded?: (decision: PublicReviewDecision) => void;
};

function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ReviewForm({ caseId, maximumRefundCents, onRecorded }: ReviewFormProps) {
  const key = useRef<string>(createIdempotencyKey());
  const [refundCents, setRefundCents] = useState(maximumRefundCents);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<PublicReviewDecision>();
  const [errorCode, setErrorCode] = useState<string>();

  async function submit(action: 'confirm_refund' | 'modify_refund' | 'escalate' | 'reject') {
    setSubmitting(true);
    setErrorCode(undefined);
    try {
      const response = await fetch(`/api/cases/${caseId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: key.current,
          action,
          refundCents: action === 'escalate' || action === 'reject' ? 0 : refundCents,
          note,
        }),
      });
      const payload = await response.json() as PublicReviewDecision | { error?: { code?: string } };
      if (!response.ok || !('simulation' in payload)) {
        setErrorCode('error' in payload ? payload.error?.code ?? 'REVIEW_FAILED' : 'REVIEW_FAILED');
        return;
      }
      setDecision(payload);
      onRecorded?.(payload);
    } catch {
      setErrorCode('REVIEW_FAILED');
    } finally {
      setSubmitting(false);
    }
  }

  if (decision) {
    return (
      <section className="review-success" aria-live="polite">
        <strong>模拟决定已记录；未执行真实退款</strong>
        <span>{decision.action} · ${(decision.refundCents / 100).toFixed(2)}</span>
      </section>
    );
  }

  return (
    <section className="review-form" aria-labelledby="review-title">
      <div><p className="section-kicker">Human checkpoint</p><h2 id="review-title">记录模拟人工决定</h2></div>
      <div className="review-fields">
        <label>退款金额（美分）<input min="0" max={maximumRefundCents} onChange={(event) => setRefundCents(Number(event.target.value))} type="number" value={refundCents} /></label>
        <label>审核备注<textarea onChange={(event) => setNote(event.target.value)} placeholder="记录判断依据" value={note} /></label>
      </div>
      {errorCode ? <code className="form-error" role="alert">{errorCode}</code> : null}
      <div className="review-actions">
        <button disabled={submitting} onClick={() => submit('confirm_refund')} type="button">确认退款</button>
        <button disabled={submitting} onClick={() => submit('modify_refund')} type="button">修改退款</button>
        <button disabled={submitting} onClick={() => submit('escalate')} type="button">升级处理</button>
        <button disabled={submitting} onClick={() => submit('reject')} type="button">拒绝退款</button>
      </div>
    </section>
  );
}
