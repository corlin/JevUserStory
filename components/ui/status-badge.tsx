import type { ReactNode } from 'react';

type StatusBadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
};

export function StatusBadge({ children, tone = 'neutral' }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}
