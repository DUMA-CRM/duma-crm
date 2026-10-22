'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AlertTriangle, FileText, Loader2, PackagePlus, Sparkles } from '@/components/icons';
import { ParMeter, STATUS_LABEL, STATUS_TONE, fmtQty, getStatus, statusGlyph } from '@/components/inventory/stock/shared';
import { Drawer } from '@/components/shared/Drawer';
import { FormSection } from '@/components/shared/FormParts';
import { Pill } from '@/components/shared/Pill';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TONE_TINT } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel, Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { type LocationStock, getLocationStock } from '@/lib/modules/inventory/client';
import { type RestockPriority, createRestockRequest, encodeNotes, getRestockRequests } from '@/lib/modules/inventory/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const selectClass = cn(
  'w-full h-9 bg-control border border-input rounded-md px-3 pr-8 text-sm text-foreground',
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

/** Live stock context for the picked item — current level against par + a suggested order. */
function StockContextCard({ ls, onUseSuggestion }: { ls: LocationStock; onUseSuggestion: (qty: number) => void }) {
  const qty = parseFloat(ls.quantity);
  const threshold = parseFloat(ls.lowThreshold);
  const status = getStatus(ls);
  const glyph = statusGlyph(status, ls.stockItem?.category);
  const unit = ls.stockItem?.unit ?? 'units';
  const configuredReorder = Number(ls.reorderQuantity ?? ls.stockItem?.defaultReorderQuantity);
  // Prefer the configured reorder quantity; otherwise top up to twice par.
  const target = threshold > 0 ? threshold * 2 : qty + 1;
  const suggested =
    Number.isFinite(configuredReorder) && configuredReorder > 0 ? Math.ceil(configuredReorder) : Math.max(Math.ceil(target - qty), 1);

  return (
    <div className="space-y-3 rounded-lg border border-rule/60 bg-field p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONE_TINT[STATUS_TONE[status]])}
          role="img"
          aria-label={glyph.label}
          title={glyph.label}
        >
          <glyph.icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{ls.stockItem?.name}</span>
            {status !== 'ok' && <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <ParMeter qty={qty} par={threshold} unit={unit} status={status} className="w-20 shrink-0" />
            <span className="truncate">
              <span className="font-semibold tabular-nums text-foreground">{fmtQty(qty)}</span> {unit} in stock
              {threshold > 0 && ` · par ${fmtQty(threshold)}`}
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUseSuggestion(suggested)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-primary/30 bg-background/60 px-3 py-2 transition-colors hover:bg-band/40"
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

export function RestockRequestDrawer({ onSubmitted, onClose }: { onSubmitted?: () => void; onClose: () => void }) {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [stockItemId, setStockItemId] = useState('');
  const [qty, setQty] = useState('');
  const [priority, setPriority] = useState<RestockPriority>('standard');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: locationStock = [], isLoading: loadingStock } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
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
    queryKey: moduleQueryKeys.inventory.key('restock-requests', 'duplicate', locationId, validStockItemId),
    queryFn: () => getRestockRequests({ locationId: locationId!, stockItemId: validStockItemId, status: 'pending', limit: 1 }),
    enabled: !!locationId && !!validStockItemId,
  });
  const duplicatePending = duplicateResponse?.data[0];

  const { mutate: submit, isPending } = useMutation({
    mutationFn: createRestockRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('restock-requests') });
      setStockItemId('');
      setQty('');
      setPriority('standard');
      setNotes('');
      setErrors({});
      toast('success', 'Restock request submitted — it is now awaiting review.');
      // Lets the host close the dialog and drop the user on the pending list.
      onSubmitted?.();
    },
    onError: () => toast('error', 'The restock request wasn’t sent. Try again.'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast('error', 'Select a location before requesting stock.');
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

  // The drawer body owns the scrolling — this just lays the form out beside its live context.
  return (
    <Drawer
      icon={PackagePlus}
      title="New restock request"
      description={locationName}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="restock-request-form" disabled={isPending || !locationId || !!duplicatePending} className="flex-1">
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isPending ? 'Submitting…' : 'Request restock'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Form */}
        <form id="restock-request-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Stock Item */}
          <div className="flex flex-col gap-1.5">
            <Label required uppercase>
              Item
            </Label>
            <Select
              value={validStockItemId}
              onValueChange={(value) => {
                setStockItemId(value);
                setErrors((prev) => ({ ...prev, stockItem: undefined }));
              }}
              options={[
                {
                  value: '',
                  label: loadingStock
                    ? 'Loading items…'
                    : availableItems.length === 0 && locationId
                      ? 'No available items'
                      : 'Select item…',
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
            {!locationId && <p className="text-xs text-muted-foreground">Select a location before sending this request.</p>}
            {errors.stockItem && <p className="text-xs text-destructive">{errors.stockItem}</p>}
            {duplicatePending && (
              <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  A pending request already exists for {duplicatePending.requestedQty} {selectedItem?.stockItem?.unit ?? 'units'}.
                </span>
              </div>
            )}
          </div>

          {/* Context follows the selected item, above the optional note. */}
          {selectedItem && (
            <div>
              <StockContextCard
                ls={selectedItem}
                onUseSuggestion={(q) => {
                  setQty(String(q));
                  setErrors((prev) => ({ ...prev, qty: undefined }));
                }}
              />
            </div>
          )}
          <Input
            required
            label="Quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              setErrors((prev) => ({ ...prev, qty: undefined }));
            }}
            placeholder="0"
            rightIcon={<span className="text-xs">{selectedItem?.stockItem?.unit ?? 'unit'}</span>}
            error={errors.qty}
          />

          <FormSection icon={AlertTriangle} title="Priority" collapsible defaultOpen={priority === 'urgent'}>
            <div className="flex flex-col gap-1.5">
              <Label required uppercase>
                Priority
              </Label>
              <SegmentedControl options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
            </div>
          </FormSection>

          <FormSection icon={FileText} title="Note" collapsible>
            <FieldLabel htmlFor="restock-request-note">Note</FieldLabel>
            <textarea
              id="restock-request-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Note"
              placeholder="Additional context…"
              maxLength={900}
              rows={3}
              className="w-full rounded-md border border-input bg-control px-3 py-2 text-base sm:text-sm outline-none focus-visible:outline-2 focus-visible:outline-ring"
            />
          </FormSection>
        </form>
      </div>
    </Drawer>
  );
}
