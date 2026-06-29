'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Boxes,
  ChevronDown,
  Minus,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Modal } from '@/components/shared/Modal';
import { StatCard } from '@/components/shared/StatCard';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  type LocationStock,
  type LocationStockPayload,
  addLocationStock,
  adjustLocationStock,
  getLocationStock,
  getStockItems,
  removeLocationStock,
  updateLocationStock,
} from '@/lib/api/inventory.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

type StockStatus = 'ok' | 'low' | 'critical' | 'unavailable';

function getStatus(item: LocationStock): StockStatus {
  if (!item.isAvailable) return 'unavailable';
  const qty = parseFloat(item.quantity);
  const threshold = parseFloat(item.lowThreshold);
  if (threshold <= 0) return 'ok';
  if (qty <= threshold * 0.5) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

function stockPct(qty: number, threshold: number): number {
  if (threshold <= 0) return 100;
  return Math.min((qty / threshold) * 100, 100);
}

const STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'OK',
  low: 'Low',
  critical: 'Critical',
  unavailable: 'Unavailable',
};

const STATUS_VARIANT: Record<StockStatus, 'success' | 'amber' | 'destructive' | 'muted'> = {
  ok: 'success',
  low: 'amber',
  critical: 'destructive',
  unavailable: 'muted',
};

const STATUS_BAR: Record<StockStatus, string> = {
  ok: 'bg-success',
  low: 'bg-amber-400',
  critical: 'bg-destructive',
  unavailable: 'bg-border',
};

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
);

function normaliseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: T[] };
  if (Array.isArray(r.data)) return r.data;
  return Object.values(raw as object) as T[];
}

// ── Add Stock Item Modal ──────────────────────────────────────────────────────

function AddItemModal({
  locationId,
  existingIds,
  onClose,
  onSuccess,
}: {
  locationId: string;
  existingIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [stockItemId, setStockItemId] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowThreshold, setLowThreshold] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: allItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const available = allItems.filter((i) => !existingIds.has(i.id));

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: LocationStockPayload) => addLocationStock(payload),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!stockItemId) errs.item = 'Select an item.';
    if (!lowThreshold || parseFloat(lowThreshold) < 0) errs.threshold = 'Enter a valid threshold.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutate({ locationId, stockItemId, quantity: quantity || '0', lowThreshold, isAvailable: true });
  }

  return (
    <Modal title="Add Stock Item" onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select value={stockItemId} onChange={(e) => { setStockItemId(e.target.value); setErrors((p) => ({ ...p, item: '' })); }} className={cn(selectClass, errors.item && 'border-destructive/60')}>
              <option value="">Select item…</option>
              {available.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Initial quantity</Label>
            <input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={selectClass} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Low threshold</Label>
            <input type="number" min={0} step="any" placeholder="e.g. 100" value={lowThreshold} onChange={(e) => { setLowThreshold(e.target.value); setErrors((p) => ({ ...p, threshold: '' })); }} className={cn(selectClass, errors.threshold && 'border-destructive/60')} />
            {errors.threshold && <p className="text-xs text-destructive">{errors.threshold}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending || available.length === 0}>
            {isPending ? 'Adding…' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Adjust Modal ──────────────────────────────────────────────────────────────

function AdjustModal({
  item,
  onClose,
  onSuccess,
}: {
  item: LocationStock;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (delta: number) => adjustLocationStock(item.id, delta),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: () => setError('Adjustment failed. Please try again.'),
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) { setError('Enter a positive amount.'); return; }
    mutate(mode === 'add' ? n : -n);
  }

  const currentQty = parseFloat(item.quantity);
  const previewAmt = parseFloat(amount) || 0;
  const preview = mode === 'add' ? currentQty + previewAmt : currentQty - previewAmt;
  const unit = item.stockItem?.unit ?? '';

  return (
    <Modal title={`Adjust — ${item.stockItem?.name ?? 'Stock'}`} onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface-offset px-4 py-3 flex items-center justify-between text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Current stock</p>
            <p className="text-lg font-semibold text-foreground">{currentQty} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
          </div>
          {amount && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">After adjustment</p>
              <p className={cn('text-lg font-semibold', preview < 0 ? 'text-destructive' : 'text-foreground')}>
                {preview < 0 ? 0 : preview.toFixed(preview % 1 === 0 ? 0 : 1)} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
              </p>
            </div>
          )}
        </div>

        {/* Add / Remove toggle */}
        <div className="flex rounded-lg bg-surface-offset p-1 gap-1">
          {(['add', 'remove'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-sm font-medium transition-colors',
                mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {m === 'add' ? <Plus size={13} /> : <Minus size={13} />}
              {m === 'add' ? 'Add stock' : 'Remove stock'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label uppercase>Amount ({unit || 'units'})</Label>
          <input
            type="number"
            min={0.01}
            step="any"
            placeholder="0"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(''); }}
            className={cn(selectClass, error && 'border-destructive/60')}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Threshold Modal ──────────────────────────────────────────────────────

function EditThresholdModal({
  item,
  onClose,
  onSuccess,
}: {
  item: LocationStock;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [threshold, setThreshold] = useState(item.lowThreshold);
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (val: string) => updateLocationStock(item.id, { lowThreshold: val }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (parseFloat(threshold) < 0 || isNaN(parseFloat(threshold))) { setError('Enter a valid threshold.'); return; }
    mutate(threshold);
  }

  return (
    <Modal title={`Edit Threshold — ${item.stockItem?.name ?? 'Stock'}`} onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Low stock threshold ({item.stockItem?.unit ?? 'units'})</Label>
          <input
            type="number"
            min={0}
            step="any"
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value); setError(''); }}
            className={cn(selectClass, error && 'border-destructive/60')}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Alert triggers when stock falls to or below this value.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Stock Item Sidebar ────────────────────────────────────────────────────────

function StockSidebar({
  item,
  onClose,
  onAdjust,
  onEditThreshold,
  onToggleAvailable,
  onRemove,
}: {
  item: LocationStock | null;
  onClose: () => void;
  onAdjust: (i: LocationStock) => void;
  onEditThreshold: (i: LocationStock) => void;
  onToggleAvailable: (i: LocationStock) => void;
  onRemove: (i: LocationStock) => void;
}) {
  if (!item) {
    return (
      <div className="w-80 shrink-0 border-l border-border bg-card flex items-center justify-center">
        <EmptyState icon={Boxes} title="No item selected" description="Click a row to manage stock." />
      </div>
    );
  }

  const qty = parseFloat(item.quantity);
  const threshold = parseFloat(item.lowThreshold);
  const pct = stockPct(qty, threshold);
  const status = getStatus(item);

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Stock Item</p>
            <p className="text-lg font-semibold text-foreground leading-snug truncate">{item.stockItem?.name ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
              <span className="text-xs text-muted-foreground">{item.stockItem?.unit}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 mt-0.5">
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-5 space-y-6">
          {/* Stock level visual */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <Label uppercase>Stock Level</Label>
              <span className="text-xs text-muted-foreground">{Math.round(pct)}% of threshold</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', STATUS_BAR[status])} style={{ width: `${pct}%` }} />
            </div>
            <div className="flex items-baseline justify-between mt-2.5">
              <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{qty % 1 === 0 ? qty : qty.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{item.stockItem?.unit} current</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">{threshold % 1 === 0 ? threshold : threshold.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">threshold</p>
              </div>
            </div>
          </section>

          {/* Info */}
          <section>
            <Label uppercase className="mb-2.5 block">Details</Label>
            <InfoGroup>
              <InfoRow icon={Package} label="Item ID" value={`#${item.stockItemId.slice(0, 8).toUpperCase()}`} copyable />
              <InfoRow icon={PackageCheck} label="Available" value={item.isAvailable ? 'Yes' : 'No'} />
            </InfoGroup>
          </section>
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
        <div className="flex gap-2">
          <Button className="flex-1 gap-1.5" onClick={() => onAdjust(item)}>
            <ArrowDownUp size={13} /> Adjust Stock
          </Button>
          <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onEditThreshold(item)}>
            <Pencil size={13} /> Threshold
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onToggleAvailable(item)}
          >
            {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-xs text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive"
            onClick={() => onRemove(item)}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | StockStatus;

export default function StockControlPage() {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<LocationStock | null>(null);
  const [thresholdTarget, setThresholdTarget] = useState<LocationStock | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', message: string) =>
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data: rawStock, isLoading } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });

  const { mutate: toggleAvailable } = useMutation({
    mutationFn: (item: LocationStock) => updateLocationStock(item.id, { isAvailable: !item.isAvailable }),
    onSuccess: () => { invalidate(); addToast('success', 'Availability updated.'); },
    onError: () => addToast('error', 'Failed to update availability.'),
  });

  const { mutate: removeItem } = useMutation({
    mutationFn: (id: string) => removeLocationStock(id),
    onSuccess: () => { setSelectedId(null); invalidate(); addToast('success', 'Item removed.'); },
    onError: () => addToast('error', 'Failed to remove item.'),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['location-stock', locationId] });
  }

  const allStock = useMemo(() => normaliseArray<LocationStock>(rawStock), [rawStock]);

  const enriched = useMemo(() =>
    allStock.map((s) => ({ ...s, status: getStatus(s), qty: parseFloat(s.quantity), threshold: parseFloat(s.lowThreshold) })),
    [allStock],
  );

  const filtered = useMemo(() => {
    return enriched.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(s.stockItem?.name ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, statusFilter, search]);

  const selectedItem = useMemo(
    () => enriched.find((s) => s.id === selectedId) ?? null,
    [enriched, selectedId],
  );

  const existingIds = useMemo(() => new Set(allStock.map((s) => s.stockItemId)), [allStock]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const okCount = enriched.filter((s) => s.status === 'ok').length;
  const lowCount = enriched.filter((s) => s.status === 'low').length;
  const criticalCount = enriched.filter((s) => s.status === 'critical').length;
  const unavailableCount = enriched.filter((s) => s.status === 'unavailable').length;

  const hasFilters = !!(search || statusFilter !== 'all');

  function clearFilters() { setSearch(''); setStatusFilter('all'); }

  const STATUS_TABS: { value: StatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: enriched.length },
    { value: 'ok', label: 'Healthy', count: okCount },
    { value: 'low', label: 'Low', count: lowCount },
    { value: 'critical', label: 'Critical', count: criticalCount },
    { value: 'unavailable', label: 'Unavailable', count: unavailableCount },
  ];

  const sidebar = (
    <StockSidebar
      item={selectedItem}
      onClose={() => setSelectedId(null)}
      onAdjust={setAdjustTarget}
      onEditThreshold={setThresholdTarget}
      onToggleAvailable={(i) => toggleAvailable(i)}
      onRemove={(i) => removeItem(i.id)}
    />
  );

  return (
    <PageLayout eyebrow="Inventory" title="Stock Control" headerBorder={false} sidebar={sidebar}>
      {/* Toolbar */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-72">
            <Input
              placeholder="Search items…"
              leftIcon={<Search size={14} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              rightAction={
                search
                  ? <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
                  : undefined
              }
            />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} /> Clear
            </button>
          )}

          {locationId && (
            <Button size="sm" onClick={() => setShowAdd(true)} className="ml-auto gap-1.5">
              <Plus size={14} /> Add Item
            </Button>
          )}
        </div>

        {/* Status tabs */}
        {locationId && (
          <div className="flex items-center gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface-offset',
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={cn(
                    'flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold',
                    statusFilter === tab.value ? 'bg-background/20 text-background' : 'bg-surface-offset text-muted-foreground',
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {locationId && (
        <div className="flex gap-3 mb-6">
          <StatCard label="Total Items" value={String(enriched.length)} icon="ShoppingBag" iconVariant="primary" />
          <StatCard label="Healthy" value={String(okCount)} icon="Receipt" iconVariant="success" />
          <StatCard
            label="Low Stock"
            value={String(lowCount + criticalCount)}
            icon="Tag"
            iconVariant="gold"
            delta={lowCount + criticalCount > 0 ? String(lowCount + criticalCount) : undefined}
            deltaDirection={lowCount + criticalCount > 0 ? 'down' : undefined}
          />
          <StatCard label="Unavailable" value={String(unavailableCount)} icon="Tag" iconVariant="info" />
        </div>
      )}

      {/* Table */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card h-[calc(100%-14.5rem)]">
        {!locationId ? (
          <EmptyState
            icon={Boxes}
            title="No location selected"
            description="Select a location from the header to view and manage its stock."
          />
        ) : (
          <>
            <div className="grid grid-cols-[2fr_0.8fr_1fr_1fr_1.8fr_0.9fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
              {['Item', 'Unit', 'Quantity', 'Threshold', 'Stock Level', 'Status'].map((h) => (
                <span key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</span>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Loading stock…</p>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title={hasFilters ? 'No items match your filters' : 'No stock items at this location'}
                  description={hasFilters ? 'Try adjusting your filters.' : 'Add items using the button above.'}
                />
              ) : (
                filtered.map((s) => {
                  const pct = stockPct(s.qty, s.threshold);
                  const selected = selectedId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId((prev) => prev === s.id ? null : s.id)}
                      className={cn(
                        'grid grid-cols-[2fr_0.8fr_1fr_1fr_1.8fr_0.9fr] gap-4 px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer transition-colors',
                        'hover:bg-surface-offset/40',
                        selected && 'bg-primary/5 border-l-2 border-l-primary',
                      )}
                    >
                      {/* Item */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                          s.status === 'critical' ? 'bg-destructive/10' : s.status === 'low' ? 'bg-amber-400/10' : s.status === 'unavailable' ? 'bg-border/50' : 'bg-primary/10',
                        )}>
                          <Package size={13} className={
                            s.status === 'critical' ? 'text-destructive' : s.status === 'low' ? 'text-amber-500' : s.status === 'unavailable' ? 'text-muted-foreground' : 'text-primary'
                          } />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{s.stockItem?.name ?? s.stockItemId.slice(0, 8)}</span>
                      </div>

                      {/* Unit */}
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground bg-surface-offset px-2 py-0.5 rounded-full">{s.stockItem?.unit ?? '—'}</span>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center">
                        <span className={cn('text-sm font-semibold tabular-nums', s.status === 'critical' && 'text-destructive')}>
                          {s.qty % 1 === 0 ? s.qty : s.qty.toFixed(1)}
                        </span>
                      </div>

                      {/* Threshold */}
                      <div className="flex items-center text-sm text-muted-foreground tabular-nums">
                        {s.threshold % 1 === 0 ? s.threshold : s.threshold.toFixed(1)}
                      </div>

                      {/* Stock level bar */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', STATUS_BAR[s.status])} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">{Math.round(pct)}%</span>
                      </div>

                      {/* Status */}
                      <div className="flex items-center">
                        <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-2 border-t border-border shrink-0">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                  {hasFilters && enriched.length !== filtered.length && ` of ${enriched.length} total`}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && locationId && (
        <AddItemModal
          locationId={locationId}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { invalidate(); addToast('success', 'Item added.'); }}
        />
      )}

      {adjustTarget && (
        <AdjustModal
          item={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSuccess={() => { invalidate(); addToast('success', 'Stock adjusted.'); }}
        />
      )}

      {thresholdTarget && (
        <EditThresholdModal
          item={thresholdTarget}
          onClose={() => setThresholdTarget(null)}
          onSuccess={() => { invalidate(); addToast('success', 'Threshold updated.'); }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}
