'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MapPin, Package, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { STATUS_BAR, STATUS_LABEL, STATUS_VARIANT, fmtQty, getStatus, stockPct } from '@/components/inventory/stock/shared';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { type LocationStock, getLocationStock } from '@/lib/api/inventory.service';
import { type RestockPriority, createRestockRequest, decodeNotes, encodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

const PRIORITY_OPTIONS = [
  { value: 'standard' as const, label: 'Standard' },
  { value: 'urgent' as const, label: 'Urgent' },
] as const;

interface FormErrors {
  stockItem?: string;
  qty?: string;
}

interface StatCardProps {
  label: string;
  value: number;
  valueClass?: string;
}

function StatCard({ label, value, valueClass }: StatCardProps) {
  return (
    <div className="bg-surface-offset rounded-xl p-3 flex flex-col gap-0.5">
      <p className={cn('text-2xl font-bold text-foreground', valueClass)}>{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">{label}</p>
    </div>
  );
}

/** Live stock context for the picked item — current level vs threshold + a suggested order. */
function StockContextCard({ ls, onUseSuggestion }: { ls: LocationStock; onUseSuggestion: (qty: number) => void }) {
  const qty = parseFloat(ls.quantity);
  const threshold = parseFloat(ls.lowThreshold);
  const status = getStatus(ls);
  const pct = stockPct(qty, threshold);
  const unit = ls.stockItem?.unit ?? 'units';
  // Suggest topping up to twice the threshold (a sensible reorder target).
  const target = threshold > 0 ? threshold * 2 : qty + 1;
  const suggested = Math.max(Math.ceil(target - qty), 1);

  return (
    <div className="rounded-xl border border-border bg-surface-offset p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate">{ls.stockItem?.name}</p>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', STATUS_BAR[status])} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground tabular-nums">{fmtQty(qty)}</span> {unit} in stock
          </span>
          <span>threshold {fmtQty(threshold)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUseSuggestion(suggested)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 hover:bg-primary/10 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles size={12} className="text-primary" /> Suggested order
        </span>
        <span className="text-sm font-bold text-primary tabular-nums">
          +{suggested} {unit}
        </span>
      </button>
    </div>
  );
}

export function RestockRequestForm() {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [stockItemId, setStockItemId] = useState('');
  const [qty, setQty] = useState('');
  const [priority, setPriority] = useState<RestockPriority>('standard');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', message: string) => setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: locationStock = [], isLoading: loadingStock } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  // Shared query key with sidebar — served from cache, no extra request
  const { data: statsResponse } = useQuery({
    queryKey: ['restock-requests'],
    queryFn: () => getRestockRequests({ limit: 100 }),
  });

  // Reset stock item when the active location changes
  useEffect(() => {
    setStockItemId('');
  }, [locationId]);

  const availableItems = locationStock.filter((ls) => ls.isAvailable && ls.stockItem);
  const selectedItem = availableItems.find((ls) => ls.stockItemId === stockItemId);
  const locationName = locations.find((l) => l.id === locationId)?.name;

  const requests = statsResponse?.data ?? [];
  const statPending = requests.filter((r) => r.status === 'pending').length;
  const statUrgent = requests.filter((r) => r.status === 'pending' && decodeNotes(r.notes).priority === 'urgent').length;
  const statApproved = requests.filter((r) => r.status === 'approved').length;
  const statFulfilled = requests.filter((r) => r.status === 'fulfilled').length;

  const { mutate: submit, isPending } = useMutation({
    mutationFn: createRestockRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      setStockItemId('');
      setQty('');
      setPriority('standard');
      setNotes('');
      setErrors({});
      addToast('success', 'Restock request submitted successfully.');
    },
    onError: () => addToast('error', 'Failed to submit request. Please try again.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      addToast('error', 'Select a location in the top bar first.');
      return;
    }
    const errs: FormErrors = {};
    if (!stockItemId) errs.stockItem = 'Please select an item.';
    const qtyNum = parseInt(qty, 10);
    if (!qty || isNaN(qtyNum) || qtyNum < 1) errs.qty = 'Enter a valid quantity (min 1).';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    submit({
      stockItemId,
      locationId,
      requestedQty: qtyNum,
      notes: encodeNotes(priority, notes),
    });
  }

  return (
    <div className="h-full overflow-y-auto pb-8 grid gap-8 grid-cols-1 xl:grid-cols-[minmax(0,26rem)_1fr] items-start">
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Location (set from the top bar) */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Location</Label>
          <div className="h-9 px-3 bg-surface-offset rounded-lg flex items-center gap-2 text-sm">
            <MapPin size={14} className="text-muted-foreground shrink-0" />
            {locationName ? (
              <span className="font-medium text-foreground truncate">{locationName}</span>
            ) : (
              <span className="text-muted-foreground">No location selected — choose one in the top bar</span>
            )}
          </div>
        </div>

        {/* Stock Item */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select
              value={stockItemId}
              onChange={(e) => {
                setStockItemId(e.target.value);
                setErrors((prev) => ({ ...prev, stockItem: undefined }));
              }}
              disabled={!locationId || loadingStock}
              className={cn(selectClass, errors.stockItem && 'border-destructive/60 focus:border-destructive focus:ring-destructive/15')}
            >
              <option value="">
                {loadingStock ? 'Loading items…' : availableItems.length === 0 && locationId ? 'No available items' : 'Select item…'}
              </option>
              {availableItems.map((ls) => (
                <option key={ls.stockItemId} value={ls.stockItemId}>
                  {ls.stockItem!.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {!locationId && <p className="text-xs text-muted-foreground">Select a location in the top bar first.</p>}
          {errors.stockItem && <p className="text-xs text-destructive">{errors.stockItem}</p>}
        </div>

        {/* Quantity + Unit */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Quantity</Label>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setErrors((prev) => ({ ...prev, qty: undefined }));
              }}
              placeholder="0"
              className={cn(
                'flex-1 h-9 px-3 bg-surface-offset border border-transparent rounded-lg text-sm text-foreground',
                'placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
                'transition-[border-color,box-shadow] duration-150',
                errors.qty && 'border-destructive/60 focus:border-destructive focus:ring-destructive/15',
              )}
            />
            <div
              className={cn(
                'h-9 px-3 bg-surface-offset rounded-lg flex items-center text-sm font-medium shrink-0 border border-transparent',
                selectedItem?.stockItem?.unit ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {selectedItem?.stockItem?.unit ?? 'unit'}
            </div>
          </div>
          {errors.qty && <p className="text-xs text-destructive">{errors.qty}</p>}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Priority</Label>
          <SegmentedControl options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <Label uppercase>Notes</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context for this request…"
            maxLength={900}
            rows={3}
            className={cn(
              'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none resize-none',
              'focus:border-primary focus:ring-2 focus:ring-primary/15',
              'transition-[border-color,box-shadow] duration-150',
            )}
          />
        </div>

        <Button type="submit" disabled={isPending || !locationId} size="lg" className="w-full">
          {isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>

      <div className="space-y-5">
        {/* Live context for the selected item */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item stock</Label>
          {selectedItem ? (
            <StockContextCard
              ls={selectedItem}
              onUseSuggestion={(q) => {
                setQty(String(q));
                setErrors((prev) => ({ ...prev, qty: undefined }));
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-center">
              <Package size={20} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Pick an item to see its current stock level and a suggested order amount.</p>
            </div>
          )}
        </div>

        {/* Request pipeline */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Request pipeline</Label>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Pending" value={statPending} valueClass={statPending > 0 ? 'text-warning' : undefined} />
            <StatCard label="Urgent" value={statUrgent} valueClass={statUrgent > 0 ? 'text-destructive' : undefined} />
            <StatCard label="Approved" value={statApproved} valueClass={statApproved > 0 ? 'text-primary' : undefined} />
            <StatCard label="Fulfilled" value={statFulfilled} valueClass={statFulfilled > 0 ? 'text-success' : undefined} />
          </div>
        </div>
      </div>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
