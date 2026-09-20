import type { ReactNode } from 'react';

/** Short status label. Example: <Badge variant="success">{t('status.ready')}</Badge>. */
export interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
