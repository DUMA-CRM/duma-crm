'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, X } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import {
  type CreateDeliveryPayload,
  type DeliveryRecord,
  type DeliveryStatus,
  type UpdateDeliveryPayload,
  createDelivery,
  updateDelivery,
} from '@/lib/api/delivery.service';
import { getStockItems } from '@/lib/api/inventory.service';
import { getSuppliers } from '@/lib/api/supplier.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Shared constants ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  received: 'Received',
  partial: 'Partial',
  cancelled: 'Cancelled',
};

const STATUS_OPTIONS: DeliveryStatus[] = ['pending', 'received', 'partial', 'cancelled'];

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeliveryModalProps {
  mode: 'create' | 'edit';
  initial?: DeliveryRecord;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemLine {
  stockItemId: string;
  quantity: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DeliveryModal({ mode, initial, onClose, onSuccess }: DeliveryModalProps) {
  const { tenantId } = useWorkspaceStore();

  const [locationId, setLocationId] = useState(initial?.locationId ?? '');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [status, setStatus] = useState<DeliveryStatus>(initial?.status ?? 'pending');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<ItemLine[]>(
    initial?.items?.map((i) => ({ stockItemId: i.stockItemId, quantity: String(i.quantity) })) ?? [{ stockItemId: '', quantity: '' }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: getSuppliers,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: CreateDeliveryPayload | { id: string; data: UpdateDeliveryPayload }) => {
      if (mode === 'create') return createDelivery(payload as CreateDeliveryPayload);
      const { id, data } = payload as { id: string; data: UpdateDeliveryPayload };
      return updateDelivery(id, data);
    },
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function addLine() { setLines((l) => [...l, { stockItemId: '', quantity: '' }]); }
  function removeLine(i: number) { setLines((l) => l.filter((_, idx) => idx !== i)); }
  function updateLine(i: number, field: keyof ItemLine, value: string) {
    setLines((l) => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (mode === 'create') {
      if (!locationId) errs.location = 'Select a location.';
      const validLines = lines.filter((l) => l.stockItemId && parseFloat(l.quantity) > 0);
      if (validLines.length === 0) errs.items = 'Add at least one item with a valid quantity.';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (mode === 'create') {
      const validLines = lines.filter((l) => l.stockItemId && parseFloat(l.quantity) > 0);
      save({
        tenantId: tenantId!,
        locationId,
        supplierId: supplierId || undefined,
        status,
        notes: notes || undefined,
        items: validLines.map((l) => ({ stockItemId: l.stockItemId, quantity: parseFloat(l.quantity) })),
      } as CreateDeliveryPayload);
    } else {
      save({ id: initial!.id, data: { status, notes: notes || undefined } });
    }
  }

  return (
    <Modal title={mode === 'create' ? 'New Delivery' : 'Edit Delivery'} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' && (
          <>
            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Location</Label>
              <div className="relative">
                <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setErrors((p) => ({ ...p, location: undefined! })); }} className={cn(selectClass, errors.location && 'border-destructive/60')}>
                  <option value="">Select location…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <Label uppercase>Supplier</Label>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              <div className="relative">
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectClass}>
                  <option value="">No supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </>
        )}

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Status</Label>
          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value as DeliveryStatus)} className={selectClass}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Items (create only) */}
        {mode === 'create' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label uppercase>Items</Label>
              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => {
                const selectedItem = stockItems.find((s) => s.id === line.stockItemId);
                return (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <select
                        value={line.stockItemId}
                        onChange={(e) => updateLine(i, 'stockItemId', e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select item…</option>
                        {stockItems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <div className="flex gap-1.5 items-center w-32 shrink-0">
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        className={cn(selectClass, 'pr-3 w-20')}
                      />
                      <span className="text-xs text-muted-foreground w-8 truncate">{selectedItem?.unit ?? ''}</span>
                    </div>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addLine} className="text-xs text-primary hover:underline text-left w-fit">
              + Add item
            </button>
          </div>
        )}

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <Label uppercase>Notes</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reference number, delivery instructions…"
            maxLength={500}
            rows={3}
            className={cn(
              'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none resize-none',
              'focus:border-primary focus:ring-2 focus:ring-primary/15',
              'transition-[border-color,box-shadow] duration-150',
            )}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? (mode === 'create' ? 'Creating…' : 'Saving…') : (mode === 'create' ? 'Create Delivery' : 'Save Changes')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
