'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navigation = [
  { label: 'Cases', href: '/cases', phase: undefined },
  { label: 'Review', href: undefined, phase: 'Phase 2' },
  { label: 'Policies', href: '/policies', phase: undefined },
  { label: 'Decision Lab', href: '/decision-lab', phase: undefined },
  { label: 'Benchmarks', href: undefined, phase: 'Phase 3' },
  { label: 'Failure Lab', href: undefined, phase: 'Phase 3' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span><strong>ResolveOps</strong><small>Decision operations</small></span>
        </Link>
        <nav aria-label="主导航" className="app-nav">
          {navigation.map((item) => {
            if (!item.href) {
              return (
                <span aria-disabled="true" className="nav-item nav-disabled" key={item.label}>
                  <span>{item.label}</span><small>{item.phase}</small>
                </span>
              );
            }
            const isActive = pathname ? (item.href === '/cases' ? pathname.startsWith('/cases') : pathname.startsWith(item.href)) : false;
            return (
              <Link className={`nav-item ${isActive ? 'nav-active' : ''}`} href={item.href} key={item.label}>
                <span>{item.label}</span>
                {isActive && <span className="nav-dot" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" aria-hidden="true" />
          <div><strong>Gateway server-side</strong><small>Live calls require credentials</small></div>
        </div>
      </aside>
      {children}
    </div>
  );
}
