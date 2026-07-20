'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowLeftRight, MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { FormActions, inputClass, labelClass, selectClass } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STATUS_META = {
  pending: { label: 'Pending', variant: 'warning' as const },
  completed: { label: 'Completed', variant: 'success' as const },
  cancelled: { label: 'Cancelled', variant: 'muted' as const },
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// ── Create ────────────────────────────────────────────────────────────────────

function CreateTransferForm({ tenantId, locationId, onClose }: { tenantId: string; locationId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: locations = [] } = useQuery({ queryKey: ['locations', tenantId], queryFn: () => getLocationsByTenant(tenantId) });
  const { data: stock = [] } = useQuery({ queryKey: ['location-stock', locationId], queryFn: () => getLocationStock(locationId) });

  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ stockItemId: string; quantity: string }[]>([{ stockItemId: '', quantity: '' }]);

  const stockable = stock.filter((s) => Number(s.quantity) > 0 && s.stockItem);
  const availableFor = (stockItemId: string) => Number(stockable.find((s) => s.stockItemId === stockItemId)?.quantity ?? 0);
  const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.quantity) <= availableFor(l.stockItemId));

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
                  {stockable.map((s) => (
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
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
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

// ── Detail ────────────────────────────────────────────────────────────────────

function TransferDetail({ transfer, onClose }: { transfer: StockTransfer; onClose: () => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['stock-transfers'] });
    qc.invalidateQueries({ queryKey: ['location-stock'] });
  };

  const complete = useMutation({
    mutationFn: () => completeStockTransfer(transfer.id),
    onSuccess: () => {
      invalidate();
      toast('success', 'Transfer completed — stock moved.');
      onClose();
    },
    onError: (err) => {
      setConfirm(null);
      toast('error', err.message || 'Failed to complete the transfer.');
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelStockTransfer(transfer.id),
    onSuccess: () => {
      invalidate();
      toast('info', 'Transfer cancelled.');
      onClose();
    },
    onError: (err) => toast('error', err.message || 'Failed to cancel.'),
  });

  const meta = STATUS_META[transfer.status];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {transfer.fromLocation?.name}
          <ArrowRight size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
          {transfer.toLocation?.name}
        </p>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Created {fmtDateTime(transfer.createdAt)}
        {transfer.createdByUser?.name ? ` by ${transfer.createdByUser.name}` : ''}
        {transfer.completedAt ? ` · completed ${fmtDateTime(transfer.completedAt)}` : ''}
      </p>

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((l) => (
              <tr key={l.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-medium text-foreground">{l.stockItem?.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Number(l.quantity)} {l.stockItem?.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transfer.notes && <p className="text-xs text-muted-foreground">{transfer.notes}</p>}

      <div className="flex gap-2">
        {transfer.status === 'pending' && (
          <>
            <Button onClick={() => setConfirm('complete')} className="flex-1 h-11">
              Complete Transfer
            </Button>
            <Button variant="outline" onClick={() => setConfirm('cancel')} className="h-11 text-destructive hover:text-destructive">
              Cancel
            </Button>
          </>
        )}
        <Button variant="outline" onClick={onClose} className="h-11">
          Close
        </Button>
      </div>

      {confirm === 'complete' && (
        <ConfirmModal
          title="Complete Transfer"
          message={<>Move the stock now? The sender is deducted and the receiver credited immediately.</>}
          isPending={complete.isPending}
          onConfirm={() => complete.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'cancel' && (
        <ConfirmModal
          title="Cancel Transfer"
          message={<>Cancel this transfer? No stock has moved yet.</>}
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransfersPage() {
  const { tenantId, locationId } = useWorkspaceStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<StockTransfer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-transfers', locationId],
    queryFn: () => getStockTransfers({ locationId: locationId ?? undefined, limit: 50 }),
    enabled: !!locationId,
  });
  const transfers = data?.data ?? [];

  return (
    <PageLayout
      eyebrow="Operations"
      title="Stock Transfers"
      fullHeight
      headerBorder={false}
      headerSlot={
        tenantId && locationId ? (
          <div className="flex justify-end">
            <button
              onClick={() => setCreateOpen(true)}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Plus size={15} />
              New Transfer
            </button>
          </div>
        ) : undefined
      }
    >
      {!locationId || !tenantId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to manage transfers." />
      ) : (
        <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : transfers.length === 0 ? (
              <div className="py-24">
                <EmptyState
                  icon={ArrowLeftRight}
                  title="No transfers"
                  description="Move stock between locations — create one when another site runs low."
                />
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-border bg-muted">
                    <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Direction</th>
                    <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Items</th>
                    <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created</th>
                    <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => {
                    const meta = STATUS_META[t.status];
                    const outgoing = t.fromLocationId === locationId;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => setDetail(t)}
                        className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                      >
                        <td className="px-3 md:px-5 py-3.5">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            {t.fromLocation?.name}
                            <ArrowRight size={13} className="text-muted-foreground shrink-0" aria-hidden="true" />
                            {t.toLocation?.name}
                          </span>
                          <span className={cn('text-[11px] font-semibold', outgoing ? 'text-warning' : 'text-success')}>
                            {outgoing ? 'Outgoing' : 'Incoming'}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3.5 text-muted-foreground tabular-nums">
                          {t.lines.length} {t.lines.length === 1 ? 'item' : 'items'}
                        </td>
                        <td className="hidden md:table-cell px-5 py-3.5 text-muted-foreground tabular-nums">{fmtDateTime(t.createdAt)}</td>
                        <td className="px-3 md:px-5 py-3.5">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {createOpen && (
            <Modal title="New Transfer" onClose={() => setCreateOpen(false)} className="max-w-xl">
              <CreateTransferForm tenantId={tenantId} locationId={locationId} onClose={() => setCreateOpen(false)} />
            </Modal>
          )}
          {detail && (
            <Modal title="Stock Transfer" onClose={() => setDetail(null)} className="max-w-xl">
              <TransferDetail transfer={detail} onClose={() => setDetail(null)} />
            </Modal>
          )}
        </div>
      )}
    </PageLayout>
  );
}
