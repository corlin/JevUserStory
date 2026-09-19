'use client';

import { useState } from 'react';

import type { CaseFixture } from '../src/domain/types';
import type { CaseEvaluationResult } from '../src/services/case-service';
import { AppShell } from './app-shell';
import { CaseFacts } from './case-facts';
import { DecisionTrace } from './decision-trace';
import { PolicyDecision } from './policy-decision';
import { StatusBadge } from './ui/status-badge';

export function CaseWorkspace({ caseFixture }: { caseFixture: CaseFixture }) {
  const [result, setResult] = useState<CaseEvaluationResult>();
  const [errorCode, setErrorCode] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function runEvaluation() {
    setLoading(true);
    setErrorCode(undefined);
    try {
      const response = await fetch(`/api/cases/${caseFixture.id}/evaluate`, { method: 'POST' });
      const payload = await response.json() as CaseEvaluationResult | { error?: { code?: string } };
      if (!response.ok || !('run' in payload)) {
        setResult(undefined);
        setErrorCode('error' in payload ? payload.error?.code ?? 'GATEWAY_UNAVAILABLE' : 'GATEWAY_UNAVAILABLE');
        return;
      }
      setResult(payload);
    } catch {
      setResult(undefined);
      setErrorCode('GATEWAY_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <main className="case-workspace">
        <header className="workspace-header">
          <div>
            <div className="workspace-labels"><StatusBadge tone="info">模拟商业数据</StatusBadge><span>{caseFixture.id}</span></div>
            <h1>{caseFixture.title}</h1>
            <p>{caseFixture.sliceTags.join(' · ')}</p>
          </div>
          <a className="back-link" href="/cases">← 返回案件队列</a>
        </header>
        <div className="workspace-columns">
          <div className="case-column">
            <CaseFacts caseFixture={caseFixture} />
            <PolicyDecision decision={result?.policyDecision} loading={loading} onEvaluate={runEvaluation} />
          </div>
          <DecisionTrace errorCode={errorCode} onRetry={runEvaluation} outcome={result?.run.outcome} />
        </div>
      </main>
    </AppShell>
  );
}
