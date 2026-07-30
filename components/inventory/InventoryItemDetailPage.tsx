'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Box,
  Boxes,
  CalendarClock,
  CalendarDays,
  Candy,
  CircleDot,
  Combine,
  Droplet,
  Droplets,
  Egg,
  Flame,
  Gauge,
  History,
  LayoutDashboard,
  type LucideIcon,
  Package,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Scissors,
  Sprout,
  TrendingDown,
  TriangleAlert,
  Wheat,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  EditStockItemModal,
  EditThresholdModal,
  LogLossModal,
  RestockModal,
} from '@/components/inventory/stock/StockModals';
import {
  REASON_LABELS,
  STATUS_BAR,
  STATUS_LABEL,
  STATUS_VARIANT,
  daysColor,
  fmtQty,
  formatDate,
  getStatus,
  normaliseArray,
  parseLossNotes,
  stockPct,
  timeAgo,
} from '@/components/inventory/stock/shared';
import { ItemTransfersSection, TransferStockModal } from '@/components/inventory/transfers/TransferStock';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import {
  type InventoryForecast,
  type InventoryOverviewRow,
  type LocationStock,
  NUTRITION_FIELDS,
  type NutritionBasis,
  type StockMovement,
  type StockUnit,
  combineStockUnits,
  getInventoryForecast,
  getInventoryOverview,
  getLocationStock,
  getStockItem,
  getStockItemMovements,
  getStockUnits,
  receiveStockUnits,
  removeLocationStock,
  splitStockUnit,
  updateLocationStock,
} from '@/lib/api/inventory.service';
import { type LossRecord, getLossLog } from '@/lib/api/loss.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const fmt = (value: string | number) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 });
const when = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const LEDGER_PAGE_SIZE = 25;

const BASIS_LABEL: Record<NutritionBasis, string> = {
  per_100g: 'per 100 g',
  per_100ml: 'per 100 ml',
  per_piece: 'per piece',
};

const NUTRITION_ICONS: Record<string, LucideIcon> = {
  kcal: Flame,
  fat: Droplet,
  saturates: Droplets,
  carbs: Wheat,
  sugars: Candy,
  fibre: Sprout,
  protein: Egg,
  salt: CircleDot,
};

type ItemSection = 'overview' | 'containers' | 'ledger' | 'losses' | 'transfers';

const ITEM_SECTIONS: SectionTab<ItemSection>[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'containers', label: 'Containers', icon: Box },
  { value: 'ledger', label: 'Ledger', icon: History },
  { value: 'losses', label: 'Losses', icon: PackageMinus },
  { value: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
];

export function InventoryItemDetailPage({ stockItemId }: { stockItemId: string }) {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<ItemSection>('overview');
  const [ledgerPage, setLedgerPage] = useState(1);

  // Modal flags — every action the old detail sidebar owned now lives here.
  const [editThreshold, setEditThreshold] = useState(false);
  const [restockOpen, setRestockOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [combineOpen, setCombineOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [showInactiveUnits, setShowInactiveUnits] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(() => new Set());

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['stock-item', stockItemId],
    queryFn: () => getStockItem(stockItemId),
  });
  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ['stock-units', locationId, stockItemId, { showInactive: showInactiveUnits }],
    queryFn: () =>
      getStockUnits({
        locationId: locationId ?? undefined,
        stockItemId,
        activeOnly: !showInactiveUnits,
      }),
    enabled: !!locationId,
  });
  const {
    data: ledger,
    isLoading: ledgerLoading,
    isFetching: ledgerFetching,
  } = useQuery({
    queryKey: ['stock-movements', stockItemId, 'detail', ledgerPage],
    queryFn: () => getStockItemMovements(stockItemId, { page: ledgerPage, limit: LEDGER_PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });
  // The per-location row carries the reorder threshold, availability flag and the
  // id every stock action is keyed by — the list page used to hand it over.
  const { data: rawStock } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId!),
    enabled: !!locationId,
  });
  const { data: rawOverview } = useQuery({
    queryKey: ['inventory-overview', locationId],
    queryFn: () => getInventoryOverview(locationId!),
    enabled: !!locationId,
  });
  const { data: rawForecast } = useQuery({
    queryKey: ['inventory-forecast', locationId],
    queryFn: () => getInventoryForecast(locationId!),
    enabled: !!locationId,
  });
  const { data: rawLosses, isLoading: lossesLoading } = useQuery({
    queryKey: ['loss-log', 'item', stockItemId, locationId],
    queryFn: () => getLossLog({ tenantId: tenantId!, stockItemId, locationId: locationId ?? undefined, limit: 50 }),
    enabled: !!tenantId,
  });

  const stock = useMemo(
    () => normaliseArray<LocationStock>(rawStock).find((s) => s.stockItemId === stockItemId) ?? null,
    [rawStock, stockItemId],
  );
  const overview = useMemo(
    () => normaliseArray<InventoryOverviewRow>(rawOverview).find((row) => row.stockItemId === stockItemId) ?? null,
    [rawOverview, stockItemId],
  );
  const forecast = useMemo(
    () => (stock ? normaliseArray<InventoryForecast>(rawForecast).find((f) => f.locationStockId === stock.id) : undefined),
    [rawForecast, stock],
  );
  const losses = normaliseArray<LossRecord>(rawLosses);

  const active = units.filter((unit) => unit.status === 'AVAILABLE' || unit.status === 'IN_USE');
  const selectedUnits = units.filter((stockUnit) => selectedUnitIds.has(stockUnit.id));
  const allActiveSelected = active.length > 0 && active.every((stockUnit) => selectedUnitIds.has(stockUnit.id));
  // Prefer the server's rollup; fall back to summing the containers we hold.
  const onHand = overview ? Number(overview.totalOnHand) : active.reduce((sum, unit) => sum + Number(unit.remainingQuantity), 0);
  const activeUnitCount = overview?.activeUnitCount ?? active.length;
  const earliestExpiry =
    overview?.earliestExpiryDate ??
    active
      .map((unit) => unit.expiryDate)
      .filter((value): value is string => !!value)
      .sort()[0];
  const threshold = stock ? parseFloat(stock.lowThreshold) : overview ? parseFloat(overview.reorderLevel) : 0;
  // Status is derived from the rolled-up on-hand figure, not the row's own cached quantity.
  const status = stock ? getStatus({ ...stock, quantity: String(onHand) }) : null;
  const unit = item?.unit ?? '';

  const nutritionRows = item?.nutrition
    ? NUTRITION_FIELDS.filter((f) => item.nutrition?.[f.key] != null).map((f) => ({ ...f, value: item.nutrition?.[f.key] as number }))
    : [];
  const allergens = item?.allergens ?? [];

  function invalidateStock() {
    void queryClient.invalidateQueries({ queryKey: ['stock-units', locationId, stockItemId] });
    void queryClient.invalidateQueries({ queryKey: ['stock-movements', stockItemId] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-overview', locationId] });
    void queryClient.invalidateQueries({ queryKey: ['location-stock', locationId] });
    void queryClient.invalidateQueries({ queryKey: ['inventory-forecast', locationId] });
  }

  function toggleUnitSelection(id: string) {
    setSelectedUnitIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearUnitSelection() {
    setSelectedUnitIds(new Set());
  }

  const toggleAvailable = useMutation({
    mutationFn: () => updateLocationStock(stock!.id, { isAvailable: !stock!.isAvailable }),
    onSuccess: () => {
      invalidateStock();
      toast('success', 'Availability updated.');
    },
    onError: () => toast('error', 'Failed to update availability.'),
  });

  const removeItem = useMutation({
    mutationFn: () => removeLocationStock(stock!.id),
    onSuccess: () => {
      setRemoveOpen(false);
      invalidateStock();
      toast('success', 'Item removed from this location.');
      router.push('/inventory');
    },
    onError: () => toast('error', 'Failed to remove item.'),
  });

  return (
    <EditorShell
      eyebrow="Inventory item"
      title={item?.name ?? (itemLoading ? 'Loading…' : 'Inventory item')}
      icon={<Package size={20} aria-hidden="true" />}
      onClose={() => router.push('/inventory')}
      meta={
        item && (
          <>
            {status && <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>}
            <Badge variant="muted">{item.category}</Badge>
            <span className="text-xs text-muted-foreground">{item.unit}</span>
            {item.isPerishable && <Badge variant="amber">Perishable</Badge>}
            {!item.isActive && <Badge variant="muted">Inactive</Badge>}
          </>
        )
      }
      actions={
        stock && (
          <>
            <Button variant="outline" className="h-10 gap-1.5" onClick={() => setRestockOpen(true)}>
              <PackagePlus size={15} />
              <span className="hidden md:inline">Restock</span>
            </Button>
            <Button variant="outline" className="h-10 gap-1.5" onClick={() => setLossOpen(true)}>
              <PackageMinus size={15} />
              <span className="hidden md:inline">Log loss</span>
            </Button>
            <Button variant="outline" className="h-10 gap-1.5" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight size={15} />
              <span className="hidden md:inline">Transfer</span>
            </Button>
          </>
        )
      }
      subheader={<SectionTabs tabs={ITEM_SECTIONS} value={section} onChange={setSection} ariaLabel="Inventory item sections" />}
    >
      <div className="space-y-4">
        {!locationId && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-5">
            <p className="font-medium text-foreground">No location selected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a location in the header to see this item&apos;s stock level, containers and actions.
            </p>
          </div>
        )}

        {section === 'overview' && (
          <>
            {item && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="On hand" value={`${fmt(onHand)} ${item.unit}`} icon={Package} />
                <Stat label="Active containers" value={String(activeUnitCount)} icon={Box} />
                <Stat
                  label="Earliest expiry"
                  value={earliestExpiry ? new Date(earliestExpiry).toLocaleDateString('en-GB') : 'N/A'}
                  icon={CalendarClock}
                />
                <Stat
                  label="Days left"
                  value={forecast ? `${Math.round(forecast.daysOfStockRemaining)}d` : 'N/A'}
                  valueClass={forecast ? daysColor(forecast.daysOfStockRemaining) : undefined}
                  icon={Gauge}
                />
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-4 items-start">
              {/* Stock level vs the reorder threshold */}
              <Card
                title="Stock level"
                description={status ? `${STATUS_LABEL[status]} against the reorder threshold` : undefined}
                action={
                  stock && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditThreshold(true)}>
                      <Pencil size={13} /> Threshold
                    </Button>
                  )
                }
              >
                {status ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">{Math.round(stockPct(onHand, threshold))}% of threshold</p>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', STATUS_BAR[status])}
                        style={{ width: `${stockPct(onHand, threshold)}%` }}
                      />
                    </div>
                    <div className="flex items-baseline justify-between mt-3">
                      <div>
                        <p className="text-2xl font-bold text-foreground tabular-nums">{fmtQty(onHand)}</p>
                        <p className="text-xs text-muted-foreground">{unit} current</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-muted-foreground tabular-nums">{fmtQty(threshold)}</p>
                        <p className="text-xs text-muted-foreground">threshold</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This item is not stocked at the selected location, so it has no threshold or availability settings here.
                  </p>
                )}
              </Card>

              {/* Demand forecast */}
              <Card title="Demand forecast" description="Based on the last 30 days of consumption.">
                {forecast ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat
                        label="Days left"
                        icon={Gauge}
                        value={`${Math.round(forecast.daysOfStockRemaining)}d`}
                        valueClass={daysColor(forecast.daysOfStockRemaining)}
                      />
                      <MiniStat label="Avg use / day" icon={TrendingDown} value={`${fmtQty(forecast.avgDailyConsumption)} ${unit}`} />
                      <MiniStat
                        label="Est. stockout"
                        icon={CalendarClock}
                        value={forecast.predictedStockoutDate ? formatDate(forecast.predictedStockoutDate) : '—'}
                      />
                      <MiniStat
                        label="Suggested reorder"
                        icon={PackagePlus}
                        value={`${fmtQty(forecast.recommendedReorderQuantity)} ${unit}`}
                      />
                    </div>
                    {forecast.recommendedReorderQuantity > 0 && stock && (
                      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setRestockOpen(true)}>
                        <PackagePlus size={13} /> Request {fmtQty(forecast.recommendedReorderQuantity)} {unit}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-xl bg-surface-offset px-3 py-3">
                    Not enough usage data to forecast yet. Once this item is sold or consumed, its demand trend will appear here.
                  </p>
                )}
              </Card>

              {/* Item record */}
              <Card
                title="Details"
                action={
                  item && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditItemOpen(true)}>
                      <Pencil size={13} /> Edit item
                    </Button>
                  )
                }
              >
                <InfoGroup>
                  <InfoRow icon={Package} label="Item ID" value={`#${stockItemId.slice(0, 8).toUpperCase()}`} copyable />
                  <InfoRow icon={Boxes} label="Available at this location" value={stock ? (stock.isAvailable ? 'Yes' : 'No') : '—'} />
                  {item?.createdAt && <InfoRow icon={CalendarDays} label="Created" value={formatDate(item.createdAt)} />}
                </InfoGroup>
                {stock && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={toggleAvailable.isPending}
                      onClick={() => toggleAvailable.mutate()}
                    >
                      {stock.isAvailable ? 'Mark unavailable' : 'Mark available'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive"
                      onClick={() => setRemoveOpen(true)}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </Card>

              {/* Nutrition & allergens — only when declared on the stock item */}
              {(nutritionRows.length > 0 || allergens.length > 0) && (
                <Card
                  title="Nutrition"
                  description={item?.nutritionBasis ? BASIS_LABEL[item.nutritionBasis] : 'Declared on the stock item.'}
                >
                  {nutritionRows.length > 0 && (
                    <InfoGroup>
                      {nutritionRows.map((f) => (
                        <InfoRow
                          key={f.key}
                          icon={NUTRITION_ICONS[f.key] ?? CircleDot}
                          label={f.label}
                          value={`${fmtQty(f.value)} ${f.unit}`}
                        />
                      ))}
                    </InfoGroup>
                  )}
                  {allergens.length > 0 && (
                    <div className={cn(nutritionRows.length > 0 && 'mt-3')}>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                        <TriangleAlert size={11} aria-hidden="true" /> Allergens
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allergens.map((a) => (
                          <span
                            key={a}
                            className="px-2.5 h-7 inline-flex items-center rounded-lg border border-warning bg-warning/10 text-warning text-xs font-medium capitalize"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </>
        )}

        {section === 'containers' && (
          <>
            {item && locationId && (
              <Card title="Receive physical containers" description="Each container gets its own balance and ledger entry.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
                  <ReceiveContainersForm item={item} locationId={locationId} stockItemId={stockItemId} onReceived={invalidateStock} />
                </div>
              </Card>
            )}

            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Physical stock units</h2>
                  <p className="text-xs text-muted-foreground">Select active containers to combine them, or select one to split it.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearUnitSelection();
                      setShowInactiveUnits((current) => !current);
                    }}
                  >
                    {showInactiveUnits ? 'Hide inactive' : 'Show inactive'}
                  </Button>
                  {selectedUnits.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">{selectedUnits.length} selected</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedUnits.length !== 1}
                    onClick={() => setSplitOpen(true)}
                  >
                    <Scissors size={14} /> Split
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedUnits.length < 2}
                    onClick={() => setCombineOpen(true)}
                  >
                    <Combine size={14} /> Combine
                  </Button>
                </div>
              </div>
              {!locationId ? (
                <div className="py-16">
                  <EmptyState icon={Package} title="Select a location" description="Choose a location to inspect its containers." />
                </div>
              ) : unitsLoading ? (
                <p className="p-5 text-sm text-muted-foreground">Loading containers…</p>
              ) : units.length === 0 ? (
                <div className="py-16">
                  <EmptyState
                    icon={Box}
                    title={showInactiveUnits ? 'No stock units' : 'No active containers'}
                    description={
                      showInactiveUnits
                        ? 'Receive a delivery or add a physical container to begin unit tracking.'
                        : 'Receive new stock, or show inactive containers to review previous container records.'
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <DataTable className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th className="pl-5 pr-2 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            aria-label="Select all active containers"
                            checked={allActiveSelected}
                            onChange={() =>
                              setSelectedUnitIds(allActiveSelected ? new Set() : new Set(active.map((stockUnit) => stockUnit.id)))
                            }
                            className="size-4 accent-primary align-middle"
                          />
                        </th>
                        <th className="px-5 py-3 text-left">Container</th>
                        <th className="px-5 py-3 text-left">Lot</th>
                        <th className="px-5 py-3 text-right">Remaining</th>
                        <th className="px-5 py-3 text-left">Expiry</th>
                        <th className="px-5 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map((u) => (
                        <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-surface-offset/50">
                          <td className="pl-5 pr-2 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${u.label}`}
                              checked={selectedUnitIds.has(u.id)}
                              disabled={u.status !== 'AVAILABLE' && u.status !== 'IN_USE'}
                              onChange={() => toggleUnitSelection(u.id)}
                              className="size-4 accent-primary align-middle disabled:opacity-40"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <Link href={`/inventory/units/${u.id}`} className="font-medium text-primary hover:underline">
                              {u.label}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{u.lotNumber || '—'}</td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {fmt(u.remainingQuantity)} / {fmt(u.initialQuantity)} {u.unitOfMeasure}
                          </td>
                          <td className="px-5 py-3 tabular-nums">
                            {u.expiryDate ? new Date(u.expiryDate).toLocaleDateString('en-GB') : '—'}
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant={
                                u.status === 'AVAILABLE' || u.status === 'IN_USE'
                                  ? 'success'
                                  : u.status === 'EXPIRED'
                                    ? 'destructive'
                                    : 'muted'
                              }
                            >
                              {u.status.replace('_', ' ')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              )}
            </section>
          </>
        )}

        {section === 'ledger' && (
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History size={15} className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Ledger timeline</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {ledgerFetching && !ledgerLoading
                  ? 'Updating…'
                  : `${(ledger?.total ?? 0).toLocaleString()} movement${ledger?.total === 1 ? '' : 's'}`}
              </span>
            </div>
            {ledgerLoading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading ledger…</p>
            ) : (ledger?.data ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No movements recorded.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {ledger?.data.map((movement) => (
                  <LedgerRow key={movement.id} movement={movement} fallbackUnit={unit} />
                ))}
              </div>
            )}
            {!ledgerLoading && (ledger?.pages ?? 0) > 1 && (
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Page {ledgerPage} of {ledger?.pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ledgerPage <= 1 || ledgerFetching}
                    onClick={() => setLedgerPage((page) => page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={ledgerPage >= (ledger?.pages ?? 1) || ledgerFetching}
                    onClick={() => setLedgerPage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {section === 'losses' && (
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Loss history</h2>
                <p className="text-xs text-muted-foreground">Waste, expiry, damage and theft recorded against this item.</p>
              </div>
              {stock && (
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setLossOpen(true)}>
                  <PackageMinus size={13} /> Log loss
                </Button>
              )}
            </div>
            {lossesLoading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading losses…</p>
            ) : losses.length === 0 ? (
              <div className="py-16">
                <EmptyState icon={PackageMinus} title="No losses recorded" description="Nothing has been written off for this item yet." />
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {losses.map((loss) => (
                  <LossRow key={loss.id} loss={loss} unit={unit} />
                ))}
              </div>
            )}
          </section>
        )}

        {section === 'transfers' && (
          <div className="space-y-4">
            {stock && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTransferOpen(true)}>
                  <ArrowLeftRight size={13} /> New transfer
                </Button>
              </div>
            )}
            {locationId ? (
              <ItemTransfersSection stockItemId={stockItemId} locationId={locationId} />
            ) : (
              <div className="rounded-2xl border border-border bg-card py-16">
                <EmptyState icon={ArrowLeftRight} title="Select a location" description="Transfers are listed per location." />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {editThreshold && stock && (
        <EditThresholdModal
          item={stock}
          onClose={() => setEditThreshold(false)}
          onSuccess={() => {
            invalidateStock();
            toast('success', 'Threshold updated.');
          }}
        />
      )}
      {restockOpen && stock && (
        <RestockModal
          item={stock}
          onClose={() => setRestockOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
            toast('success', 'Restock request submitted.');
          }}
        />
      )}
      {lossOpen && stock && (
        <LogLossModal
          defaultLocationId={stock.locationId}
          defaultStockItemId={stockItemId}
          onClose={() => setLossOpen(false)}
          onSuccess={() => {
            invalidateStock();
            void queryClient.invalidateQueries({ queryKey: ['loss-log'] });
            toast('success', 'Loss entry recorded.');
          }}
        />
      )}
      {editItemOpen && item && (
        <EditStockItemModal
          item={item}
          onClose={() => setEditItemOpen(false)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['stock-item', stockItemId] });
            void queryClient.invalidateQueries({ queryKey: ['stock-items'] });
            invalidateStock();
            toast('success', 'Stock item updated.');
          }}
        />
      )}
      {transferOpen && tenantId && locationId && (
        <TransferStockModal
          tenantId={tenantId}
          locationId={locationId}
          initialStockItemId={stockItemId}
          onClose={() => setTransferOpen(false)}
        />
      )}
      {combineOpen && selectedUnits.length >= 2 && (
        <CombineContainersModal
          units={selectedUnits}
          onClose={() => setCombineOpen(false)}
          onCompleted={() => {
            setCombineOpen(false);
            clearUnitSelection();
            invalidateStock();
          }}
        />
      )}
      {splitOpen && selectedUnits.length === 1 && (
        <SplitContainerModal
          unit={selectedUnits[0]!}
          onClose={() => setSplitOpen(false)}
          onCompleted={() => {
            setSplitOpen(false);
            clearUnitSelection();
            invalidateStock();
          }}
        />
      )}
      {removeOpen && stock && (
        <ConfirmModal
          title="Remove Stock Item"
          message={
            <>
              Remove <span className="font-semibold text-foreground">{item?.name ?? 'this item'}</span> from this location? Its stock
              history stays, but the item disappears from the list.
            </>
          }
          confirmLabel="Remove"
          pendingLabel="Removing…"
          isPending={removeItem.isPending}
          onConfirm={() => removeItem.mutate()}
          onClose={() => setRemoveOpen(false)}
        />
      )}
    </EditorShell>
  );
}

// ── Container transformations ────────────────────────────────────────────────

function CombineContainersModal({
  units,
  onClose,
  onCompleted,
}: {
  units: StockUnit[];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [label, setLabel] = useState('');
  const total = units.reduce((sum, stockUnit) => sum + Number(stockUnit.remainingQuantity), 0);
  const expiryDates = units
    .map((stockUnit) => stockUnit.expiryDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  const earliestExpiry = expiryDates[0];

  const combine = useMutation({
    mutationFn: () =>
      combineStockUnits({
        stockUnitIds: units.map((stockUnit) => stockUnit.id),
        label: label.trim() || undefined,
      }),
    onSuccess: () => {
      toast('success', `${units.length} containers combined into one.`);
      onCompleted();
    },
    onError: (error) => toast('error', error.message || 'Unable to combine containers.'),
  });

  return (
    <Modal title="Combine containers" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-offset p-4">
          <p className="text-sm font-semibold text-foreground">
            {units.length} containers → 1 container
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            New balance: {fmt(total)} {units[0]?.unitOfMeasure}
          </p>
        </div>
        <Input
          label="NEW CONTAINER LABEL"
          value={label}
          maxLength={100}
          placeholder="Generated automatically if blank"
          onChange={(event) => setLabel(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The source containers will be marked empty. The combined container keeps the earliest expiry
          {earliestExpiry ? ` (${new Date(earliestExpiry).toLocaleDateString('en-GB')})` : ''} and retains the lot number only when
          every source has the same lot.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={combine.isPending}>
            Cancel
          </Button>
          <Button onClick={() => combine.mutate()} disabled={combine.isPending}>
            <Combine size={15} /> {combine.isPending ? 'Combining…' : 'Combine containers'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SplitContainerModal({
  unit,
  onClose,
  onCompleted,
}: {
  unit: StockUnit;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [count, setCount] = useState('2');
  const numericCount = Number(count);
  const totalThousandths = Math.round(Number(unit.remainingQuantity) * 1000);
  const validCount =
    Number.isInteger(numericCount) && numericCount >= 2 && numericCount <= 100 && numericCount <= totalThousandths;
  const parts = validCount
    ? Array.from({ length: numericCount }, (_, index) => {
        const base = Math.floor(totalThousandths / numericCount);
        const remainder = totalThousandths % numericCount;
        return (base + (index < remainder ? 1 : 0)) / 1000;
      })
    : [];
  const equalParts = parts.length > 0 && parts.every((quantity) => quantity === parts[0]);
  const countError =
    count && !validCount
      ? totalThousandths < 2
        ? 'This balance is too small to split.'
        : `Enter a whole number from 2 to ${Math.min(100, totalThousandths)}.`
      : undefined;

  const split = useMutation({
    mutationFn: () => {
      if (!validCount) throw new Error(countError || 'Enter a valid container count.');
      return splitStockUnit(unit.id, { parts: parts.map((quantity) => ({ quantity })) });
    },
    onSuccess: () => {
      toast('success', `Container split into ${numericCount} containers.`);
      onCompleted();
    },
    onError: (error) => toast('error', error.message || 'Unable to split the container.'),
  });

  return (
    <Modal title="Split container" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-offset p-4">
          <p className="text-sm font-semibold text-foreground">{unit.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmt(unit.remainingQuantity)} {unit.unitOfMeasure} available
          </p>
        </div>
        <Input
          label="NUMBER OF NEW CONTAINERS"
          type="number"
          min={2}
          max={Math.min(100, totalThousandths)}
          step={1}
          value={count}
          error={countError}
          onChange={(event) => setCount(event.target.value)}
        />
        {validCount && (
          <p className="text-xs text-muted-foreground">
            {equalParts
              ? `Each new container will hold ${fmt(parts[0]!)} ${unit.unitOfMeasure}.`
              : `Balances will be ${parts.map((quantity) => fmt(quantity)).join(', ')} ${unit.unitOfMeasure} so the total stays exact.`}
            {' '}Expiry and lot details will be copied to every new container.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={split.isPending}>
            Cancel
          </Button>
          <Button onClick={() => split.mutate()} disabled={split.isPending || !validCount}>
            <Scissors size={15} /> {split.isPending ? 'Splitting…' : 'Split container'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Receive containers form ───────────────────────────────────────────────────

function ReceiveContainersForm({
  item,
  locationId,
  stockItemId,
  onReceived,
}: {
  item: { unit: string; isPerishable: boolean };
  locationId: string;
  stockItemId: string;
  onReceived: () => void;
}) {
  const [containerQuantity, setContainerQuantity] = useState('');
  const [containerCount, setContainerCount] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');
  const [lotNumber, setLotNumber] = useState('');

  const receive = useMutation({
    mutationFn: () => {
      const quantity = Number(containerQuantity);
      const count = Number(containerCount);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(count) || count <= 0)
        throw new Error('Enter a valid container quantity and count.');
      if (item.isPerishable && !expiryDate) throw new Error('Expiry date is required for perishable stock.');
      return receiveStockUnits({
        locationId,
        stockItemId,
        units: Array.from({ length: count }, () => ({
          initialQuantity: quantity,
          expiryDate: expiryDate || null,
          lotNumber: lotNumber.trim() || undefined,
        })),
      });
    },
    onSuccess: () => {
      setContainerQuantity('');
      setLotNumber('');
      onReceived();
      toast('success', 'Physical stock units received.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <>
      <Input
        label={`QUANTITY PER CONTAINER (${item.unit})`}
        type="number"
        min={0.001}
        step="any"
        value={containerQuantity}
        onChange={(event) => setContainerQuantity(event.target.value)}
      />
      <Input
        label="CONTAINER COUNT"
        type="number"
        min={1}
        step={1}
        value={containerCount}
        onChange={(event) => setContainerCount(event.target.value)}
      />
      <Input
        label={item.isPerishable ? 'EXPIRY (REQUIRED)' : 'EXPIRY'}
        type="date"
        value={expiryDate}
        onChange={(event) => setExpiryDate(event.target.value)}
      />
      <Input label="LOT NUMBER" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
      <Button onClick={() => receive.mutate()} disabled={receive.isPending} className="gap-1.5">
        <Plus size={15} /> {receive.isPending ? 'Receiving…' : 'Receive containers'}
      </Button>
    </>
  );
}

// ── Rows ──────────────────────────────────────────────────────────────────────

function LedgerRow({ movement, fallbackUnit }: { movement: StockMovement; fallbackUnit: string }) {
  const outgoing = Number(movement.quantity) < 0;
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <Badge variant={outgoing ? 'amber' : 'success'}>{movement.type.toUpperCase()}</Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{movement.reason?.replaceAll('_', ' ') ?? movement.notes ?? 'Stock movement'}</p>
        <p className="text-xs text-muted-foreground">
          {movement.stockUnit?.label ?? 'Stock unit'} · {movement.sourceType}
          {movement.orderId ? (
            <>
              {' '}
              ·{' '}
              <Link href={`/orders?order=${movement.orderId}`} className="text-primary hover:underline">
                View order
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <span className={cn('font-semibold tabular-nums', outgoing ? 'text-destructive' : 'text-success')}>
        {Number(movement.quantity) > 0 ? '+' : ''}
        {fmt(movement.quantity)} {movement.unitOfMeasure ?? fallbackUnit}
      </span>
      <time className="hidden md:block text-xs text-muted-foreground tabular-nums">{when(movement.createdAt)}</time>
    </div>
  );
}

function LossRow({ loss, unit }: { loss: LossRecord; unit: string }) {
  const { reason, notes } = parseLossNotes(loss.notes);
  const displayReason = (reason ?? loss.type) as keyof typeof REASON_LABELS;

  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-destructive/10">
        <TrendingDown size={14} className="text-destructive" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{REASON_LABELS[displayReason] ?? displayReason}</p>
        {notes && (
          <p className="text-xs text-muted-foreground truncate" title={notes}>
            {notes}
          </p>
        )}
      </div>
      <span className="font-semibold tabular-nums text-destructive">
        −{fmt(Math.abs(loss.quantity))} {unit}
      </span>
      <time className="hidden md:block text-xs text-muted-foreground tabular-nums">
        {when(loss.createdAt)} · {timeAgo(loss.createdAt)}
      </time>
    </div>
  );
}

// ── Presentation helpers ──────────────────────────────────────────────────────

function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, valueClass, icon: Icon }: { label: string; value: string; valueClass?: string; icon: LucideIcon }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className={cn('text-xl font-bold text-foreground tabular-nums', valueClass)}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, valueClass, icon: Icon }: { label: string; value: string; valueClass?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-xl bg-surface-offset px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
      </div>
      <p className={cn('text-base font-semibold text-foreground tabular-nums leading-none', valueClass)}>{value}</p>
    </div>
  );
}
