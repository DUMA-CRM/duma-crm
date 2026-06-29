'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Hash,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  type LocationStock,
  type StockItem,
  type StockMovement,
  type TenantStock,
  addTenantStock,
  createStockItem,
  getStockItemMovements,
  getStockItems,
  getTenantStock,
  getTenantStockItem,
  updateStockItem,
} from '@/lib/api/inventory.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return formatDate(dateStr);
}

type StockStatus = 'ok' | 'low' | 'critical' | 'untracked';

function warehouseStatus(qty: string, threshold: string): StockStatus {
  const q = parseFloat(qty) || 0;
  const t = parseFloat(threshold) || 0;
  if (t === 0) return 'ok';
  if (q <= t / 2) return 'critical';
  if (q <= t) return 'low';
  return 'ok';
}

function locationStatus(qty: string, threshold: string, isAvailable: boolean): Exclude<StockStatus, 'untracked'> | 'unavailable' {
  if (!isAvailable) return 'unavailable';
  const q = parseFloat(qty) || 0;
  const t = parseFloat(threshold) || 0;
  if (t === 0) return 'ok';
  if (q <= t / 2) return 'critical';
  if (q <= t) return 'low';
  return 'ok';
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }> = {
  ok: { label: 'OK', variant: 'success' },
  low: { label: 'Low', variant: 'warning' },
  critical: { label: 'Critical', variant: 'destructive' },
  untracked: { label: 'Untracked', variant: 'muted' },
  unavailable: { label: 'Unavailable', variant: 'muted' },
};

const MOVEMENT_CONFIG: Record<string, { label: string; positive: boolean | null }> = {
  adjustment: { label: 'Adjustment', positive: null },
  receive: { label: 'Received', positive: true },
  transfer_in: { label: 'Transfer In', positive: true },
  transfer_out: { label: 'Transfer Out', positive: false },
  transfer: { label: 'Transfer', positive: null },
  waste: { label: 'Waste', positive: false },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function QtyBar({ qty, threshold }: { qty: string; threshold: string }) {
  const q = parseFloat(qty) || 0;
  const t = parseFloat(threshold) || 0;
  const max = Math.max(q, t * 3, 1);
  const pct = Math.min(100, (q / max) * 100);
  const isCritical = t > 0 && q <= t / 2;
  const isLow = t > 0 && q <= t;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-300', isCritical ? 'bg-destructive' : isLow ? 'bg-warning' : 'bg-success')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatCard({ label, value, valueClass, sub }: { label: string; value: number | string; valueClass?: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-0.5">
      <p className={cn('text-3xl font-bold text-foreground', valueClass)}>{value}</p>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function LocationCard({ ls, locationName, unit }: { ls: LocationStock; locationName: string | undefined; unit: string }) {
  const status = locationStatus(ls.quantity, ls.lowThreshold, ls.isAvailable);
  const sc = STATUS_BADGE[status];
  return (
    <div className="bg-surface-offset rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={12} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{locationName ?? '—'}</span>
        </div>
        <Badge variant={sc.variant}>{sc.label}</Badge>
      </div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-xl font-bold text-foreground">{ls.quantity}</span>
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </div>
        <span className="text-xs text-muted-foreground">threshold {ls.lowThreshold}</span>
      </div>
      <QtyBar qty={ls.quantity} threshold={ls.lowThreshold} />
    </div>
  );
}

function MovementRow({ movement, unit }: { movement: StockMovement; unit: string }) {
  const cfg = MOVEMENT_CONFIG[movement.type] ?? { label: movement.type, positive: null };
  const isPositive = cfg.positive ?? movement.delta > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', isPositive ? 'bg-success/10' : 'bg-destructive/10')}>
        {isPositive ? <TrendingUp size={13} className="text-success" /> : <TrendingDown size={13} className="text-destructive" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{cfg.label}</p>
        {movement.notes && <p className="text-[11px] text-muted-foreground truncate">{movement.notes}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-xs font-bold tabular-nums', isPositive ? 'text-success' : 'text-destructive')}>
          {movement.delta > 0 ? '+' : ''}{movement.delta} {unit}
        </p>
        <p className="text-[11px] text-muted-foreground">{timeAgo(movement.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Create Stock Item Modal ───────────────────────────────────────────────────

function CreateStockItemModal({ tenantId, onClose, onSuccess }: { tenantId: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [errors, setErrors] = useState<{ name?: string; unit?: string }>({});

  const { mutate, isPending } = useMutation({
    mutationFn: () => createStockItem({ tenantId, name: name.trim(), unit: unit.trim() }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Item name is required.';
    if (!unit.trim()) errs.unit = 'Unit is required (e.g. kg, ml, units).';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutate();
  }

  return (
    <Modal title="New Stock Item" onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="NAME"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="e.g. Oat Milk, Espresso Beans"
          autoFocus
          error={errors.name}
        />
        <Input
          label="UNIT"
          value={unit}
          onChange={(e) => { setUnit(e.target.value); setErrors((p) => ({ ...p, unit: undefined })); }}
          placeholder="e.g. kg, ml, units, bags"
          hint="Used across all locations tracking this item."
          error={errors.unit}
        />
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Add to Warehouse Modal ────────────────────────────────────────────────────

function AddToWarehouseModal({
  item,
  tenantId,
  onClose,
  onSuccess,
}: {
  item: StockItem;
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [quantity, setQuantity] = useState('0');
  const [lowThreshold, setLowThreshold] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      addTenantStock({ stockItemId: item.id, quantity, lowThreshold: lowThreshold || '0' }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: () => setError('Failed to add to warehouse. Please try again.'),
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (parseFloat(quantity) < 0 || isNaN(parseFloat(quantity))) {
      setError('Enter a valid quantity.');
      return;
    }
    mutate();
  }

  const selectClass = cn(
    'w-full h-9 bg-surface-offset border border-transparent rounded-lg px-3 text-sm text-foreground',
    'outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150',
  );

  return (
    <Modal title={`Add "${item.name}" to Warehouse`} onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface-offset px-4 py-3 text-sm text-muted-foreground">
          Unit of measure: <span className="font-semibold text-foreground">{item.unit}</span>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Initial quantity</Label>
            <input
              type="number"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => { setQuantity(e.target.value); setError(''); }}
              className={selectClass}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Low threshold</Label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 100"
              value={lowThreshold}
              onChange={(e) => { setLowThreshold(e.target.value); setError(''); }}
              className={selectClass}
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add to Warehouse'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Detail Sidebar ────────────────────────────────────────────────────────────

interface SidebarProps {
  selectedId: string | null;
  stockItems: StockItem[];
  tenantStockMap: Record<string, TenantStock>;
  locationMap: Record<string, string>;
  tenantId: string | null;
  onClose: () => void;
}

function StockDetailSidebar({ selectedId, stockItems, tenantStockMap, locationMap, tenantId, onClose }: SidebarProps) {
  const item = selectedId ? (stockItems.find((s) => s.id === selectedId) ?? null) : null;
  const warehouseRow = selectedId ? (tenantStockMap[selectedId] ?? null) : null;
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => updateStockItem(selectedId!, { name: editName.trim(), unit: editUnit.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-items'] });
      setShowEdit(false);
    },
  });

  function openEdit() {
    setEditName(item?.name ?? '');
    setEditUnit(item?.unit ?? '');
    setShowEdit(true);
  }

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['tenant-stock-detail', warehouseRow?.id],
    queryFn: () => getTenantStockItem(warehouseRow!.id),
    enabled: !!warehouseRow,
  });

  const { data: movementsData, isLoading: loadingMovements } = useQuery({
    queryKey: ['stock-movements', selectedId],
    queryFn: () => getStockItemMovements(selectedId!, { limit: 8 }),
    enabled: !!selectedId,
  });

  const movements = movementsData?.data ?? [];

  if (!selectedId || !item) {
    return (
      <div className="w-115 shrink-0 border-l border-border bg-card flex items-center justify-center">
        <EmptyState icon={Package} title="No item selected" description="Click a stock item to view its full details." />
      </div>
    );
  }

  const wStatus = warehouseRow ? warehouseStatus(warehouseRow.quantity, warehouseRow.lowThreshold) : 'untracked';
  const wBadge = STATUS_BADGE[wStatus];

  return (
    <div className="w-115 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Stock Item</p>
            <p className="text-lg font-semibold text-foreground leading-snug">{item.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="muted">{item.unit}</Badge>
              <Badge variant={wBadge.variant}>{wBadge.label}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="shrink-0 mt-0.5">
            <X size={14} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-5 space-y-6">

          {/* ── Item Info ─────────────────────────────────────────────── */}
          <section>
            <Label uppercase className="mb-2.5 block">Details</Label>
            <InfoGroup>
              <InfoRow icon={Package} label="Unit of measure" value={item.unit} />
              <InfoRow icon={CalendarDays} label="Created" value={formatDate(item.createdAt)} />
              <InfoRow icon={Hash} label="Item ID" value={item.id} copyable />
            </InfoGroup>
          </section>

          {/* ── Warehouse ─────────────────────────────────────────────── */}
          <section>
            <Label uppercase className="mb-2.5 block">Warehouse Stock</Label>
            {warehouseRow ? (
              <div className="bg-surface-offset rounded-xl p-4 space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-3xl font-bold text-foreground tabular-nums">{warehouseRow.quantity}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.unit} in warehouse</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Threshold</p>
                    <p className="text-sm font-semibold text-foreground">{warehouseRow.lowThreshold} {item.unit}</p>
                  </div>
                </div>
                <QtyBar qty={warehouseRow.quantity} threshold={warehouseRow.lowThreshold} />
                {wStatus !== 'ok' && (
                  <p className={cn('text-xs font-medium', wStatus === 'critical' ? 'text-destructive' : 'text-warning')}>
                    {wStatus === 'critical' ? '⚠ Critical — stock is below half the threshold.' : '⚠ Low — stock has reached the threshold.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-surface-offset rounded-xl p-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Not tracked in warehouse</p>
                {tenantId && (
                  <Button size="xs" onClick={() => setShowAddWarehouse(true)} className="gap-1 shrink-0">
                    <Warehouse size={11} /> Add
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* ── Location Breakdown ────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <Label uppercase>Location Breakdown</Label>
              {detail && (() => { const locs = detail.locations ?? []; return <span className="text-xs text-muted-foreground">{locs.length} location{locs.length !== 1 ? 's' : ''}</span>; })()}
            </div>
            {loadingDetail ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-24 bg-surface-offset rounded-xl animate-pulse" />)}
              </div>
            ) : !warehouseRow ? (
              <div className="bg-surface-offset rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">Add to warehouse first to see location breakdown</p>
              </div>
            ) : !detail || (detail.locations ?? []).length === 0 ? (
              <div className="bg-surface-offset rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">Not assigned to any location</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(detail.locations ?? []).map((ls) => (
                  <LocationCard key={ls.id} ls={ls} locationName={locationMap[ls.locationId]} unit={item.unit} />
                ))}
              </div>
            )}
          </section>

          {/* ── Recent Activity ───────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <Label uppercase>Recent Activity</Label>
              {movementsData && movementsData.total > 8 && (
                <span className="text-xs text-muted-foreground">{movementsData.total} total</span>
              )}
            </div>
            {loadingMovements ? (
              <div className="bg-surface-offset rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 border-b border-border last:border-0 animate-pulse" />)}
              </div>
            ) : movements.length === 0 ? (
              <div className="bg-surface-offset rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">No movements recorded yet</p>
              </div>
            ) : (
              <div className="bg-surface-offset rounded-xl divide-y divide-border overflow-hidden">
                {movements.map((m) => <MovementRow key={m.id} movement={m} unit={item.unit} />)}
              </div>
            )}
          </section>

        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border shrink-0 flex flex-col gap-2">
        <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={openEdit}>
          <Pencil size={13} />
          Edit Stock Item
        </Button>
        <Link
          href="/inventory/stock-control"
          className="flex items-center justify-center gap-1.5 h-9 w-full rounded-lg border border-border bg-background text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowRight size={13} />
          Add to Location (Stock Control)
        </Link>
      </div>

      {showAddWarehouse && tenantId && (
        <AddToWarehouseModal
          item={item}
          tenantId={tenantId}
          onClose={() => setShowAddWarehouse(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['tenant-stock'] });
            void qc.invalidateQueries({ queryKey: ['tenant-stock-detail', selectedId] });
          }}
        />
      )}

      {showEdit && (
        <Modal title={`Edit "${item.name}"`} onClose={() => setShowEdit(false)}>
          <form
            onSubmit={(e) => { e.preventDefault(); save(); }}
            className="space-y-4"
          >
            <Input
              label="NAME"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="UNIT"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="ml, g, kg, units…"
              required
              hint="Changing the unit affects all locations tracking this item."
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !editName.trim() || !editUnit.trim()}
                className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Stock Row ─────────────────────────────────────────────────────────────────

function StockRow({
  item,
  tsRow,
  isSelected,
  onClick,
}: {
  item: StockItem;
  tsRow: TenantStock | undefined;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status: StockStatus = tsRow ? warehouseStatus(tsRow.quantity, tsRow.lowThreshold) : 'untracked';
  const sc = STATUS_BADGE[status];

  return (
    <tr
      onClick={onClick}
      className={cn(
        'group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer',
        isSelected && 'bg-primary/5 hover:bg-primary/5 border-primary/10',
      )}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', isSelected ? 'bg-primary/20' : 'bg-primary/10')}>
            <Package size={13} className="text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{item.name}</p>
        </div>
      </td>
      <td className="px-5 py-3.5">
        <Badge variant="muted">{item.unit}</Badge>
      </td>
      <td className="px-5 py-3.5">
        {tsRow ? (
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {tsRow.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        {tsRow ? (
          <div className="flex items-center gap-2 max-w-30">
            <QtyBar qty={tsRow.quantity} threshold={tsRow.lowThreshold} />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <Badge variant={sc.variant}>{sc.label}</Badge>
      </td>
      <td className="px-5 py-3.5 pr-6 text-right">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.createdAt)}</span>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockDetailsPage() {
  const { tenantId } = useWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: stockItems = [], isLoading } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
  });

  const { data: tenantStock = [] } = useQuery({
    queryKey: ['tenant-stock'],
    queryFn: getTenantStock,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const tenantStockMap = Object.fromEntries(tenantStock.map((ts) => [ts.stockItemId, ts]));
  const locationMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  // Stats
  const statTotal = stockItems.length;
  const statInWarehouse = tenantStock.length;
  const statLow = tenantStock.filter((ts) => {
    const s = warehouseStatus(ts.quantity, ts.lowThreshold);
    return s === 'low' || s === 'critical';
  }).length;
  const statUntracked = stockItems.filter((item) => !tenantStockMap[item.id]).length;

  const filtered = search.trim()
    ? stockItems.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : stockItems;

  return (
    <>
    <PageLayout
      eyebrow="Operations"
      title="Stock Details"
      headerBorder={false}
      sidebar={
        <StockDetailSidebar
          selectedId={selectedId}
          stockItems={stockItems}
          tenantStockMap={tenantStockMap}
          locationMap={locationMap}
          tenantId={tenantId}
          onClose={() => setSelectedId(null)}
        />
      }
    >
      <div className="flex flex-col h-full gap-4 overflow-hidden">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <StatCard label="Total Items" value={statTotal} />
          <StatCard label="In Warehouse" value={statInWarehouse} valueClass={statInWarehouse > 0 ? 'text-primary' : undefined} sub={statTotal > 0 ? `${Math.round((statInWarehouse / statTotal) * 100)}% tracked` : undefined} />
          <StatCard label="Low / Critical" value={statLow} valueClass={statLow > 0 ? 'text-destructive' : undefined} sub={statLow > 0 ? 'Need attention' : 'All levels OK'} />
          <StatCard label="Not in Warehouse" value={statUntracked} valueClass={statUntracked > 0 ? 'text-warning' : undefined} />
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">

          {/* Search bar */}
          <div className="px-5 py-3 border-b border-border shrink-0 flex items-center gap-3">
            <div className="max-w-sm flex-1">
              <Input
                placeholder="Search stock items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={13} />}
              />
            </div>
            {tenantId && (
              <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shrink-0">
                <Plus size={14} /> New Item
              </Button>
            )}
          </div>

          {/* Table content */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/40">
                  {[
                    { label: 'Item', right: false },
                    { label: 'Unit', right: false },
                    { label: 'Warehouse Qty', right: false },
                    { label: 'Level', right: false },
                    { label: 'Status', right: false },
                    { label: 'Added', right: true },
                  ].map(({ label, right }) => (
                    <th
                      key={label}
                      className={cn('px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest', right ? 'text-right pr-6' : 'text-left')}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 11 + j * 19) % 40)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24">
                      <EmptyState
                        icon={Package}
                        title={search ? 'No results found' : 'No stock items'}
                        description={search ? 'Try a different search term.' : 'Stock items will appear here once created.'}
                      />
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <StockRow
                      key={item.id}
                      item={item}
                      tsRow={tenantStockMap[item.id]}
                      isSelected={selectedId === item.id}
                      onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                {statLow > 0 && <span className="text-destructive ml-2">· {statLow} need attention</span>}
              </p>
              {!selectedId && <p className="text-xs text-muted-foreground">Click a row to view details</p>}
            </div>
          )}
        </div>
      </div>
    </PageLayout>

      {showCreate && tenantId && (
        <CreateStockItemModal
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => void queryClient.invalidateQueries({ queryKey: ['stock-items'] })}
        />
      )}
    </>
  );
}
