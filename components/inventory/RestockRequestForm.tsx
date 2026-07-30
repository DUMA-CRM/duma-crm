'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, MapPin, Package, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

import { STATUS_BAR, STATUS_LABEL, STATUS_VARIANT, fmtQty, getStatus, stockPct } from '@/components/inventory/stock/shared';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { type LocationStock, getLocationStock } from '@/lib/api/inventory.service';
import { type RestockPriority, createRestockRequest, encodeNotes, getRestockRequests } from '@/lib/api/restock.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
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

/** Live stock context for the picked item — current level vs threshold + a suggested order. */
function StockContextCard({ ls, onUseSuggestion }: { ls: LocationStock; onUseSuggestion: (qty: number) => void }) {
  const qty = parseFloat(ls.quantity);
  const threshold = parseFloat(ls.lowThreshold);
  const status = getStatus(ls);
  const pct = stockPct(qty, threshold);
  const unit = ls.stockItem?.unit ?? 'units';
  const configuredReorder = Number(ls.reorderQuantity ?? ls.stockItem?.defaultReorderQuantity);
  // Prefer the configured reorder quantity; otherwise top up to twice the threshold.
  const target = threshold > 0 ? threshold * 2 : qty + 1;
  const suggested =
    Number.isFinite(configuredReorder) && configuredReorder > 0 ? Math.ceil(configuredReorder) : Math.max(Math.ceil(target - qty), 1);

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
          <Sparkles size={12} className="text-primary" /> {configuredReorder > 0 ? 'Configured reorder' : 'Suggested order'}
        </span>
        <span className="text-sm font-bold text-primary tabular-nums">
          +{suggested} {unit}
        </span>
      </button>
    </div>
  );
}

export function RestockRequestForm({ onSubmitted }: { onSubmitted?: () => void } = {}) {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [stockItemId, setStockItemId] = useState('');
  const [qty, setQty] = useState('');
  const [priority, setPriority] = useState<RestockPriority>('standard');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

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

  const availableItems = useMemo(
    () =>
      locationStock
        .filter((item) => item.isAvailable && item.stockItem)
        .sort((a, b) => {
          const statusRank = { out: 0, critical: 1, low: 2, ok: 3, unavailable: 4 };
          return statusRank[getStatus(a)] - statusRank[getStatus(b)] || a.stockItem!.name.localeCompare(b.stockItem!.name);
        }),
    [locationStock],
  );
  const validStockItemId = availableItems.some((ls) => ls.stockItemId === stockItemId) ? stockItemId : '';
  const selectedItem = availableItems.find((ls) => ls.stockItemId === validStockItemId);
  const locationName = locations.find((l) => l.id === locationId)?.name;

  const { data: duplicateResponse } = useQuery({
    queryKey: ['restock-requests', 'duplicate', locationId, validStockItemId],
    queryFn: () => getRestockRequests({ locationId: locationId!, stockItemId: validStockItemId, status: 'pending', limit: 1 }),
    enabled: !!locationId && !!validStockItemId,
  });
  const duplicatePending = duplicateResponse?.data[0];

  const { mutate: submit, isPending } = useMutation({
    mutationFn: createRestockRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      setStockItemId('');
      setQty('');
      setPriority('standard');
      setNotes('');
      setErrors({});
      toast('success', 'Restock request submitted — it is now awaiting review.');
      // Lets the host close the dialog and drop the user on the pending list.
      onSubmitted?.();
    },
    onError: () => toast('error', 'Failed to submit request. Please try again.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast('error', 'Select a location in the top bar first.');
      return;
    }
    if (duplicatePending) {
      toast('error', 'A pending request already exists for this item at this location.');
      return;
    }
    const errs: FormErrors = {};
    if (!validStockItemId) errs.stockItem = 'Please select an item.';
    const qtyNum = parseInt(qty, 10);
    if (!qty || isNaN(qtyNum) || qtyNum < 1) errs.qty = 'Enter a valid quantity (min 1).';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    submit({
      stockItemId: validStockItemId,
      locationId,
      requestedQty: qtyNum,
      notes: encodeNotes(priority, notes),
    });
  }

  return (
    <div className="h-full overflow-y-auto pb-8 grid gap-6 grid-cols-1 xl:grid-cols-[minmax(0,26rem)_1fr] items-start">
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
          <Select
            value={validStockItemId}
            onValueChange={(value) => {
              setStockItemId(value);
              setErrors((prev) => ({ ...prev, stockItem: undefined }));
            }}
            options={[
              {
                value: '',
                label: loadingStock ? 'Loading items…' : availableItems.length === 0 && locationId ? 'No available items' : 'Select item…',
              },
              ...availableItems.map((item) => ({
                value: item.stockItemId,
                label: `${item.stockItem!.name} · ${fmtQty(Number(item.quantity))} ${item.stockItem!.unit}`,
              })),
            ]}
            ariaLabel="Select stock item"
            ariaInvalid={Boolean(errors.stockItem)}
            disabled={!locationId || loadingStock}
            className={selectClass}
          />
          {!locationId && <p className="text-xs text-muted-foreground">Select a location in the top bar first.</p>}
          {errors.stockItem && <p className="text-xs text-destructive">{errors.stockItem}</p>}
          {duplicatePending && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                A pending request already exists for {duplicatePending.requestedQty} {selectedItem?.stockItem?.unit ?? 'units'}.
              </span>
            </div>
          )}
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

        <Button type="submit" disabled={isPending || !locationId || !!duplicatePending} size="lg" className="w-full">
          {isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>

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
    </div>
  );
}
