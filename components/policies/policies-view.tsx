'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PolicyVersionRecord } from '../../src/domain/types';
import { StatusBadge } from '../ui/status-badge';

type PoliciesViewProps = {
  initialPolicies: PolicyVersionRecord[];
};

export function PoliciesView({ initialPolicies }: PoliciesViewProps) {
  const [policies, setPolicies] = useState<PolicyVersionRecord[]>(initialPolicies);
  const [activatingVersion, setActivatingVersion] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSetActive = async (version: string) => {
    setActivatingVersion(version);
    try {
      const res = await fetch('/api/policies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (res.ok) {
        setPolicies((prev) =>
          prev.map((p) => ({
            ...p,
            isActive: p.version === version,
          }))
        );
        setMessage(`✓ 已成功将 ${version} 设为运行策略！案件工作台将以此版本为准。`);
        setTimeout(() => setMessage(null), 3500);
      } else {
        setMessage('策略激活失败：该版本可能已不存在，请刷新页面后重试。');
      }
    } catch {
      setMessage('策略激活失败：网络或服务暂时不可用。');
    } finally {
      setActivatingVersion(null);
    }
  };

  return (
    <main className="queue-page">
      <header className="queue-header">
        <div>
          <p className="eyebrow">Governance & Versioning</p>
          <h1>Policy Repository</h1>
          <p>管理 ResolveOps 规则引擎的不可变策略版本，控制自动退款与安全审核门限。</p>
        </div>
        <Link className="button button-primary" href="/decision-lab" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
          前往 Decision Lab 模拟新策略 →
        </Link>
      </header>

      {message && (
        <div aria-live="polite" role="status" style={{ margin: '1rem 0', padding: '0.75rem 1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '0.85rem' }}>
          {message}
        </div>
      )}

      <div className="queue-notice" style={{ margin: '1.25rem 0' }}>
        <StatusBadge tone="info">策略解耦原则</StatusBadge>
        <span>
          Jev 只负责输出校准概率，业务动作由当前激活策略做确定性判断。切换策略不消耗任何 Token。
        </span>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }}>
        {policies.map((p) => (
          <div
            className="card"
            key={p.version}
            style={{
              padding: '1.25rem',
              background: 'var(--paper)',
              border: p.isActive ? '2px solid #16a34a' : '1px solid var(--line)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  {p.isActive ? (
                    <span className="status-badge status-auto">● 当前生效 (Active)</span>
                  ) : (
                    <span className="status-badge status-neutral">历史归档快照</span>
                  )}
                </div>
                <code style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginTop: '0.25rem' }}>
                  {p.version}
                </code>
                {p.description && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                    {p.description}
                  </p>
                )}
              </div>

              {!p.isActive && (
                <button
                  className="button button-secondary"
                  disabled={activatingVersion === p.version}
                  onClick={() => handleSetActive(p.version)}
                  style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                  type="button"
                >
                  {activatingVersion === p.version ? '激活中...' : '设为主干生效策略'}
                </button>
              )}
            </div>

            {/* Thresholds Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ebe9e3' }}>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>自动退款门限</small>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>P ≥ {p.thresholds.refundAutoMinimum}</div>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>政策支持门限</small>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>P ≥ {p.thresholds.policySupportMinimum}</div>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>注入拦截门限</small>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>P ≥ {p.thresholds.injectionReviewMinimum}</div>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>最低证据等级</small>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Score ≥ {p.thresholds.evidenceScoreMinimum}</div>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>高额确认线</small>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>${(p.thresholds.highRiskRefundCents / 100).toFixed(2)}</div>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>创建时间</small>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{p.createdAt.slice(0, 10)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
