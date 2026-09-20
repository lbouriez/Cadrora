import { useId } from 'react';
import type { ReactNode } from 'react';

/** Empty collection explanation. Example: <EmptyState title={t('events.empty')} action={<Button>…</Button>} />. */
export interface EmptyStateProps {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
}

export function EmptyState({ action, description, title }: EmptyStateProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="empty-state">
      <h2 className="empty-state__title" id={titleId}>{title}</h2>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
