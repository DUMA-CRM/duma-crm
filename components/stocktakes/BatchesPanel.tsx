'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { FormActions, inputClass, labelClass, selectClass } from '@/components/purchasing/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { getStockItems } from '@/lib/api/inventory.service';
import { type StockBatch, createStockBatch, deleteStockBatch, getStockBatches, updateStockBatch } from '@/lib/api/stocktakes.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const DAY_MS = 86_400_000;

function expiryMeta(iso: string): { label: string; className: string } {
  const days = Math.floor((new Date(iso).getTime() - Date.now()) / DAY_MS);
  const date = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (days < 0) return { label: `${date} — expired`, className: 'text-destructive font-semibold' };
  if (days === 0) return { label: `${date} — today`, className: 'text-destructive font-semibold' };
  if (days <= 3) return { label: `${date} — ${days}d left`, className: 'text-warning font-semibold' };
  return { label: date, className: 'text-foreground' };
}

function BatchForm({ locationId, batch, onClose }: { locationId: string; batch?: StockBatch; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: stockItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const [stockItemId, setStockItemId] = useState(batch?.stockItemId ?? '');
  const [quantity, setQuantity] = useState(batch ? String(Number(batch.quantity)) : '');
  const [expiryDate, setExpiryDate] = useState(batch ? batch.expiryDate.slice(0, 10) : '');
  const [notes, setNotes] = useState(batch?.notes ?? '');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      batch
        ? updateStockBatch(batch.id, { quantity: Number(quantity), expiryDate, notes: notes || undefined })
        : createStockBatch({ locationId, stockItemId, quantity: Number(quantity), expiryDate, notes: notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-batches'] });
      toast('success', batch ? 'Batch updated.' : 'Batch added.');
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      {!batch && (
        <div>
          <label className={labelClass}>Stock item</label>
          <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} required className={selectClass}>
            <option value="">Select…</option>
            {stockItems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.unit})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} required inputMode="decimal" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expiry date</label>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional (e.g. fridge 2)" className={inputClass} />
      </div>
      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions onClose={onClose} isPending={isPending} submitLabel={batch ? 'Update' : 'Add Batch'} />
    </form>
  );
}

export function BatchesPanel({ locationId }: { locationId: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | '3' | '7'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StockBatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StockBatch | null>(null);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['stock-batches', locationId, filter],
    queryFn: () => getStockBatches({ locationId, expiringWithinDays: filter === 'all' ? undefined : Number(filter) }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStockBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-batches'] });
      setDeleteTarget(null);
      toast('success', 'Batch removed.');
    },
    onError: (err) => toast('error', err.message || 'Failed to remove the batch.'),
  });

  return (
    <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-border shrink-0">
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={cn(selectClass, 'w-auto')}>
          <option value="all">All batches</option>
          <option value="3">Expiring in 3 days</option>
          <option value="7">Expiring in 7 days</option>
        </select>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus size={14} />
          Add Batch
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <div className="py-24">
            <EmptyState
              icon={CalendarClock}
              title={filter === 'all' ? 'No batches tracked' : 'Nothing expiring'}
              description={
                filter === 'all' ? 'Add perishable deliveries (milk, food) with their expiry dates.' : 'No batches expire within that window.'
              }
            />
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item</th>
                <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Remaining</th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Expiry</th>
                <th className="px-3 md:px-5 py-3.5 w-14" />
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const meta = expiryMeta(b.expiryDate);
                return (
                  <tr
                    key={b.id}
                    onClick={() => setEditTarget(b)}
                    className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                  >
                    <td className="px-3 md:px-5 py-3.5">
                      <p className="font-medium text-foreground">{b.stockItem?.name}</p>
                      {b.notes && <p className="text-[11px] text-muted-foreground truncate max-w-xs">{b.notes}</p>}
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-right tabular-nums text-foreground">
                      {Number(b.quantity)} {b.stockItem?.unit}
                    </td>
                    <td className={cn('px-3 md:px-5 py-3.5 tabular-nums', meta.className)}>{meta.label}</td>
                    <td className="px-3 md:px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteTarget(b)}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Remove batch of ${b.stockItem?.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {createOpen && (
        <Modal title="Add Batch" onClose={() => setCreateOpen(false)}>
          <BatchForm locationId={locationId} onClose={() => setCreateOpen(false)} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Edit Batch" onClose={() => setEditTarget(null)}>
          <BatchForm locationId={locationId} batch={editTarget} onClose={() => setEditTarget(null)} />
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Remove Batch"
          message={
            <>
              Remove this batch of <span className="font-semibold text-foreground">{deleteTarget.stockItem?.name}</span>? (Log spoiled
              stock in the loss log too.)
            </>
          }
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
