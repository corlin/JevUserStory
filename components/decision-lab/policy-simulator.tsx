'use client';

import { useMemo, useState } from 'react';
import type { CaseFixture, ExperimentCaseResultRecord, PolicyThresholds } from '../../src/domain/types';
import { evaluatePolicy } from '../../src/policy/evaluate-policy';
import { POLICY_V1 } from '../../src/policy/policy-v1';

type PolicySimulatorProps = {
  cases: readonly CaseFixture[];
  results: ExperimentCaseResultRecord[];
  initialThresholds?: PolicyThresholds;
  onSavePolicy?: (newPolicy: {
    version: string;
    name: string;
    description: string;
    thresholds: PolicyThresholds;
  }) => Promise<void>;
};

export function PolicySimulator({
  cases,
  results,
  initialThresholds = POLICY_V1,
  onSavePolicy,
}: PolicySimulatorProps) {
  const [thresholds, setThresholds] = useState<PolicyThresholds>(initialThresholds);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newVersion, setNewVersion] = useState(`resolveops-policy-${Date.now().toString().slice(-4)}`);
  const [newName, setNewName] = useState('自定义实验策略');
  const [newDesc, setNewDesc] = useState('在 Decision Lab 中调优保存的策略快照');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Instant 60fps re-evaluation across all cases using pure isomorphic evaluatePolicy
  const simulationResults = useMemo(() => {
    const caseMap = new Map(cases.map((c) => [c.id, c]));
    let autoCount = 0;
    let reviewCount = 0;
    let blockCount = 0;
    let confirmCount = 0;
    let falseAutoCount = 0;

    const evaluatedActions: Array<{
      caseId: string;
      title: string;
      action: string;
      reasons: string[];
    }> = [];

    for (const r of results) {
      const fixture = caseMap.get(r.caseId);
      if (!fixture) continue;

      const decision = evaluatePolicy(
        fixture,
        { status: 'valid', answers: r.answers },
        thresholds
      );

      evaluatedActions.push({
        caseId: fixture.id,
        title: fixture.title,
        action: decision.action,
        reasons: decision.reasonCodes,
      });

      if (decision.action === 'auto') {
        autoCount++;
        if (fixture.groundTruth.policy_supports_action === false || fixture.groundTruth.refund_requested === false) {
          falseAutoCount++;
        }
      } else if (decision.action === 'confirm') {
        confirmCount++;
      } else if (decision.action === 'review') {
        reviewCount++;
      } else if (decision.action === 'block') {
        blockCount++;
      }
    }

    const total = evaluatedActions.length || 1;
    return {
      total: evaluatedActions.length,
      autoRate: autoCount / total,
      reviewRate: reviewCount / total,
      blockRate: blockCount / total,
      confirmRate: confirmCount / total,
      falseAutoCount,
      evaluatedActions,
    };
  }, [cases, results, thresholds]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSavePolicy) return;
    setIsSaving(true);
    try {
      await onSavePolicy({
        version: newVersion,
        name: newName,
        description: newDesc,
        thresholds: { ...thresholds, id: newVersion },
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setShowSaveDialog(false);
        setSaveSuccess(false);
      }, 1200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="card policy-simulator-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3>策略模拟器 (Zero-cost Policy Simulator)</h3>
          <small style={{ color: 'var(--color-muted, #64748b)' }}>
            基于已有概率秒级重算，无需调用模型、零 Token 消耗、零网络等待。
          </small>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="button button-secondary"
            onClick={() => setThresholds(initialThresholds)}
            type="button"
          >
            重置参数
          </button>
          <button
            className="button button-primary"
            onClick={() => setShowSaveDialog(true)}
            type="button"
          >
            另存为新策略...
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="simulator-sliders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', margin: '1.25rem 0' }}>
        <div className="slider-box">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="refund-slider">自动退款门槛 (P(refund) ≥)</label>
            <strong>{thresholds.refundAutoMinimum}</strong>
          </div>
          <input
            id="refund-slider"
            max="1.0"
            min="0.5"
            onChange={(e) => setThresholds({ ...thresholds, refundAutoMinimum: Number.parseFloat(e.target.value) })}
            step="0.01"
            style={{ width: '100%', marginTop: '0.25rem' }}
            type="range"
            value={thresholds.refundAutoMinimum}
          />
          <small style={{ color: 'var(--color-muted, #64748b)' }}>默认 0.90，降低可提升自动化率但增加误付风险</small>
        </div>

        <div className="slider-box">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="policy-slider">政策支持门槛 (P(policy) ≥)</label>
            <strong>{thresholds.policySupportMinimum}</strong>
          </div>
          <input
            id="policy-slider"
            max="1.0"
            min="0.5"
            onChange={(e) => setThresholds({ ...thresholds, policySupportMinimum: Number.parseFloat(e.target.value) })}
            step="0.01"
            style={{ width: '100%', marginTop: '0.25rem' }}
            type="range"
            value={thresholds.policySupportMinimum}
          />
          <small style={{ color: 'var(--color-muted, #64748b)' }}>默认 0.90，严格合规门控</small>
        </div>

        <div className="slider-box">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="injection-slider">提示注入拦截门槛 (P(inject) ≥)</label>
            <strong>{thresholds.injectionReviewMinimum}</strong>
          </div>
          <input
            id="injection-slider"
            max="1.0"
            min="0.3"
            onChange={(e) => setThresholds({ ...thresholds, injectionReviewMinimum: Number.parseFloat(e.target.value) })}
            step="0.01"
            style={{ width: '100%', marginTop: '0.25rem' }}
            type="range"
            value={thresholds.injectionReviewMinimum}
          />
          <small style={{ color: 'var(--color-muted, #64748b)' }}>默认 0.80，超过此值强制转人工</small>
        </div>

        <div className="slider-box">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label htmlFor="evidence-slider">最低证据分 (Evidence Score ≥)</label>
            <strong>{thresholds.evidenceScoreMinimum}</strong>
          </div>
          <input
            id="evidence-slider"
            max="4"
            min="1"
            onChange={(e) => setThresholds({ ...thresholds, evidenceScoreMinimum: Number.parseInt(e.target.value, 10) })}
            step="1"
            style={{ width: '100%', marginTop: '0.25rem' }}
            type="range"
            value={thresholds.evidenceScoreMinimum}
          />
          <small style={{ color: 'var(--color-muted, #64748b)' }}>默认 2，要求订单/物流具有必要事实证据</small>
        </div>
      </div>

      {/* Simulated Live Impact Preview */}
      <div className="simulation-preview" style={{ background: 'var(--color-surface, #f8fafc)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--color-border, #e2e8f0)' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>实时模拟结果 (30 案业务动作分布)</h4>
        <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', margin: '0.5rem 0', backgroundColor: '#e2e8f0' }}>
          <div style={{ width: `${Math.round(simulationResults.autoRate * 100)}%`, backgroundColor: '#16a34a' }} title={`自动处理: ${Math.round(simulationResults.autoRate * 100)}%`} />
          <div style={{ width: `${Math.round(simulationResults.confirmRate * 100)}%`, backgroundColor: '#0284c7' }} title={`高额确认: ${Math.round(simulationResults.confirmRate * 100)}%`} />
          <div style={{ width: `${Math.round(simulationResults.reviewRate * 100)}%`, backgroundColor: '#eab308' }} title={`人工审核: ${Math.round(simulationResults.reviewRate * 100)}%`} />
          <div style={{ width: `${Math.round(simulationResults.blockRate * 100)}%`, backgroundColor: '#dc2626' }} title={`安全阻止: ${Math.round(simulationResults.blockRate * 100)}%`} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <span style={{ color: '#16a34a' }}>● 自动处理: <strong>{Math.round(simulationResults.autoRate * 100)}%</strong></span>
          <span style={{ color: '#0284c7' }}>● 高额确认: <strong>{Math.round(simulationResults.confirmRate * 100)}%</strong></span>
          <span style={{ color: '#ca8a04' }}>● 人工复核: <strong>{Math.round(simulationResults.reviewRate * 100)}%</strong></span>
          <span style={{ color: '#dc2626' }}>● 安全阻止: <strong>{Math.round(simulationResults.blockRate * 100)}%</strong></span>
          <span style={{ color: '#7c3aed' }}>▲ 误退款案件: <strong>{simulationResults.falseAutoCount} 案</strong></span>
        </div>
      </div>

      {/* Save Policy Modal */}
      {showSaveDialog && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content card" style={{ maxWidth: '440px', width: '90%', padding: '1.5rem', background: '#fff' }}>
            <h4>另存为新策略版本</h4>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>将当前调优后的阈值固化为不可变规则版本，可供案件工作台调用。</p>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div>
                <label htmlFor="policy-version-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>策略版本号 (ID)</label>
                <input
                  id="policy-version-input"
                  onChange={(e) => setNewVersion(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  type="text"
                  value={newVersion}
                />
              </div>
              <div>
                <label htmlFor="policy-name-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>策略名称</label>
                <input
                  id="policy-name-input"
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  type="text"
                  value={newName}
                />
              </div>
              <div>
                <label htmlFor="policy-desc-input" style={{ fontSize: '0.85rem', fontWeight: 600 }}>描述说明</label>
                <textarea
                  id="policy-desc-input"
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                  value={newDesc}
                />
              </div>

              {saveSuccess && <div style={{ color: '#16a34a', fontSize: '0.85rem' }}>✓ 策略版本已成功保存并入库！</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="button button-secondary"
                  disabled={isSaving}
                  onClick={() => setShowSaveDialog(false)}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="button button-primary"
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? '保存中...' : '确认发布策略'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
