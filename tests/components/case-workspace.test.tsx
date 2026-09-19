import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
}));
vi.mock('next/navigation', () => ({ notFound }));

import CasePage from '../../app/cases/[caseId]/page';
import { CaseWorkspace } from '../../components/case-workspace';
import { ReviewForm } from '../../components/review-form';
import { getDemoCase } from '../../src/fixtures/cases';

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
});
