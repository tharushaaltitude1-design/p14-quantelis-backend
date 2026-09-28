import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

type ConfirmDialogProps = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
};

/** Shared confirmation for every destructive action, so prompts stay consistent. */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} size="narrow">
      <div className="confirm-body">
        <span className={`confirm-icon ${tone}`} aria-hidden="true">
          <AlertTriangle size={20} />
        </span>
        <p>{message}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
