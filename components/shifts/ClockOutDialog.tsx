'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, Scale } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { createDeductionBatch, getPendingDeductions } from '@/lib/api/deductions.service';
import { clockOut } from '@/lib/api/shifts.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

interface ClockOutDialogProps {
  locationId: string;
  shiftId?: string;
  onClose: () => void;
  /** Called after a successful clock-out so the parent can refresh its queries. */
  onClockedOut: () => void;
}

/**
 * End-of-shift reconciliation + clock-out. Shows the recipe-derived suggested
 * stock deduction for the shift's sales; staff adjust for the human factor
 * (spills, remakes, comps) and apply it, or decline — either way the decision
 * is recorded for admin monitoring, then the shift is clocked out.
 */
export function ClockOutDialog({ locationId, shiftId, onClose, onClockedOut }: ClockOutDialogProps) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['pending-deductions', locationId],
    queryFn: () => getPendingDeductions(locationId),
  });
  const lines = data?.lines ?? [];

  // Staff adjustments keyed by stock item; unset = suggested amount.
  const [adjusted, setAdjusted] = useState<Record<string, string>>({});
  const valueFor = (stockItemId: string, suggested: number) => adjusted[stockItemId] ?? String(suggested);

  const finish = useMutation({
    mutationFn: async (action: 'applied' | 'declined' | 'skip') => {
      if (action !== 'skip' && lines.length > 0) {
        await createDeductionBatch({
          locationId,
          shiftId,
          status: action,
          lines:
            action === 'applied'
              ? lines.map((l) => ({ stockItemId: l.stockItemId, deductedQty: Math.max(0, Number(valueFor(l.stockItemId, l.suggestedQty)) || 0) }))
              : undefined,
        });
      }
      return clockOut({ locationId });
    },
    onSuccess: (_shift, action) => {
      for (const key of ['pending-deductions', 'deduction-batches', 'location-stock', 'inventory-forecast', 'low-stock-alerts']) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      toast(
        'success',
        action === 'applied'
          ? 'Stock deducted and shift ended. Have a good one!'
          : action === 'declined'
            ? 'Deduction declined — usage stays pending. Shift ended.'
            : 'Clocked out. Have a good one!',
      );
      onClockedOut();
      onClose();
    },
    onError: (err) => toast('error', (err as Error).message || 'Could not clock out.'),
  });

  const busy = finish.isPending;

  return (
    <Modal title="End of Shift" onClose={onClose} className={lines.length > 0 ? 'max-w-xl' : undefined}>
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : lines.length === 0 ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">No unreconciled ingredient usage — you&apos;re all set. Clock out now?</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1 h-11">
              Cancel
            </Button>
            <Button onClick={() => finish.mutate('skip')} disabled={busy} className="flex-1 h-11 gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Clock Out
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5">
            <Scale size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Based on the shift&apos;s sales, here&apos;s the suggested stock deduction. Adjust any amounts to match reality (spills,
              remakes, comps), then apply — or decline and leave it for the next shift.
            </p>
          </div>

          {/* Suggested lines with adjustable quantities */}
          <div className="max-h-72 overflow-y-auto -mr-2 pr-2 space-y-1.5">
            {lines.map((line) => {
              const value = valueFor(line.stockItemId, line.suggestedQty);
              const changed = Number(value) !== line.suggestedQty;
              return (
                <div key={line.stockItemId} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{line.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Suggested {line.suggestedQty} {line.unit} · from {line.orderCount} {line.orderCount === 1 ? 'order' : 'orders'} · on
                      hand {line.currentQuantity}
                    </p>
                  </div>
                  <input
                    value={value}
                    onChange={(e) => setAdjusted((prev) => ({ ...prev, [line.stockItemId]: e.target.value }))}
                    inputMode="decimal"
                    aria-label={`Deduct ${line.name}`}
                    className={cn(
                      'w-24 h-10 bg-background border rounded-lg px-3 text-sm text-right tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow]',
                      changed ? 'border-warning' : 'border-border',
                    )}
                  />
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{line.unit}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={() => finish.mutate('applied')} disabled={busy} className="w-full h-12 gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Apply Deduction &amp; Clock Out
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy} className="flex-1 h-10">
                Cancel
              </Button>
              <Button variant="outline" onClick={() => finish.mutate('declined')} disabled={busy} className="flex-1 h-10 text-muted-foreground">
                Decline &amp; Clock Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
