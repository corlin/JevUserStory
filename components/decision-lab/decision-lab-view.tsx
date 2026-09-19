'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalibrationChart } from '../metrics/calibration-chart';
import { ConfusionMatrix } from '../metrics/confusion-matrix';
import { CoverageRiskChart } from '../metrics/coverage-risk-chart';
import { PerformanceSummary } from '../metrics/performance-summary';
import { PolicySimulator } from './policy-simulator';
import { StatusBadge } from '../ui/status-badge';
import type {
  CaseFixture,
  ExperimentCaseResultRecord,
  ExperimentRecord,
  PolicyThresholds,
} from '../../src/domain/types';
import { calculateExperimentMetrics } from '../../src/metrics/metrics-engine';
import { filterCasesBySlice } from '../../src/domain/slices';

type DecisionLabViewProps = {
  initialExperiment: ExperimentRecord;
  initialResults: ExperimentCaseResultRecord[];
  allCases: readonly CaseFixture[];
  activePolicyThresholds?: PolicyThresholds;
};

const SLICE_FILTERS = [
  { id: 'all', label: '全部案件 (30 案)' },
  { id: 'language:zh-CN', label: '中文案件 (12 案)' },
  { id: 'language:en', label: '英文案件 (18 案)' },
  { id: 'tag:prompt-injection', label: '提示注入攻击 (2 案)' },
  { id: 'tag:ambiguous', label: '多意图歧义 (2 案)' },
] as const;

const EXPERIMENT_ERROR_MESSAGES: Record<string, string> = {
  GATEWAY_AUTHENTICATION_FAILED: 'Gateway 凭据无效或未配置，请检查服务端 AI_GATEWAY_API_KEY。',
  GATEWAY_MODEL_RESTRICTED: '当前 Gateway 凭据没有 Jev 模型访问权限。',
  GATEWAY_RATE_LIMITED: 'Gateway 已限流，请稍后重试。',
  GATEWAY_TIMEOUT: 'Gateway 调用超时，请缩小切片后重试。',
  GATEWAY_UNAVAILABLE: 'Gateway 暂时不可用，请稍后重试。',
  INVALID_EVALUATION_RESPONSE: 'Gateway 返回了无法验证的评测结果，本次运行未标记为 Live Measured。',
  INVALID_EXPERIMENT_PAYLOAD: '评测配置无效，请刷新页面后重试。',
};

async function readPublicError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => undefined) as { error?: { code?: string } } | undefined;
  const code = body?.error?.code;
  return code ? (EXPERIMENT_ERROR_MESSAGES[code] ?? `${fallback}（${code}）`) : fallback;
}

export function DecisionLabView({
  initialExperiment,
  initialResults,
  allCases,
  activePolicyThresholds,
}: DecisionLabViewProps) {
  const [currentExperiment, setCurrentExperiment] = useState<ExperimentRecord>(initialExperiment);
  const [currentResults, setCurrentResults] = useState<ExperimentCaseResultRecord[]>(initialResults);
  const [selectedSlice, setSelectedSlice] = useState<string>('all');
  const [isRunningLive, setIsRunningLive] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Filter cases and results based on selected slice
  const filteredCases = useMemo(() => {
    return filterCasesBySlice(allCases, selectedSlice);
  }, [allCases, selectedSlice]);

  const filteredResults = useMemo(() => {
    const caseIds = new Set(filteredCases.map((c) => c.id));
    return currentResults.filter((r) => caseIds.has(r.caseId));
  }, [currentResults, filteredCases]);

  const metrics = useMemo(() => {
    return calculateExperimentMetrics(currentExperiment.id, filteredResults);
  }, [currentExperiment.id, filteredResults]);

  const handleRunExperiment = async (sourceType: 'baseline' | 'live') => {
    setIsRunningLive(true);
    setNotification(sourceType === 'live' ? '正在调用 AI Gateway 运行真实评测...' : '正在重新生成基准评测...');
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetSlice: selectedSlice, sourceType }),
      });
      if (!res.ok) {
        setNotification(await readPublicError(res, '评测执行失败，请检查网络或配置。'));
        return;
      }
      const data = await res.json();
      // Fetch new experiment details
      const detailRes = await fetch(`/api/experiments/${data.experiment.id}`);
      if (!detailRes.ok) {
        setNotification(await readPublicError(detailRes, '评测已执行，但结果读取失败。'));
        return;
      }
      const detail = await detailRes.json();
      setCurrentExperiment(detail.experiment);
      setCurrentResults(detail.results);
      setNotification(sourceType === 'live' ? '✓ 真实 Gateway 评测已完成并入库！' : '✓ 基准评测已刷新！');
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification('评测执行失败，请检查网络或配置。');
    } finally {
      setIsRunningLive(false);
    }
  };

  const handleSavePolicy = async (newPolicy: {
    version: string;
    name: string;
    description: string;
    thresholds: PolicyThresholds;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined) as { error?: { code?: string } } | undefined;
        const code = body?.error?.code;
        setNotification(code === 'POLICY_VERSION_EXISTS'
          ? `策略版本 ${newPolicy.version} 已存在；历史快照不可覆盖，请换一个版本号。`
          : '策略保存失败，请检查版本号和阈值。');
        return false;
      }
      setNotification(`✓ 新策略版本 ${newPolicy.version} 已成功入库！`);
      setTimeout(() => setNotification(null), 3000);
      return true;
    } catch {
      setNotification('策略保存失败，请检查网络后重试。');
      return false;
    }
  };

  return (
    <main className="queue-page">
      {/* Header */}
      <header className="queue-header">
        <div>
          <p className="eyebrow">Evaluation & Policy Simulation</p>
          <h1>Decision Lab</h1>
          <p>基于 Jev 类型化判断进行模型校准、多维切片下钻与零 Token 成本策略模拟。</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {currentExperiment.sourceType === 'live' ? (
              <span className="status-badge status-auto" title="数据来源于 Vercel AI Gateway 真实模型调用">
                ● Live Measured (Jev)
              </span>
            ) : (
              <span className="status-badge status-info" title="数据来源于确定性基准快照">
                ◈ Pre-evaluated Baseline
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {currentExperiment.id}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="button button-secondary"
              disabled={isRunningLive}
              onClick={() => handleRunExperiment('baseline')}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              type="button"
            >
              刷新基准数据
            </button>
            <button
              className="button button-primary"
              disabled={isRunningLive}
              onClick={() => handleRunExperiment('live')}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              type="button"
            >
              {isRunningLive ? '评测中...' : '运行实时评测 (Live Jev)'}
            </button>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div aria-live="polite" role="status" style={{ margin: '1rem 0', padding: '0.75rem 1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '0.85rem' }}>
          {notification}
        </div>
      )}

      {/* Slice Filter Buttons */}
      <div className="queue-notice" style={{ margin: '1.25rem 0 0.75rem 0' }}>
        <StatusBadge tone="info">多维切片下钻 (Slicing)</StatusBadge>
        <span>选择特定子集观察模型的局部校准与脆弱点（Jaggedness）：</span>
      </div>

      <div className="queue-filters" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        {SLICE_FILTERS.map((filter) => {
          const isSelected = selectedSlice === filter.id;
          return (
            <button
              aria-pressed={isSelected}
              key={filter.id}
              onClick={() => setSelectedSlice(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          );
        })}
        <span>当前切片样本: <strong>{filteredCases.length}</strong> 案</span>
      </div>

      {/* Metric Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
        <div className="card" style={{ padding: '1rem', background: 'var(--paper)' }}>
          <small style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>部门路由 Accuracy</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {Math.round((metrics.choiceMetrics.department?.accuracy ?? 0) * 100)}%
          </div>
          <small style={{ color: '#16a34a' }}>Macro-F1: {Math.round((metrics.choiceMetrics.department?.macroF1 ?? 0) * 100)}%</small>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'var(--paper)' }}>
          <small style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>退款意图校准误差 (ECE)</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {((metrics.booleanMetrics.refund_requested?.ece ?? 0) * 100).toFixed(1)}%
          </div>
          <small style={{ color: '#2563eb' }}>越高代表概率越失准</small>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'var(--paper)' }}>
          <small style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>证据质量评分 MAE</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {(metrics.scoreMetrics.evidence_quality?.mae ?? 0).toFixed(2)}
          </div>
          <small style={{ color: '#0284c7' }}>相差≤1档准确率: {Math.round((metrics.scoreMetrics.evidence_quality?.withinOneAccuracy ?? 0) * 100)}%</small>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'var(--paper)' }}>
          <small style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>策略自动处理率</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: '#16a34a' }}>
            {Math.round((metrics.business.autoRate ?? 0) * 100)}%
          </div>
          <small style={{ color: 'var(--muted)' }}>{metrics.business.autoCount} / {metrics.totalCases} 案</small>
        </div>

        <div className="card" style={{ padding: '1rem', background: 'var(--paper)' }}>
          <small style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>人工审核与阻止率</small>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.25rem', color: '#dc2626' }}>
            {Math.round(((metrics.business.reviewRate ?? 0) + (metrics.business.blockRate ?? 0)) * 100)}%
          </div>
          <small style={{ color: '#dc2626' }}>阻断: {metrics.business.blockCount} 案</small>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', margin: '1.5rem 0' }}>
        {metrics.booleanMetrics.refund_requested && (
          <CalibrationChart metric={metrics.booleanMetrics.refund_requested} title="退款意图校准图 (ECE Reliability)" />
        )}
        {metrics.choiceMetrics.department && (
          <ConfusionMatrix metric={metrics.choiceMetrics.department} title="部门路由分类准确度" />
        )}
        <CoverageRiskChart
          autoRate={metrics.business.autoRate}
          blockRate={metrics.business.blockRate}
          falseAutomationRate={metrics.business.falseAutomationRate}
          reviewRate={metrics.business.reviewRate}
        />
        <PerformanceSummary performance={metrics.performance} />
      </div>

      {/* Policy Simulator Section */}
      <PolicySimulator
        cases={filteredCases}
        initialThresholds={activePolicyThresholds}
        onSavePolicy={handleSavePolicy}
        results={filteredResults}
      />

      {/* Case Details Breakdown Table */}
      <div style={{ marginTop: '2rem' }}>
        <h3>切片案件清单与预测核验</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: '0.25rem 0 0.75rem 0' }}>
          观察模型对每个具体案件的预测与 Ground Truth，点击可一键下钻到单案工作台：
        </p>

        <div className="case-table-wrap">
          <table className="case-table">
            <thead>
              <tr>
                <th>案件</th>
                <th>语言</th>
                <th>建议动作</th>
                <th>退款意图预测 (P / GT)</th>
                <th>提示注入检测 (P / GT)</th>
                <th>证据质量 (Pred / GT)</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((c) => {
                const r = filteredResults.find((res) => res.caseId === c.id);
                const refundP = r?.answers.refund_requested?.type === 'boolean' ? `${Math.round(r.answers.refund_requested.probability * 100)}%` : '-';
                const refundGT = c.groundTruth.refund_requested ? 'Yes' : 'No';
                const injectP = r?.answers.prompt_injection?.type === 'boolean' ? `${Math.round(r.answers.prompt_injection.probability * 100)}%` : '-';
                const injectGT = c.groundTruth.prompt_injection ? 'Yes' : 'No';
                const evidencePred = r?.answers.evidence_quality?.type === 'score' ? r.answers.evidence_quality.score : '-';
                const evidenceGT = c.groundTruth.evidence_quality;

                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.id}</strong> · {c.title}
                      <span>{c.customer.name} ({c.customer.tier})</span>
                    </td>
                    <td><StatusBadge tone="neutral">{c.language}</StatusBadge></td>
                    <td>
                      <StatusBadge tone={r?.policyAction === 'auto' ? 'success' : r?.policyAction === 'block' ? 'danger' : 'warning'}>
                        {r?.policyAction ?? 'pending'}
                      </StatusBadge>
                    </td>
                    <td><strong>{refundP}</strong> <span style={{ color: 'var(--muted)' }}>/ {refundGT}</span></td>
                    <td><strong>{injectP}</strong> <span style={{ color: 'var(--muted)' }}>/ {injectGT}</span></td>
                    <td><strong>{evidencePred}</strong> <span style={{ color: 'var(--muted)' }}>/ {evidenceGT}</span></td>
                    <td>
                      <Link className="row-link" href={`/cases/${c.id}`} title="前往案件工作台">
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
