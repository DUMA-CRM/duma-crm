'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ArrowRight, CalendarDays, ChevronDown, FileText, MapPin, Package, Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { StatCard } from '@/components/shared/StatCard';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  type TransferRecord,
  getLocationStock,
  getStockItems,
  getTransfers,
  transferLocationStock,
} from '@/lib/api/inventory.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

// API returns lowercase types
const TYPE_LABELS: Record<string, string> = {
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  receive: 'Receive',
  return: 'Return',
  sale: 'Sale',
};

function typeVariant(type: string): 'primary' | 'success' | 'warning' | 'destructive' | 'muted' {
  if (type === 'transfer') return 'primary';
  if (type === 'receive') return 'success';
  if (type === 'adjustment') return 'warning';
  if (type === 'sale') return 'destructive';
  return 'muted';
}

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

// ── New Transfer Modal ────────────────────────────────────────────────────────

interface NewTransferModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function NewTransferModal({ onClose, onSuccess }: NewTransferModalProps) {
  const { tenantId } = useWorkspaceStore();

  const [fromLocationId, setFromLocationId] = useState('');
  const [stockItemId, setStockItemId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: fromStock = [], isLoading: loadingFromStock } = useQuery({
    queryKey: ['location-stock', fromLocationId],
    queryFn: () => getLocationStock(fromLocationId),
    enabled: !!fromLocationId,
  });

  const availableItems = fromStock.filter((ls) => ls.isAvailable && ls.stockItem && parseFloat(ls.quantity) > 0);
  const selectedLocationStock = availableItems.find((ls) => ls.stockItemId === stockItemId);
  const currentQty = selectedLocationStock ? parseFloat(selectedLocationStock.quantity) : 0;

  const toLocations = locations.filter((l) => l.id !== fromLocationId);

  const { mutate: transfer, isPending } = useMutation({
    mutationFn: ({ locationStockId, toLocId, quantity }: { locationStockId: string; toLocId: string; quantity: number }) =>
      transferLocationStock(locationStockId, toLocId, quantity),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!fromLocationId) errs.from = 'Select source location.';
    if (!stockItemId) errs.item = 'Select an item.';
    if (!toLocationId) errs.to = 'Select destination location.';
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) errs.qty = 'Enter a valid quantity.';
    else if (qtyNum > currentQty) errs.qty = `Max available: ${currentQty}`;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!selectedLocationStock) return;
    transfer({ locationStockId: selectedLocationStock.id, toLocId: toLocationId, quantity: qtyNum });
  }

  return (
    <Modal title="New Transfer" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* From Location */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>From Location</Label>
          <div className="relative">
            <select
              value={fromLocationId}
              onChange={(e) => { setFromLocationId(e.target.value); setStockItemId(''); setErrors((p) => ({ ...p, from: undefined! })); }}
              className={cn(selectClass, errors.from && 'border-destructive/60')}
            >
              <option value="">Select location…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.from && <p className="text-xs text-destructive">{errors.from}</p>}
        </div>

        {/* Item */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select
              value={stockItemId}
              onChange={(e) => { setStockItemId(e.target.value); setErrors((p) => ({ ...p, item: undefined! })); }}
              disabled={!fromLocationId || loadingFromStock}
              className={cn(selectClass, errors.item && 'border-destructive/60')}
            >
              <option value="">
                {loadingFromStock ? 'Loading…' : !fromLocationId ? 'Select a location first' : availableItems.length === 0 ? 'No items available' : 'Select item…'}
              </option>
              {availableItems.map((ls) => (
                <option key={ls.stockItemId} value={ls.stockItemId}>
                  {ls.stockItem!.name} — {parseFloat(ls.quantity)} {ls.stockItem!.unit} available
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
        </div>

        {/* To Location */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>To Location</Label>
          <div className="relative">
            <select
              value={toLocationId}
              onChange={(e) => { setToLocationId(e.target.value); setErrors((p) => ({ ...p, to: undefined! })); }}
              disabled={!fromLocationId}
              className={cn(selectClass, errors.to && 'border-destructive/60')}
            >
              <option value="">Select destination…</option>
              {toLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.to && <p className="text-xs text-destructive">{errors.to}</p>}
        </div>

        {/* Quantity */}
        <div>
          <Input
            label="QUANTITY"
            type="number"
            min={0.01}
            step="any"
            max={currentQty || undefined}
            value={qty}
            onChange={(e) => { setQty(e.target.value); setErrors((p) => ({ ...p, qty: undefined! })); }}
            placeholder="0"
            error={errors.qty}
            hint={selectedLocationStock ? `Max: ${currentQty} ${selectedLocationStock.stockItem?.unit ?? ''}` : undefined}
          />
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
            placeholder="Reason for transfer, reference number…"
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
            {isPending ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Route cell ────────────────────────────────────────────────────────────────

function RouteCell({ transfer: t }: { transfer: TransferRecord }) {
  const fromName = t.location?.name ?? '—';
  const toName = t.relatedLocation?.name ?? null;

  return (
    <div className="flex items-center gap-1.5 text-sm min-w-0">
      <span className="flex items-center gap-1 text-muted-foreground min-w-0">
        <MapPin size={12} className="shrink-0" />
        <span className="truncate max-w-30">{fromName}</span>
      </span>
      {toName && (
        <>
          <ArrowRight size={12} className="text-muted-foreground shrink-0" />
          <span className="flex items-center gap-1 text-muted-foreground min-w-0">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate max-w-30">{toName}</span>
          </span>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransfersPage() {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterStockItemId, setFilterStockItemId] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', message: string) =>
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
  });

  const { data: rawTransfersData, isLoading } = useQuery({
    queryKey: ['transfers', tenantId],
    queryFn: () => getTransfers({ tenantId: tenantId!, limit: 100 }),
    enabled: !!tenantId,
  });

  const allTransfers = useMemo(() => {
    let records: TransferRecord[];
    if (!rawTransfersData) return [];
    if (Array.isArray(rawTransfersData)) records = rawTransfersData;
    else {
      const r = rawTransfersData as unknown as { data?: TransferRecord[] };
      records = Array.isArray(r.data) ? r.data : (Object.values(rawTransfersData) as TransferRecord[]);
    }
    // Each transfer creates two ledger rows (debit + credit). For paired records
    // (relatedLocationId is set) keep only the outgoing leg so we show one row per transfer.
    return records.filter((t) => t.relatedLocationId === null || t.quantity < 0);
  }, [rawTransfersData]);

  const filtered = useMemo(() => {
    return allTransfers.filter((t) => {
      if (filterLocationId && t.locationId !== filterLocationId && t.relatedLocationId !== filterLocationId) return false;
      if (filterStockItemId && t.stockItemId !== filterStockItemId) return false;
      if (filterFrom && new Date(t.createdAt) < new Date(filterFrom)) return false;
      if (filterTo) {
        const end = new Date(filterTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.createdAt) > end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const itemName = t.stockItem?.name ?? '';
        const fromName = t.location?.name ?? '';
        const toName = t.relatedLocation?.name ?? '';
        if (!itemName.toLowerCase().includes(q) && !fromName.toLowerCase().includes(q) && !toName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allTransfers, filterLocationId, filterStockItemId, filterFrom, filterTo, search]);

  const hasFilters = !!(filterLocationId || filterStockItemId || filterFrom || filterTo || search);

  const locationMap = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const statsThisWeek = allTransfers.filter((t) => isThisWeek(t.createdAt)).length;
  const uniqueLocations = new Set(
    allTransfers.flatMap((t) => [t.locationId, t.relatedLocationId].filter(Boolean))
  ).size;
  const uniqueItems = new Set(allTransfers.map((t) => t.stockItemId)).size;

  // ── Header slot ────────────────────────────────────────────────────────────

  const headerSlot = (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="w-60">
        <Input
          placeholder="Search item or location…"
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

      <div className="relative">
        <select value={filterLocationId} onChange={(e) => setFilterLocationId(e.target.value)} className={cn(selectClass, 'w-40')}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="relative">
        <select value={filterStockItemId} onChange={(e) => setFilterStockItemId(e.target.value)} className={cn(selectClass, 'w-40')}>
          <option value="">All items</option>
          {stockItems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-1.5">
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className={cn(selectClass, 'w-36 pr-3')} />
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className={cn(selectClass, 'w-36 pr-3')} />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSearch(''); setFilterLocationId(''); setFilterStockItemId(''); setFilterFrom(''); setFilterTo(''); }}
        >
          <X size={13} /> Clear
        </Button>
      )}

      <Button size="sm" onClick={() => setShowModal(true)} className="ml-auto shrink-0">
        <Plus size={14} /> New Transfer
      </Button>
    </div>
  );

  return (
    <PageLayout eyebrow="Operations" title="Transfers" headerBorder={false} fullHeight headerSlot={headerSlot}>
      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatCard label="Total Transfers" value={String(allTransfers.length)} icon="Repeat" iconVariant="primary" />
        <StatCard label="This Week" value={String(statsThisWeek)} icon="CalendarDays" iconVariant="info" />
        <StatCard label="Active Locations" value={String(uniqueLocations)} icon="ShoppingBag" iconVariant="success" />
        <StatCard label="Items Moved" value={String(uniqueItems)} icon="Tag" iconVariant="gold" />
      </div>

      {/* Table */}
      <div className="flex flex-col h-[calc(100%-9rem)] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[2fr_2.5fr_1.4fr_1fr_1fr_1.2fr] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
          {['Item', 'Route', 'Qty Change', 'Before → After', 'Type', 'Date'].map((h) => (
            <span key={h} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading transfers…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title={hasFilters ? 'No transfers match your filters' : 'No transfers yet'}
              description={hasFilters ? 'Try adjusting your filters or date range.' : 'Create a new transfer to move stock between locations.'}
            />
          ) : (
            filtered.map((t) => <TransferRow key={t.id} transfer={t} locationMap={locationMap} />)
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'transfer' : 'transfers'}
              {hasFilters && allTransfers.length !== filtered.length && ` of ${allTransfers.length} total`}
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <NewTransferModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['transfers', tenantId] });
            void queryClient.invalidateQueries({ queryKey: ['location-stock'] });
            addToast('success', 'Transfer completed successfully.');
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}

// ── Transfer Row ──────────────────────────────────────────────────────────────

function TransferRow({ transfer: t, locationMap }: { transfer: TransferRecord; locationMap: Map<string, string> }) {
  const [showNotes, setShowNotes] = useState(false);
  const itemName = t.stockItem?.name ?? t.stockItemId.slice(0, 8);
  const unit = t.stockItem?.unit ?? '';
  const isPositive = t.quantity >= 0;

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-[2fr_2.5fr_1.4fr_1fr_1fr_1.2fr] gap-4 px-4 py-3 border-b border-border/50 last:border-0',
          'hover:bg-surface-offset/40 transition-colors',
          t.notes && 'cursor-pointer',
        )}
        onClick={() => t.notes && setShowNotes((v) => !v)}
      >
        {/* Item */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Package size={13} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{itemName}</p>
            {unit && <p className="text-[11px] text-muted-foreground">{unit}</p>}
          </div>
        </div>

        {/* Route */}
        <RouteCell transfer={t} />

        {/* Qty change */}
        <div className="flex items-center gap-1">
          <span className={cn('text-sm font-semibold tabular-nums', isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? '+' : ''}{t.quantity}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          {t.notes && <FileText size={12} className="ml-1 text-muted-foreground/50 shrink-0" />}
        </div>

        {/* Before → After */}
        <div className="flex items-center gap-1 text-sm tabular-nums">
          <span className="text-muted-foreground">{t.quantityBefore}</span>
          <ArrowRight size={11} className="text-muted-foreground/50 shrink-0" />
          <span className={cn('font-medium', isPositive ? 'text-success' : 'text-destructive')}>{t.quantityAfter}</span>
        </div>

        {/* Type */}
        <div className="flex items-center">
          <Badge variant={typeVariant(t.type)}>{TYPE_LABELS[t.type] ?? t.type}</Badge>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays size={13} className="shrink-0" />
          <span>{formatDate(t.createdAt)}</span>
        </div>
      </div>

      {/* Notes expansion */}
      {showNotes && t.notes && (
        <div className="px-4 py-2 bg-surface-offset/30 border-b border-border/50 text-xs text-muted-foreground">
          {t.notes.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, (id) => locationMap.get(id) ?? id)}
        </div>
      )}
    </>
  );
}
