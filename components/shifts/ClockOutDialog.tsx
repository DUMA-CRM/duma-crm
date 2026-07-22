'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut } from 'lucide-react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { clockOut } from '@/lib/api/shifts.service';
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
      for (const key of ['shifts', 'location-stock', 'inventory-overview', 'inventory-forecast', 'low-stock-alerts']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast('success', 'Clocked out. Have a good one!');
      onClockedOut();
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'Could not clock out.'),
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
