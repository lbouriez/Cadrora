import { useEffect, useId, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from './IconButton';
import { CloseIcon } from './Icons';
import { isTopModal, modalTabStops, registerModal } from './modalFocus';

/**
 * Accessible modal with focus trap, Escape close, and focus restoration.
 * Example: <Modal open title={t('title')} closeLabel={t('close')} onClose={close}>…</Modal>.
 */
export interface ModalProps {
  backdropClassName?: string;
  children: ReactNode;
  className?: string;
  closeLabel: string;
  onClose: () => void;
  open: boolean;
  style?: CSSProperties;
  title: string;
}

export function Modal({ backdropClassName = '', children, className = '', closeLabel, onClose, open, style, title }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const backdrop = backdropRef.current;
    if (dialog && backdrop) return registerModal(dialog, backdrop);
    return undefined;
  }, [open]);

  if (!open) return null;

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || !isTopModal(dialog)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = modalTabStops(dialog);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className={`modal-backdrop ${backdropClassName}`.trim()} ref={backdropRef}
      onMouseDown={(event) => event.target === event.currentTarget && dialogRef.current && isTopModal(dialogRef.current) && onClose()}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal ${className}`.trim()}
        onKeyDown={trapFocus}
        ref={dialogRef}
        role="dialog"
        style={style}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
