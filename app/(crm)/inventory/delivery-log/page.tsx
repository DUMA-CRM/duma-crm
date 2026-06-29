'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ListFilter,
  Plus,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { DeliveryModal } from '@/components/inventory/DeliveryModal';
import { DeliveryRow } from '@/components/inventory/DeliveryRow';
import { DeliverySidebar } from '@/components/inventory/DeliverySidebar';
import { FilterSelect } from '@/components/inventory/FilterSelect';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatCard } from '@/components/shared/StatCard';
import { Toast, type ToastMessage } from '@/components/shared/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  type DeliveryRecord,
  deleteDelivery,
  getDeliveryLog,
} from '@/lib/api/delivery.service';
import { getSuppliers } from '@/lib/api/supplier.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { STATUS_LABELS, STATUS_OPTIONS } from '@/components/inventory/DeliverySidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

function normaliseArray<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const r = raw as { data?: T[] };
  if (Array.isArray(r.data)) return r.data;
  return Object.values(raw as object) as T[];
}

const selectClass = cn(
  'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 pr-8 text-sm text-foreground',
  'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15',
  'transition-[border-color,box-shadow] duration-150 appearance-none cursor-pointer',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DeliveryLogPage() {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [editEntry, setEditEntry] = useState<DeliveryRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', message: string) =>
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: getSuppliers,
  });

  const { data: rawDeliveries, isLoading } = useQuery({
    queryKey: ['delivery-log', tenantId],
    queryFn: () => getDeliveryLog({ tenantId: tenantId!, limit: 100 }),
    enabled: !!tenantId,
  });

  const allDeliveries = useMemo(() => normaliseArray<DeliveryRecord>(rawDeliveries), [rawDeliveries]);

  const filtered = useMemo(() => {
    return allDeliveries.filter((d) => {
      if (filterLocationId && d.locationId !== filterLocationId) return false;
      if (filterSupplierId && d.supplierId !== filterSupplierId) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterFrom && new Date(d.createdAt) < new Date(filterFrom)) return false;
      if (filterTo) {
        const end = new Date(filterTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(d.createdAt) > end) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const locName = d.location?.name ?? '';
        const supName = d.supplier?.name ?? '';
        const notes = d.notes ?? '';
        if (!locName.toLowerCase().includes(q) && !supName.toLowerCase().includes(q) && !notes.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allDeliveries, filterLocationId, filterSupplierId, filterStatus, filterFrom, filterTo, search]);

  const hasFilters = !!(filterLocationId || filterSupplierId || filterStatus || filterFrom || filterTo || search);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const pending = allDeliveries.filter((d) => d.status === 'pending').length;
  const receivedThisWeek = allDeliveries.filter((d) => d.status === 'received' && isThisWeek(d.createdAt)).length;
  const uniqueSuppliers = new Set(allDeliveries.map((d) => d.supplierId).filter(Boolean)).size;

  function clearFilters() {
    setSearch(''); setFilterLocationId(''); setFilterSupplierId(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('');
  }

  const activeFilterCount = [filterLocationId, filterSupplierId, filterStatus, filterFrom, filterTo].filter(Boolean).length;

  // ── Header slot ────────────────────────────────────────────────────────────
  const headerSlot = (
    <div className="space-y-2">
      {/* Row 1: search + filter toggle + action */}
      <div className="flex items-center gap-2">
        <div className="w-72">
          <Input
            placeholder="Search supplier, location or notes…"
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

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors',
            showFilters || activeFilterCount > 0
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80',
          )}
        >
          <ListFilter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} /> Clear all
          </button>
        )}

        <Button size="sm" onClick={() => setShowCreate(true)} className="ml-auto shrink-0">
          <Plus size={14} /> New Delivery
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Location */}
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Location</Label>
              <FilterSelect value={filterLocationId} onChange={setFilterLocationId} label="Location" active={!!filterLocationId}>
                <option value="">All locations</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </FilterSelect>
            </div>

            {/* Supplier */}
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Supplier</Label>
              <FilterSelect value={filterSupplierId} onChange={setFilterSupplierId} label="Supplier" active={!!filterSupplierId}>
                <option value="">All suppliers</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </FilterSelect>
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Status</Label>
              <FilterSelect value={filterStatus} onChange={setFilterStatus} label="Status" active={!!filterStatus}>
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </FilterSelect>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Date range</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className={cn(selectClass, filterFrom && 'border-primary/40 bg-primary/5 text-primary')}
                  />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">→</span>
                <div className="relative flex-1">
                  <input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className={cn(selectClass, filterTo && 'border-primary/40 bg-primary/5 text-primary')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const selectedDelivery = useMemo(
    () => allDeliveries.find((d) => d.id === selectedId) ?? null,
    [allDeliveries, selectedId],
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['delivery-log', tenantId] });
  }

  const sidebar = (
    <DeliverySidebar
      delivery={selectedDelivery}
      onClose={() => setSelectedId(null)}
      onEdit={(d) => setEditEntry(d)}
      onDelete={(d) => {
        setSelectedId(null);
        deleteDelivery(d.id)
          .then(() => { invalidate(); addToast('success', 'Delivery deleted.'); })
          .catch(() => addToast('error', 'Failed to delete delivery.'));
      }}
    />
  );

  return (
    <PageLayout eyebrow="Operations" title="Delivery Log" headerBorder={false} sidebar={sidebar} headerSlot={headerSlot}>
      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatCard label="Total Deliveries" value={String(allDeliveries.length)} icon="ShoppingBag" iconVariant="primary" />
        <StatCard label="Pending" value={String(pending)} icon="Tag" iconVariant="gold"
          delta={pending > 0 ? String(pending) : undefined} deltaDirection={pending > 0 ? 'down' : undefined} />
        <StatCard label="Received This Week" value={String(receivedThisWeek)} icon="Receipt" iconVariant="success" />
        <StatCard label="Suppliers" value={String(uniqueSuppliers)} icon="Users" iconVariant="info" />
      </div>

      {/* Table */}
      <div className="flex flex-col h-[calc(100%-9rem)] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1.2fr_64px] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
          {['Supplier', 'Location', 'Items', 'Status', 'Created', ''].map((h, i) => (
            <span key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{h}</span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading deliveries…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={hasFilters ? 'No deliveries match your filters' : 'No deliveries yet'}
              description={hasFilters ? 'Try adjusting your filters or date range.' : 'Create a delivery to start tracking incoming stock.'}
            />
          ) : (
            filtered.map((d) => (
              <DeliveryRow
                key={d.id}
                delivery={d}
                selected={selectedId === d.id}
                onSelect={() => setSelectedId((prev) => prev === d.id ? null : d.id)}
                onEdit={() => setEditEntry(d)}
                onDelete={() => { invalidate(); addToast('success', 'Delivery deleted.'); }}
                onDeleteError={() => addToast('error', 'Failed to delete delivery.')}
              />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'delivery' : 'deliveries'}
              {hasFilters && allDeliveries.length !== filtered.length && ` of ${allDeliveries.length} total`}
            </p>
          </div>
        )}
      </div>

      {showCreate && (
        <DeliveryModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSuccess={() => { invalidate(); addToast('success', 'Delivery created.'); }}
        />
      )}

      {editEntry && (
        <DeliveryModal
          mode="edit"
          initial={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => { invalidate(); addToast('success', 'Delivery updated.'); }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}
