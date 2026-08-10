'use client';

import { Drawer } from '@/components/shared/Drawer';

interface ConfirmDrawerProps {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * `ConfirmModal`'s slide-over twin — same contract, for surfaces that use drawers
 * throughout (inventory). Deliberately narrower than a standard drawer: these
 * often open on top of another one, and the extra inset keeps the panel
 * underneath visible so the stack reads as depth rather than a swap.
 */
export function ConfirmDrawer({
  title,
  message,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDrawerProps) {
  return (
    <Drawer
      title={title}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-sm border border-rule text-sm font-medium text-muted-foreground transition-colors hover:bg-band"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-10 flex-1 rounded-sm bg-destructive text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </Drawer>
  );
}
