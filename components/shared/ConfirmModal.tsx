'use client';

import { Modal } from '@/components/shared/Modal';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Small destructive-action confirmation, styled like the app's other modals. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
