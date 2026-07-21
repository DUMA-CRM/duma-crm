'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FormActions, inputClass, labelClass, selectClass } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getLocationStock } from '@/lib/api/inventory.service';
import {
  type StockTransfer,
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  getStockTransfers,
} from '@/lib/api/transfers.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const STATUS_META = {
  pending: { label: 'Pending', variant: 'warning' as const },
  completed: { label: 'Completed', variant: 'success' as const },
  cancelled: { label: 'Cancelled', variant: 'muted' as const },
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Line = { stockItemId: string; quantity: string };

// ── Batch create form ───────────────────────────────────────────────────────────

function CreateTransferForm({
  tenantId,
  locationId,
  initialStockItemId,
  onClose,
}: {
  tenantId: string;
  locationId: string;
  initialStockItemId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: locations = [] } = useQuery({ queryKey: ['locations', tenantId], queryFn: () => getLocationsByTenant(tenantId) });
  const { data: stock = [] } = useQuery({ queryKey: ['location-stock', locationId], queryFn: () => getLocationStock(locationId) });

  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  // Pre-seed the first line with the item the transfer was launched from.
  const [lines, setLines] = useState<Line[]>([{ stockItemId: initialStockItemId ?? '', quantity: '' }]);

  const stockable = stock.filter((s) => Number(s.quantity) > 0 && s.stockItem);
  const availableFor = (stockItemId: string) => Number(stockable.find((s) => s.stockItemId === stockItemId)?.quantity ?? 0);
  const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.quantity) <= availableFor(l.stockItemId));
  // Items already chosen on other lines shouldn't be selectable twice.
  const chosen = new Set(lines.map((l) => l.stockItemId).filter(Boolean));

  const from = locations.find((l) => l.id === locationId);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      createStockTransfer({
        fromLocationId: locationId,
        toLocationId,
        notes: notes || undefined,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast('success', 'Transfer created — complete it when the stock physically moves.');
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (toLocationId && validLines.length > 0) mutate();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>From</label>
          <div className={cn(inputClass, 'flex items-center bg-muted text-muted-foreground')}>{from?.name ?? 'Current location'}</div>
        </div>
        <div>
          <label className={labelClass}>To</label>
          <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} required className={selectClass}>
            <option value="">Select…</option>
            {locations
              .filter((l) => l.id !== locationId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Items</label>
        <div className="space-y-2">
          {lines.map((line, i) => {
            const available = availableFor(line.stockItemId);
            const over = line.stockItemId !== '' && Number(line.quantity) > available;
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={line.stockItemId}
                  onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, stockItemId: e.target.value } : l)))}
                  className={cn(selectClass, 'flex-1 min-w-0')}
                >
                  <option value="">Item…</option>
                  {stockable
                    .filter((s) => s.stockItemId === line.stockItemId || !chosen.has(s.stockItemId))
                    .map((s) => (
                      <option key={s.stockItemId} value={s.stockItemId}>
                        {s.stockItem!.name} — {Number(s.quantity)} {s.stockItem!.unit} available
                      </option>
                    ))}
                </select>
                <input
                  value={line.quantity}
                  onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))}
                  inputMode="decimal"
                  placeholder="Qty"
                  aria-label="Quantity"
                  className={cn(inputClass, 'w-24 text-right tabular-nums', over && 'border-destructive')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setLines(lines.length === 1 ? [{ stockItemId: '', quantity: '' }] : lines.filter((_, j) => j !== i))}
                  aria-label="Remove line"
                  className="text-muted-foreground/60 hover:text-destructive shrink-0"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setLines([...lines, { stockItemId: '', quantity: '' }])}
          className="mt-2 gap-1.5"
        >
          <Plus size={14} />
          Add item
        </Button>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={inputClass} />
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions onClose={onClose} isPending={isPending} disabled={!toLocationId || validLines.length === 0} submitLabel="Create Transfer" />
    </form>
  );
}

/** Batch transfer modal, launched from an item's detail sidebar (item pre-selected). */
export function TransferStockModal({
  tenantId,
  locationId,
  initialStockItemId,
  onClose,
}: {
  tenantId: string;
  locationId: string;
  initialStockItemId?: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Transfer Stock" onClose={onClose} className="max-w-xl">
      <CreateTransferForm tenantId={tenantId} locationId={locationId} initialStockItemId={initialStockItemId} onClose={onClose} />
    </Modal>
  );
}

// ── Per-item transfers list (sidebar section) ─────────────────────────────────────

/**
 * Transfers involving one stock item at its location, with inline complete/cancel
 * for pending ones. Rendered inside the item detail sidebar.
 */
export function ItemTransfersSection({ stockItemId, locationId }: { stockItemId: string; locationId: string }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<{ transfer: StockTransfer; action: 'complete' | 'cancel' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', locationId],
    queryFn: () => getStockTransfers({ locationId, limit: 50 }),
    enabled: !!locationId,
  });
  const transfers = (data?.data ?? []).filter((t) => t.lines.some((l) => l.stockItemId === stockItemId));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stock-transfers'] });
    qc.invalidateQueries({ queryKey: ['location-stock'] });
    qc.invalidateQueries({ queryKey: ['inventory-forecast'] });
  };

  const complete = useMutation({
    mutationFn: (id: string) => completeStockTransfer(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast('success', 'Transfer completed — stock moved.');
    },
    onError: (err) => {
      setConfirm(null);
      toast('error', err.message || 'Failed to complete the transfer.');
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => cancelStockTransfer(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
      toast('info', 'Transfer cancelled.');
    },
    onError: (err) => {
      setConfirm(null);
      toast('error', err.message || 'Failed to cancel.');
    },
  });

  const busy = complete.isPending || cancel.isPending;

  return (
    <section>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Transfers</p>
      {isLoading ? (
        <div className="bg-background rounded-2xl border border-border overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="h-13 border-b border-border/50 last:border-0 animate-pulse" />
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-background rounded-2xl border border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">No transfers for this item yet</p>
        </div>
      ) : (
        <div className="bg-background rounded-2xl border border-border overflow-hidden">
          {transfers.map((t) => {
            const meta = STATUS_META[t.status];
            const outgoing = t.fromLocationId === locationId;
            const qty = t.lines.find((l) => l.stockItemId === stockItemId)?.quantity;
            const unit = t.lines.find((l) => l.stockItemId === stockItemId)?.stockItem?.unit ?? '';
            return (
              <div key={t.id} className="px-3 py-2.5 border-b border-border/50 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
                    <span className="truncate">{t.fromLocation?.name}</span>
                    <ArrowRight size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
                    <span className="truncate">{t.toLocation?.name}</span>
                  </span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-[11px] text-muted-foreground">
                    <span className={cn('font-semibold', outgoing ? 'text-warning' : 'text-success')}>{outgoing ? 'Outgoing' : 'Incoming'}</span>
                    {qty != null && ` · ${Number(qty)} ${unit}`} · {fmtDateTime(t.createdAt)}
                  </p>
                  {t.status === 'pending' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setConfirm({ transfer: t, action: 'complete' })}
                        disabled={busy}
                        className="h-7 px-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => setConfirm({ transfer: t, action: 'cancel' })}
                        disabled={busy}
                        className="h-7 px-2 rounded-lg border border-destructive/30 text-destructive text-[11px] font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirm?.action === 'complete' && (
        <ConfirmModal
          title="Complete Transfer"
          message={<>Move the stock now? The sender is deducted and the receiver credited immediately.</>}
          isPending={complete.isPending}
          onConfirm={() => complete.mutate(confirm.transfer.id)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.action === 'cancel' && (
        <ConfirmModal
          title="Cancel Transfer"
          message={<>Cancel this transfer? No stock has moved yet.</>}
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate(confirm.transfer.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </section>
  );
}
