import Link from 'next/link';

import { AppShell } from '../../components/app-shell';
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
        <div className="case-table-wrap">
          <table className="case-table">
            <thead><tr><th>Case</th><th>Customer request</th><th>Signals</th><th>Language</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>
              {DEMO_CASES.map((caseFixture) => (
                <tr key={caseFixture.id}>
                  <td><strong>{caseFixture.id}</strong><span>{caseFixture.title}</span></td>
                  <td>{caseFixture.customer.message}</td>
                  <td><div className="tag-list">{caseFixture.sliceTags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div></td>
                  <td>{caseFixture.language}</td>
                  <td><Link aria-label={`打开 ${caseFixture.id}`} className="row-link" href={`/cases/${caseFixture.id}`}>→</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
