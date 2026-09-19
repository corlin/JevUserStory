import { AppShell } from '../../components/app-shell';
import { CaseQueue } from '../../components/case-queue';
import { StatusBadge } from '../../components/ui/status-badge';
import { DEMO_CASES } from '../../src/fixtures/cases';

export default function CasesPage() {
  return (
    <AppShell>
      <main className="queue-page">
        <header className="queue-header">
          <div><p className="eyebrow">Operational workspace</p><h1>Case queue</h1><p>用真实 Jev 判断处理一组完全模拟的商业案件。</p></div>
          <div className="queue-count"><strong>{DEMO_CASES.length}</strong><span>demo cases</span></div>
        </header>
        <div className="queue-notice"><StatusBadge tone="info">模拟商业数据</StatusBadge><span>所有客户、订单、付款和退款操作均为演示数据。</span></div>
        <CaseQueue cases={DEMO_CASES} />
      </main>
    </AppShell>
  );
}
