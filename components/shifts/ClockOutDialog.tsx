'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Loader2, LogOut } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { clockOut } from '@/lib/modules/workforce/client';
import { toast } from '@/stores/toastStore';

interface ClockOutDialogProps {
  locationId: string;
  shiftId?: string;
  onClose: () => void;
  onClockedOut: () => void;
}

// Recipe inventory is consumed as each order reaches `done`, so clock-out no
// longer owns a second, competing stock deduction workflow.
export function ClockOutDialog({ locationId, onClose, onClockedOut }: ClockOutDialogProps) {
  const queryClient = useQueryClient();
  const finish = useMutation({
    mutationFn: () => clockOut({ locationId }),
    onSuccess: () => {
      const affectedQueries = [
        moduleQueryKeys.workforce.key('shifts'),
        moduleQueryKeys.inventory.key('location-stock'),
        moduleQueryKeys.inventory.key('inventory-overview'),
        moduleQueryKeys.inventory.key('inventory-forecast'),
        moduleQueryKeys.inventory.key('low-stock-alerts'),
      ];
      for (const queryKey of affectedQueries) {
        void queryClient.invalidateQueries({ queryKey });
      }
      toast('success', 'Clocked out. Have a good one!');
      onClockedOut();
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'You weren’t clocked out. Try again before leaving.'),
  });

  return (
    <Modal title="End of Shift" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Inventory has already been consumed from physical stock units as completed orders were served.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={finish.isPending} className="flex-1 h-11">
            Cancel
          </Button>
          <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="flex-1 h-11 gap-2">
            {finish.isPending ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
            Clock Out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
