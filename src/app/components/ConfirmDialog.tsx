import type { ReactNode } from 'react';

import { Button } from './Button';
import { Modal } from './Modal';

/** Explicitly confirms a destructive or irreversible action. Example: <ConfirmDialog open title={t('delete')} … />. */
export interface ConfirmDialogProps {
  cancelLabel: string;
  children: ReactNode;
  closeLabel: string;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmVariant?: 'danger' | 'primary';
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}

export function ConfirmDialog({
  cancelLabel,
  children,
  closeLabel,
  confirmLabel,
  confirmDisabled = false,
  confirmVariant = 'danger',
  isConfirming = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmDialogProps) {
  return (
    <Modal closeLabel={closeLabel} onClose={onCancel} open={open} title={title}>
      <div className="confirm-dialog">
        <div className="confirm-dialog__content">{children}</div>
        <div className="confirm-dialog__actions">
          <Button disabled={isConfirming} onClick={onCancel} variant="secondary">{cancelLabel}</Button>
          <Button disabled={confirmDisabled || isConfirming} onClick={onConfirm} variant={confirmVariant}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
