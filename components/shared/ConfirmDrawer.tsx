'use client';

import { TriangleAlert } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';

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
      icon={TriangleAlert}
      title={title}
      onClose={onClose}
      className="max-w-md"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending} className="flex-1">
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </Drawer>
  );
}
