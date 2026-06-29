'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

import { getLocationStock } from '@/lib/api/inventory.service';
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
  location?: string;
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

export function RestockRequestForm() {
  const { tenantId, locationId: storeLocationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState(storeLocationId ?? '');
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
    queryFn: () => getLocationStock(locationId),
    enabled: !!locationId,
  });

  // Shared query key with sidebar — served from cache, no extra request
  const { data: statsResponse } = useQuery({
    queryKey: ['restock-requests'],
    queryFn: () => getRestockRequests({ limit: 100 }),
  });

  // Sync with store location on mount
  useEffect(() => {
    if (storeLocationId) setLocationId(storeLocationId);
  }, [storeLocationId]);

  // Reset stock item when location changes
  useEffect(() => {
    setStockItemId('');
  }, [locationId]);

  const availableItems = locationStock.filter((ls) => ls.isAvailable && ls.stockItem);
  const selectedItem = availableItems.find((ls) => ls.stockItemId === stockItemId);

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
    const errs: FormErrors = {};
    if (!locationId) errs.location = 'Please select a location.';
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
    <div className="h-full overflow-y-auto pb-8 grid gap-4 grid-cols-2">
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Location</Label>
          <div className="relative">
            <select
              value={locationId}
              onChange={(e) => {
                setLocationId(e.target.value);
                setErrors((prev) => ({ ...prev, location: undefined }));
              }}
              className={cn(selectClass, errors.location && 'border-destructive/60 focus:border-destructive focus:ring-destructive/15')}
            >
              <option value="">Select location…</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
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
          {!locationId && <p className="text-xs text-muted-foreground">Select a location first.</p>}
          {errors.stockItem && <p className="text-xs text-destructive">{errors.stockItem}</p>}
        </div>

        {/* Quantity + Unit */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="QUANTITY"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setErrors((prev) => ({ ...prev, qty: undefined }));
              }}
              placeholder="0"
              error={errors.qty}
            />
          </div>
          <div
            className={cn(
              'h-9 px-3 bg-surface-offset rounded-lg flex items-center text-sm font-medium shrink-0',
              'border border-transparent',
              selectedItem?.stockItem?.unit ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {selectedItem?.stockItem?.unit ?? 'unit'}
          </div>
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

        <Button type="submit" disabled={isPending} size="lg" className="w-full">
          {isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>

      <div>
        <Label uppercase className='mb-1.5'>Stats</Label>

        <div className="grid grid-cols-2 gap-4 mb-7 h-fit">
          <StatCard label="Pending" value={statPending} valueClass={statPending > 0 ? 'text-warning' : undefined} />
          <StatCard label="Urgent" value={statUrgent} valueClass={statUrgent > 0 ? 'text-destructive' : undefined} />
          <StatCard label="Approved" value={statApproved} valueClass={statApproved > 0 ? 'text-primary' : undefined} />
          <StatCard label="Fulfilled" value={statFulfilled} valueClass={statFulfilled > 0 ? 'text-success' : undefined} />
        </div>
      </div>

      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
