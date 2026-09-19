import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
}));
vi.mock('next/navigation', () => ({
  notFound,
  usePathname: () => '/cases/DEMO-001',
}));

import CasePage from '../../app/cases/[caseId]/page';
import { CaseWorkspace } from '../../components/case-workspace';
import { CaseQueue } from '../../components/case-queue';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { ReviewForm } from '../../components/review-form';
import { getDemoCase } from '../../src/fixtures/cases';
import type { CaseWorkspaceState } from '../../src/services/case-service';

afterEach(() => {
  cleanup();
  notFound.mockClear();
});

describe('case workspace', () => {
  it('visibly labels demo data, simulated operations, and future destinations', () => {
    render(<CaseWorkspace caseFixture={getDemoCase('DEMO-001')!} />);

    expect(screen.getAllByText('模拟商业数据').length).toBeGreaterThan(0);
    expect(screen.getByText('模拟操作 · 不执行真实退款')).toBeTruthy();
    expect(screen.getByRole('button', { name: '运行 Jev 评估' })).toBeTruthy();
    expect(screen.getByText('Decision Lab')).toBeTruthy();
    expect(screen.getAllByText(/Phase [23]/).length).toBeGreaterThan(0);
  });

  it('uses the Next.js not-found boundary for unknown case IDs', async () => {
    await expect(CasePage({ params: Promise.resolve({ caseId: 'DEMO-999' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledOnce();
  });

  it('exposes confirm, modify, escalate, and reject review actions', () => {
    render(<ReviewForm caseId="DEMO-001" maximumRefundCents={4900} />);
    expect(screen.getByRole('button', { name: '确认退款' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '修改退款' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '升级处理' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '拒绝退款' })).toBeTruthy();
  });

  it('filters the queue by language', () => {
    render(<CaseQueue cases={DEMO_CASES} />);
    fireEvent.click(screen.getByRole('button', { name: '中文案件' }));
    expect(screen.queryByText('DEMO-001', { exact: true })).toBeNull();
    expect(screen.getAllByText('zh-CN').length).toBeGreaterThan(0);
  });

  it('hydrates the persisted audit state after navigation or refresh', () => {
    const initialState: CaseWorkspaceState = {
      run: {
        id: 'run-1', caseId: 'DEMO-001', modelId: 'typesafe-ai/jev', questionVersion: 'resolveops-questions-v1',
        outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' }, usage: {}, latencyMs: 10,
        createdAt: '2026-09-20T00:00:00.000Z',
      },
      policyDecision: {
        id: 'policy-1', runId: 'run-1', action: 'review', reasonCodes: ['INVALID_EVALUATION_RESPONSE'],
        proposedRefundCents: 0, policyVersion: 'resolveops-policy-v1', createdAt: '2026-09-20T00:00:01.000Z',
      },
      review: {
        id: 'review-1', caseId: 'DEMO-001', idempotencyKey: 'persisted-key', action: 'escalate',
        refundCents: 0, note: 'Persisted review', createdAt: '2026-09-20T00:00:02.000Z',
      },
      reply: {
        id: 'reply-1', caseId: 'DEMO-001', reviewId: 'review-1', draft: 'Persisted customer reply.',
        verification: {
          status: 'approved', reasonCodes: [],
          answers: {
            exceeds_approved_action: { probability: 0.01 },
            contradicts_refund_policy: { probability: 0.01 },
            exposes_internal_details: { probability: 0.01 },
          },
        },
        status: 'approved', createdAt: '2026-09-20T00:00:03.000Z',
      },
    };
    render(<CaseWorkspace caseFixture={getDemoCase('DEMO-001')!} initialState={initialState} />);
    expect(screen.getByText('Policy action: review')).toBeTruthy();
    expect(screen.getByText('模拟决定已记录；未执行真实退款')).toBeTruthy();
    expect(screen.getByText('Persisted customer reply.')).toBeTruthy();
  });
});
