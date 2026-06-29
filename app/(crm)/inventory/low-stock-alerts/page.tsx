'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ListFilter,
  MapPin,
  Package,
  PackagePlus,
  Search,
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

import { type LowStockAlert, getLowStockAlerts } from '@/lib/api/inventory.service';
import { type CreateRestockRequestPayload, createRestockRequest } from '@/lib/api/restock.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Severity = 'stockout' | 'critical' | 'low';

function getSeverity(qty: number, threshold: number): Severity {
  if (qty <= 0) return 'stockout';
  if (qty <= threshold * 0.5) return 'critical';
  return 'low';
}

function stockPct(qty: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.min((qty / threshold) * 100, 100);
}

const SEVERITY_LABEL: Record<Severity, string> = {
  stockout: 'Stockout',
  critical: 'Critical',
  low: 'Low',
};

const SEVERITY_VARIANT: Record<Severity, 'destructive' | 'warning' | 'amber'> = {
  stockout: 'destructive',
  critical: 'warning',
  low: 'amber',
};

const SEVERITY_BAR: Record<Severity, string> = {
  stockout: 'bg-destructive',
  critical: 'bg-warning',
  low: 'bg-amber-400',
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

// ── Quick Restock Modal ───────────────────────────────────────────────────────

function RestockModal({
  alert,
  onClose,
  onSuccess,
}: {
  alert: LowStockAlert;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateRestockRequestPayload) => createRestockRequest(payload),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const n = parseFloat(qty);
    if (!n || n <= 0) { setError('Enter a valid quantity.'); return; }
    mutate({
      stockItemId: alert.stockItemId,
      locationId: alert.locationId,
      requestedQty: n,
      notes: notes || undefined,
    });
  }

  const itemName = alert.stockItem?.name ?? alert.stockItemId.slice(0, 8);
  const unit = alert.stockItem?.unit ?? '';

  return (
    <Modal title="Request Restock" onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface-offset px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{itemName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Current: <span className="font-semibold text-foreground">{parseFloat(alert.quantity)} {unit}</span>
            {' · '}Threshold: <span className="font-semibold text-foreground">{parseFloat(alert.lowThreshold)} {unit}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label uppercase>Quantity to request ({unit || 'units'})</Label>
          <input
            type="number"
            min={0.01}
            step="any"
            placeholder="e.g. 50"
            value={qty}
            onChange={(e) => { setQty(e.target.value); setError(''); }}
            className={cn(selectClass, error && 'border-destructive/60')}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <Label uppercase>Notes</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Urgency, supplier preference…"
            rows={2}
            className={cn(
              'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none resize-none',
              'focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150',
            )}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Requesting…' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onRestock,
}: {
  alert: LowStockAlert & { severity: Severity; qty: number; threshold: number };
  onRestock: () => void;
}) {
  const pct = stockPct(alert.qty, alert.threshold);

  return (
    <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1fr_100px] gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-surface-offset/30 transition-colors">
      {/* Item */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
          alert.severity === 'stockout' ? 'bg-destructive/10' : alert.severity === 'critical' ? 'bg-warning/10' : 'bg-amber-400/10',
        )}>
          <Package size={13} className={
            alert.severity === 'stockout' ? 'text-destructive' : alert.severity === 'critical' ? 'text-warning' : 'text-amber-500'
          } />
        </div>
        <span className="text-sm font-medium text-foreground truncate">
          {alert.stockItem?.name ?? alert.stockItemId.slice(0, 8)}
        </span>
      </div>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
        <MapPin size={13} className="shrink-0" />
        <span className="truncate">{alert.location?.name ?? '—'}</span>
      </div>

      {/* Current qty */}
      <div className="flex items-center">
        <span className={cn('text-sm font-semibold tabular-nums', alert.severity === 'stockout' && 'text-destructive')}>
          {alert.qty}
          {alert.stockItem?.unit && <span className="font-normal text-muted-foreground ml-1 text-xs">{alert.stockItem.unit}</span>}
        </span>
      </div>

      {/* Threshold */}
      <div className="flex items-center text-sm text-muted-foreground tabular-nums">
        {alert.threshold}
        {alert.stockItem?.unit && <span className="ml-1 text-xs">{alert.stockItem.unit}</span>}
      </div>

      {/* Stock level bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', SEVERITY_BAR[alert.severity])}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(pct)}%</span>
      </div>

      {/* Severity */}
      <div className="flex items-center">
        <Badge variant={SEVERITY_VARIANT[alert.severity]}>{SEVERITY_LABEL[alert.severity]}</Badge>
      </div>

      {/* Action */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 px-2"
          onClick={onRestock}
        >
          <PackagePlus size={12} /> Request
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type SeverityFilter = 'all' | Severity;

export default function LowStockAlertsPage() {
  const { tenantId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterLocationId, setFilterLocationId] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [restockTarget, setRestockTarget] = useState<LowStockAlert | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error', message: string) =>
    setToasts((prev) => [...prev, { id: Date.now(), type, message }]);
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: rawAlerts, isLoading } = useQuery({
    queryKey: ['low-stock-alerts', filterLocationId],
    queryFn: () => getLowStockAlerts(filterLocationId || undefined),
    enabled: true,
  });

  const enriched = useMemo(() => {
    const alerts = normaliseArray<LowStockAlert>(rawAlerts);
    return alerts.map((a) => {
      const qty = parseFloat(a.quantity);
      const threshold = parseFloat(a.lowThreshold);
      return { ...a, qty, threshold, severity: getSeverity(qty, threshold) };
    });
  }, [rawAlerts]);

  const filtered = useMemo(() => {
    return enriched.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = a.stockItem?.name?.toLowerCase() ?? '';
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, severityFilter, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stockouts = enriched.filter((a) => a.severity === 'stockout').length;
  const critical = enriched.filter((a) => a.severity === 'critical').length;
  const low = enriched.filter((a) => a.severity === 'low').length;

  const activeFilterCount = [filterLocationId].filter(Boolean).length;
  const hasFilters = !!(filterLocationId || search || severityFilter !== 'all');

  function clearFilters() {
    setSearch('');
    setFilterLocationId('');
    setSeverityFilter('all');
  }

  const SEVERITY_TABS: { value: SeverityFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: enriched.length },
    { value: 'stockout', label: 'Stockout', count: stockouts },
    { value: 'critical', label: 'Critical', count: critical },
    { value: 'low', label: 'Low', count: low },
  ];

  return (
    <PageLayout eyebrow="Inventory" title="Low Stock Alerts" headerBorder={false} fullHeight>
      {/* Header bar */}
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

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
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
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-4 max-w-sm">
              <div className="flex flex-col gap-1.5">
                <Label uppercase>Location</Label>
                <div className="relative">
                  <select
                    value={filterLocationId}
                    onChange={(e) => setFilterLocationId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All locations</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Severity tabs */}
        <div className="flex items-center gap-1">
          {SEVERITY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSeverityFilter(tab.value)}
              className={cn(
                'flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors',
                severityFilter === tab.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-offset',
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  'flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold',
                  severityFilter === tab.value ? 'bg-background/20 text-background' : 'bg-surface-offset text-muted-foreground',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <StatCard label="Total Alerts" value={String(enriched.length)} icon="Tag" iconVariant="primary" />
        <StatCard
          label="Stockout"
          value={String(stockouts)}
          icon="ShoppingBag"
          iconVariant="gold"
          delta={stockouts > 0 ? String(stockouts) : undefined}
          deltaDirection={stockouts > 0 ? 'down' : undefined}
        />
        <StatCard
          label="Critical"
          value={String(critical)}
          icon="Tag"
          iconVariant="gold"
          delta={critical > 0 ? String(critical) : undefined}
          deltaDirection={critical > 0 ? 'down' : undefined}
        />
        <StatCard label="Low" value={String(low)} icon="Receipt" iconVariant="info" />
      </div>

      {/* Table */}
      <div className="flex flex-col h-[calc(100%-16rem)] overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1fr_100px] gap-4 px-4 py-2.5 border-b border-border bg-surface-offset/50 shrink-0">
          {['Item', 'Location', 'Current', 'Threshold', 'Stock Level', 'Severity', ''].map((h, i) => (
            <span key={i} className={cn('text-[10px] font-bold text-muted-foreground uppercase tracking-widest', i === 6 && 'text-right')}>
              {h}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Loading alerts…</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={hasFilters ? 'No alerts match your filters' : 'All stock levels are healthy'}
              description={
                hasFilters
                  ? 'Try adjusting your filters.'
                  : 'No items are currently below their low-stock threshold.'
              }
            />
          ) : (
            filtered.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onRestock={() => setRestockTarget(alert)}
              />
            ))
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'alert' : 'alerts'}
              {hasFilters && enriched.length !== filtered.length && ` of ${enriched.length} total`}
            </p>
          </div>
        )}
      </div>

      {restockTarget && (
        <RestockModal
          alert={restockTarget}
          onClose={() => setRestockTarget(null)}
          onSuccess={() => {
            addToast('success', 'Restock request submitted.');
            void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
          }}
        />
      )}

      <Toast toasts={toasts} onDismiss={removeToast} />
    </PageLayout>
  );
}
