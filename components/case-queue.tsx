'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { CaseFixture } from '../src/domain/types';

type LanguageFilter = 'all' | CaseFixture['language'];

export function CaseQueue({ cases }: { cases: readonly CaseFixture[] }) {
  const [language, setLanguage] = useState<LanguageFilter>('all');
  const visibleCases = useMemo(
    () => language === 'all' ? cases : cases.filter((caseFixture) => caseFixture.language === language),
    [cases, language],
  );

  return (
    <>
      <div className="queue-filters" aria-label="案件语言筛选">
        <button aria-pressed={language === 'all'} onClick={() => setLanguage('all')} type="button">全部案件</button>
        <button aria-pressed={language === 'zh-CN'} onClick={() => setLanguage('zh-CN')} type="button">中文案件</button>
        <button aria-pressed={language === 'en'} onClick={() => setLanguage('en')} type="button">English</button>
        <span>{visibleCases.length} shown</span>
      </div>
      <div className="case-table-wrap">
        <table className="case-table">
          <thead><tr><th>Case</th><th>Customer request</th><th>Signals</th><th>Language</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>
            {visibleCases.map((caseFixture) => (
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
    </>
  );
}
