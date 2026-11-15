'use client';

import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  /**
   * Ask for this text to be typed before confirming — for a step that loses
   * money or files, where a reflex click is not enough.
   */
  confirmText?: string;
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
  confirmText,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const matched = !confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">{message}</div>
        {confirmText && (
          <label className="block text-sm text-foreground">
            Type <span className="font-semibold">{confirmText}</span> to confirm
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-control px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30"
            />
          </label>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 rounded-md border border-edge bg-field text-sm font-semibold text-foreground hover:bg-band transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || !matched}
            className="flex-1 h-9 rounded-md bg-destructive hover:bg-destructive/90 text-on-fill text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
