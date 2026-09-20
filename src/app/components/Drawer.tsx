import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from './IconButton';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Focus-managed side dialog. Example: <Drawer open title={t('filters')} closeLabel={t('close')} onClose={close}>…</Drawer>. */
export interface DrawerProps {
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  open: boolean;
  side?: 'left' | 'right';
  title: string;
}

export function Drawer({ children, closeLabel, onClose, open, side = 'right', title }: DrawerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => previous?.focus();
  }, [open]);

  if (!open) return null;

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`drawer drawer--${side}`}
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="drawer__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton aria-label={closeLabel} onClick={onClose}>×</IconButton>
        </div>
        <div className="drawer__content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
