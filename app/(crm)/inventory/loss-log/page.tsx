'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  MapPin,
  Package,
  PackageMinus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
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

import { getLocationStock, getStockItems } from '@/lib/api/inventory.service';
import {
  type CreateLossPayload,
  type LossReason,
  type LossRecord,
  createLossEntry,
  deleteLossEntry,
  getLossLog,
} from '@/lib/api/loss.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

// Notes are encoded as "<reason>:<user notes>", e.g. "theft:left unlocked"
function parseLossNotes(raw: string | null): { reason: string | null; notes: string | null } {
  if (!raw) return { reason: null, notes: null };
  const colonIdx = raw.indexOf(':');
  if (colonIdx === -1) return { reason: null, notes: raw.trim() || null };
  const reason = raw.slice(0, colonIdx).trim().toLowerCase();
  const notes = raw.slice(colonIdx + 1).trim() || null;
  return { reason, notes };
}

function encodeLossNotes(reason: LossReason, notes: string): string {
  return notes ? `${reason}:${notes}` : `${reason}:`;
}

const REASON_LABELS: Record<LossReason, string> = {
  waste: 'Waste',
  spoilage: 'Spoilage',
  theft: 'Theft',
  damage: 'Damage',
  expiry: 'Expiry',
  other: 'Other',
};

const REASON_OPTIONS: { value: LossReason; label: string }[] = [
  { value: 'waste', label: 'Waste' },
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'damage', label: 'Damage' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'theft', label: 'Theft' },
  { value: 'other', label: 'Other' },
];

function reasonVariant(type: string): 'warning' | 'destructive' | 'muted' | 'amber' {
  if (type === 'theft') return 'destructive';
  if (type === 'spoilage' || type === 'expiry') return 'warning';
  if (type === 'damage') return 'amber';
  return 'muted';
}

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

// ── New Loss Entry Modal ──────────────────────────────────────────────────────

interface NewLossModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function NewLossModal({ onClose, onSuccess }: NewLossModalProps) {
  const { tenantId } = useWorkspaceStore();

  const [locationId, setLocationId] = useState('');
  const [stockItemId, setStockItemId] = useState('');
  const [qty, setQty] = useState('');
  const [type, setType] = useState<LossReason>('waste');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const availableItems = locationStock.filter((ls) => ls.isAvailable && ls.stockItem && parseFloat(ls.quantity) > 0);
  const selectedItem = availableItems.find((ls) => ls.stockItemId === stockItemId);
  const currentQty = selectedItem ? parseFloat(selectedItem.quantity) : 0;

  const { mutate: submit, isPending } = useMutation({
    mutationFn: (data: CreateLossPayload) => createLossEntry(data),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!locationId) errs.location = 'Select a location.';
    if (!stockItemId) errs.item = 'Select an item.';
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) errs.qty = 'Enter a valid quantity.';
    else if (qtyNum > currentQty) errs.qty = `Max available: ${currentQty}`;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    submit({ stockItemId, locationId, quantity: qtyNum, type, notes: encodeLossNotes(type, notes) });
  }

  return (
    <Modal title="Log Loss" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Location</Label>
          <div className="relative">
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setStockItemId(''); setErrors((p) => ({ ...p, location: undefined! })); }}
              className={cn(selectClass, errors.location && 'border-destructive/60')}
            >
              <option value="">Select location…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
        </div>

        {/* Item */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select
              value={stockItemId}
              onChange={(e) => { setStockItemId(e.target.value); setErrors((p) => ({ ...p, item: undefined! })); }}
              disabled={!locationId || loadingStock}
              className={cn(selectClass, errors.item && 'border-destructive/60')}
            >
              <option value="">
                {loadingStock ? 'Loading…' : !locationId ? 'Select a location first' : availableItems.length === 0 ? 'No items available' : 'Select item…'}
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

        {/* Quantity */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="QUANTITY LOST"
              type="number"
              min={0.01}
              step="any"
              value={qty}
              onChange={(e) => { setQty(e.target.value); setErrors((p) => ({ ...p, qty: undefined! })); }}
              placeholder="0"
              error={errors.qty}
              hint={selectedItem ? `Available: ${currentQty} ${selectedItem.stockItem?.unit ?? ''}` : undefined}
            />
          </div>
          <div className={cn(
            'h-9 px-3 bg-surface-offset rounded-lg flex items-center text-sm font-medium shrink-0 border border-transparent',
            selectedItem?.stockItem?.unit ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {selectedItem?.stockItem?.unit ?? 'unit'}
          </div>
        </div>

        {/* Type / Reason */}
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Reason</Label>
          <div className="relative">
            <select value={type} onChange={(e) => setType(e.target.value as LossReason)} className={selectClass}>
              {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
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
            placeholder="Additional details about this loss…"
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
            {isPending ? 'Logging…' : 'Log Loss'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LossLogPage() {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterStockItemId, setFilterStockItemId] = useState('');
  const [filterType, setFilterType] = useState('');
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

  const { data: rawLossData, isLoading } = useQuery({
    queryKey: ['loss-log', tenantId],
    queryFn: () => getLossLog({ tenantId: tenantId!, limit: 100 }),
    enabled: !!tenantId,
  });

  const allEntries = useMemo(() => {
    if (!rawLossData) return [];
    if (Array.isArray(rawLossData)) return rawLossData;
    const r = rawLossData as unknown as { data?: LossRecord[] };
    if (Array.isArray(r.data)) return r.data;
    return Object.values(rawLossData) as LossRecord[];
  }, [rawLossData]);

  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      if (filterLocationId && e.locationId !== filterLocationId) return false;
      if (filterStockItemId && e.stockItemId !== filterStockItemId) return false;
      if (filterType && parseLossNotes(e.notes).reason !== filterType) return false;
      if (filterFrom && new Date(e.createdAt) < new Date(filterFrom)) return false;
      if (filterTo) {
        const end = new Date(filterTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(e.createdAt) > end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const itemName = e.stockItem?.name ?? '';
        const locName = e.location?.name ?? '';
        if (!itemName.toLowerCase().includes(q) && !locName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allEntries, filterLocationId, filterStockItemId, filterType, filterFrom, filterTo, search]);

  const hasFilters = !!(filterLocationId || filterStockItemId || filterType || filterFrom || filterTo || search);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const thisWeekCount = allEntries.filter((e) => isThisWeek(e.createdAt)).length;
  const uniqueItems = new Set(allEntries.map((e) => e.stockItemId)).size;
  const theftCount = allEntries.filter((e) => e.type === 'theft').length;

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

      <div className="relative">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={cn(selectClass, 'w-36')}>
          <option value="">All reasons</option>
          {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          onClick={() => { setSearch(''); setFilterLocationId(''); setFilterStockItemId(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); }}
        >
          <X size={13} /> Clear
        </Button>
      )}

      <Button size="sm" onClick={() => setShowModal(true)} className="ml-auto shrink-0">
        <Plus size={14} /> Log Loss
      </Button>
    </div>
  );

  return (
    <PageLayout eyebrow="Operations" title="Loss Log" headerBorder={false} fullHeight headerSlot={headerSlot}>
      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatCard label="Total Entries" value={String(allEntries.length)} icon="Receipt" iconVariant="primary" />
        <StatCard label="This Week" value={String(thisWeekCount)} icon="CalendarDays" iconVariant="info" />
        <StatCard label="Items Affected" value={String(uniqueItems)} icon="Tag" iconVariant="gold" />
        <StatCard
          label="Theft Reports"
          value={String(theftCount)}
          icon="ShoppingBag"
          iconVariant="primary"
          delta={theftCount > 0 ? String(theftCount) : undefined}
          deltaDirection={theftCount > 0 ? 'down' : undefined}
        />
      </div>

      {/* Table */}
      <div className="flex flex-col h-[calc(100%-9rem)] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[2fr_1.5fr_1.1fr_1.1fr_1fr_1.5fr_28px] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
          {['Item', 'Location', 'Qty Lost', 'Before → After', 'Reason', 'Notes', ''].map((h, i) => (
            <span key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading loss log…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={PackageMinus}
              title={hasFilters ? 'No entries match your filters' : 'No loss entries yet'}
              description={hasFilters ? 'Try adjusting your filters or date range.' : 'Log a loss to start tracking inventory shrinkage.'}
            />
          ) : (
            filtered.map((e) => (
              <LossRow
                key={e.id}
                entry={e}
                onDelete={() => {
                  void queryClient.invalidateQueries({ queryKey: ['loss-log', tenantId] });
                  addToast('success', 'Entry deleted.');
                }}
                onDeleteError={() => addToast('error', 'Failed to delete entry.')}
              />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              {hasFilters && allEntries.length !== filtered.length && ` of ${allEntries.length} total`}
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <NewLossModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['loss-log', tenantId] });
            void queryClient.invalidateQueries({ queryKey: ['location-stock'] });
            addToast('success', 'Loss entry recorded.');
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}

// ── Loss Row ──────────────────────────────────────────────────────────────────

function LossRow({ entry: e, onDelete, onDeleteError }: {
  entry: LossRecord;
  onDelete: () => void;
  onDeleteError: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { mutate: remove, isPending } = useMutation({
    mutationFn: () => deleteLossEntry(e.id),
    onSuccess: onDelete,
    onError: onDeleteError,
  });

  const itemName = e.stockItem?.name ?? e.stockItemId.slice(0, 8);
  const unit = e.stockItem?.unit ?? '';
  const locName = e.location?.name ?? '—';
  const { reason: parsedReason, notes: displayNotes } = parseLossNotes(e.notes);
  const displayReason = (parsedReason ?? e.type) as LossReason;
  const absQty = Math.abs(e.quantity);

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className={cn(
        'grid grid-cols-[2fr_1.5fr_1.1fr_1.1fr_1fr_1.5fr_28px] gap-4 px-4 py-3',
        'hover:bg-surface-offset/40 transition-colors',
      )}>
        {/* Item */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
            <Package size={13} className="text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{itemName}</p>
            {unit && <p className="text-[11px] text-muted-foreground">{unit}</p>}
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <MapPin size={13} className="shrink-0" />
          <span className="truncate">{locName}</span>
        </div>

        {/* Qty lost */}
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-destructive tabular-nums">-{absQty}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>

        {/* Before → After */}
        <div className="flex items-center gap-1 text-sm tabular-nums">
          <span className="text-muted-foreground">{e.quantityBefore}</span>
          <ArrowRight size={11} className="text-muted-foreground/50 shrink-0" />
          <span className="font-medium text-destructive">{e.quantityAfter}</span>
        </div>

        {/* Reason badge */}
        <div className="flex items-center">
          <Badge variant={reasonVariant(displayReason)}>{REASON_LABELS[displayReason] ?? displayReason}</Badge>
        </div>

        {/* Notes */}
        <div className="flex items-center min-w-0">
          {displayNotes ? (
            <span className="text-xs text-muted-foreground truncate" title={displayNotes}>{displayNotes}</span>
          ) : (
            <span className="text-xs text-muted-foreground/30">—</span>
          )}
        </div>

        {/* Delete */}
        <div className="flex items-center">
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/5 border-t border-destructive/10">
          <AlertTriangle size={14} className="text-destructive shrink-0" />
          <p className="text-xs text-destructive flex-1">Delete this entry? This cannot be undone.</p>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            size="sm"
            className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
            disabled={isPending}
            onClick={() => remove()}
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}
    </div>
  );
}
