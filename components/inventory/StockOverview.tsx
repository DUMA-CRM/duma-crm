'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  Truck,
  Wallet,
  X,
} from '@/components/icons';
import { StockItemThumb } from '@/components/inventory/item/StockItemPhoto';
import { AddItemDrawer, EditThresholdDrawer, LogLossDrawer, RestockDrawer } from '@/components/inventory/stock/StockDrawers';
import {
  ParMeter,
  STATUS_LABEL,
  STATUS_TONE,
  categoryMeta,
  fmtQty,
  normaliseArray,
  statusGlyph,
} from '@/components/inventory/stock/shared';
import type { DraftLine } from '@/components/purchasing/PurchaseOrdersPanel';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Pill } from '@/components/shared/Pill';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { TONE_TINT } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { serverCache } from '@/lib/api/cache-policy';
import { hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import {
  type InventoryForecast,
  type InventoryOverviewRow,
  type LocationStock,
  getInventoryForecast,
  getInventoryOverview,
  getLocationStock,
} from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import {
  type StockLine,
  type StockSort,
  type StockView,
  expiresWithin,
  filterStock,
  groupByCategory,
  isExpired,
  sortStock,
  stockCounts,
  stockHealth,
  lineValue,
  stockValue,
  suggestedOrder,
} from '@/lib/utils/stock-list';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * The stock tab, after the tools operators already use (MarketMan, Odoo's
 * replenishment report, Shopify's inventory views): what needs doing first,
 * each row carrying its own fix; four figures that say how the shelf stands;
 * saved views with category and sort; items grouped by category, each read
 * against its par; and a suggested order that becomes a purchase order in
 * one step. Settings' vocabulary throughout — fields, facts, panels.
 */

const STOCK_VIEWS: readonly StockView[] = ['all', 'reorder', 'low', 'expiring', 'unavailable'];

const SORTS: { value: StockSort; label: string }[] = [
  { value: 'name', label: 'Sort: Name' },
  { value: 'cover', label: 'Sort: Runs out first' },
  { value: 'expiry', label: 'Sort: Expires first' },
  { value: 'value', label: 'Sort: Highest value' },
];

/** "Runs out today", "1 day left", "4 days left". */
const daysLeft = (days: number) => {
  if (days < 1) return 'Runs out today';
  const n = Math.round(days);
  return `${n} ${n === 1 ? 'day' : 'days'} left`;
};

type Action = { kind: 'restock' | 'waste' | 'par'; item: LocationStock };

export function StockOverview({
  locationId,
  addOpen,
  onAddOpenChange,
  purchasingEnabled,
  onCreatePurchaseOrder,
}: {
  locationId: string;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  purchasingEnabled: boolean;
  onCreatePurchaseOrder?: (lines: DraftLine[]) => void;
}) {
  const queryClient = useQueryClient();
  const money = useWorkspaceMoney();
  const capabilities = useAuthStore((state) => state.capabilities);
  const can = {
    restock: hasCapability(capabilities, 'restock:write'),
    waste: hasCapability(capabilities, 'loss:write'),
    par: hasCapability(capabilities, 'stock.locations:write'),
    order: hasCapability(capabilities, 'purchasing:write'),
    add: hasCapability(capabilities, 'inventory:write'),
  };
  const [now] = useState(() => new Date());
  const [search, setSearch] = useState('');
  // A link can open the list already filtered — the dashboard's Stock health rows do (`?view=low`).
  const searchParams = useSearchParams();
  const [view, setView] = useState<StockView>(() => {
    const requested = searchParams.get('view');
    return STOCK_VIEWS.includes(requested as StockView) ? (requested as StockView) : 'all';
  });
  const effectiveView = !purchasingEnabled && view === 'reorder' ? 'all' : view;
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<StockSort>('name');
  // The forecast (days left, runs out) is Analytics'. With it off the API
  // refuses the call, so it isn't made and what reads from it is hidden.
  const forecasting = useModuleEnabled('analytics');
  const effectiveSort = !forecasting && sort === 'cover' ? 'name' : sort;
  const [action, setAction] = useState<Action | null>(null);

  function invalidateStock() {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock', locationId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId) });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-forecast', locationId) });
  }

  const stockQuery = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId),
  });
  const { data: rawForecast } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-forecast', locationId),
    queryFn: () => getInventoryForecast(locationId),
    ...serverCache('inventoryForecast'),
    enabled: forecasting,
  });
  const { data: rawOverview } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('inventory-overview', locationId),
    queryFn: () => getInventoryOverview(locationId),
  });

  const stock = useMemo(() => normaliseArray<LocationStock>(stockQuery.data), [stockQuery.data]);
  const byItem = useMemo(() => new Map(stock.map((row) => [row.stockItemId, row])), [stock]);

  // One line per item: location stock, its projection (on hand, batches,
  // expiry) and its forecast, folded into the shape the pure helpers read.
  const lines = useMemo<StockLine[]>(() => {
    const forecasts = new Map(normaliseArray<InventoryForecast>(rawForecast).map((row) => [row.locationStockId, row]));
    const overview = new Map(normaliseArray<InventoryOverviewRow>(rawOverview).map((row) => [row.stockItemId, row]));
    return stock.map((row) => {
      const projected = overview.get(row.stockItemId);
      const forecast = forecasts.get(row.id);
      return {
        stockItemId: row.stockItemId,
        name: row.stockItem?.name ?? projected?.name ?? 'Unnamed item',
        unit: row.stockItem?.unit ?? projected?.unit ?? '',
        category: projected?.category ?? row.stockItem?.category ?? null,
        qty: Number(projected?.totalOnHand ?? row.quantity) || 0,
        threshold: Number(row.lowThreshold) || 0,
        isAvailable: row.isAvailable,
        unitCost: row.stockItem?.costPerUnit != null ? Number(row.stockItem.costPerUnit) : null,
        // Container by container, from the overview; stock with no cost at all leaves it unknown.
        onHandValue:
          projected?.stockValue === undefined ? undefined : Number(projected.unvaluedQuantity ?? 0) > 0 ? null : Number(projected.stockValue),
        coverDays: forecast?.daysOfStockRemaining ?? null,
        earliestExpiry: projected?.earliestExpiryDate ?? null,
        recommendedQty: forecast?.recommendedReorderQuantity ?? 0,
        reorderQty: row.reorderQuantity != null ? Number(row.reorderQuantity) : null,
        needsReorder: projected?.needsReorder ?? false,
        imageUrl: row.stockItem?.imageUrl ?? null,
      };
    });
  }, [stock, rawForecast, rawOverview]);

  const counts = useMemo(() => stockCounts(lines, now), [lines, now]);
  const value = useMemo(() => stockValue(lines), [lines]);
  const shown = useMemo(
    () => sortStock(filterStock(lines, { view: effectiveView, category, search, now }), effectiveSort),
    [lines, effectiveView, category, search, now, effectiveSort],
  );
  const groups = useMemo(() => groupByCategory(shown), [shown]);
  const categories = useMemo(() => [...new Set(lines.map((line) => line.category).filter(Boolean))] as string[], [lines]);
  const existingIds = useMemo(() => new Set(stock.map((row) => row.stockItemId)), [stock]);
  const open = (kind: Action['kind'], stockItemId: string) => {
    const item = byItem.get(stockItemId);
    if (item) setAction({ kind, item });
  };

  const views: { value: StockView; label: string }[] = [
    { value: 'all', label: 'All items' },
    ...(purchasingEnabled ? [{ value: 'reorder' as const, label: 'Suggested order' }] : []),
    { value: 'low', label: 'Low & out' },
    { value: 'expiring', label: 'Expiring this week' },
    // No tile counts these, so the option does.
    { value: 'unavailable', label: counts.unavailable ? `Unavailable · ${counts.unavailable}` : 'Unavailable' },
  ];
  const hasFilters = !!search || effectiveView !== 'all' || category !== 'all';

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {/* Only when something does need someone — an all-clear banner is a row of nothing. */}
      <NeedsAttention items={attentionItems(lines, now, can, open)} />

      <motion.dl variants={SECTION_RISE} className={cn('grid gap-3', forecasting ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3')}>
        <Fact
          surface="page"
          icon={Wallet}
          label="Stock value"
          value={money(value.value)}
          hint={
            value.unpriced > 0
              ? `${value.unpriced} ${value.unpriced === 1 ? 'item has' : 'items have'} no cost yet`
              : 'At last delivery cost'
          }
          onSelect={() => setSort('value')}
        />
        <Fact
          surface="page"
          icon={AlertTriangle}
          label="Below par"
          value={counts.low}
          tone={counts.out > 0 ? 'danger' : counts.low > 0 ? 'warning' : 'default'}
          hint={counts.out > 0 ? `${counts.out} out of stock` : counts.low > 0 ? 'None out yet' : 'Everything above par'}
          onSelect={() => setView('low')}
        />
        <Fact
          surface="page"
          icon={CalendarDays}
          label="Expiring this week"
          value={counts.expiring + counts.expired}
          tone={counts.expired > 0 ? 'danger' : counts.expiring > 0 ? 'warning' : 'default'}
          hint={counts.expired > 0 ? `${counts.expired} already expired` : 'Use these first'}
          onSelect={() => setView('expiring')}
        />
        {forecasting && (
          <Fact
            surface="page"
            icon={Timer}
            label="Runs out within a week"
            value={counts.runningOut}
            tone={counts.runningOut > 0 ? 'warning' : 'default'}
            hint={counts.reorder > 0 ? `${counts.reorder} on the suggested order` : 'At the last 30 days’ usage'}
            onSelect={() => setView('reorder')}
          />
        )}
      </motion.dl>

      <motion.section variants={SECTION_RISE} className="space-y-3" aria-label="Stock">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1 lg:max-w-xs">
            <Input
              placeholder="Find an item"
              aria-label="Find an item"
              leftIcon={<Search size={14} />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-rule"
              rightAction={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Select
            value={effectiveView}
            onValueChange={(next) => setView(next as StockView)}
            options={views}
            ariaLabel="View"
            className="w-56"
          />
          <Select
            value={category}
            onValueChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((value) => ({ value, label: categoryMeta(value).label })),
            ]}
            ariaLabel="Category"
            className="w-40"
          />
          {effectiveView !== 'reorder' && (
            <Select
              value={effectiveSort}
              onValueChange={(next) => setSort(next as StockSort)}
              options={forecasting ? SORTS : SORTS.filter((option) => option.value !== 'cover')}
              ariaLabel="Sort"
              className="w-48"
            />
          )}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setView('all');
                setCategory('all');
              }}
              className="h-9 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {shown.length} of {lines.length} {lines.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {stockQuery.isError ? (
          <ErrorState
            title="Stock couldn’t be loaded"
            description="Nothing was read, so this isn’t an empty shelf."
            onRetry={() => void stockQuery.refetch()}
          />
        ) : stockQuery.isPending ? (
          // Two category groups: the heading row, then the card of stock rows.
          <div role="status" aria-busy="true" aria-label="Loading stock" className="space-y-5">
            {[5, 3].map((rows, group) => (
              <div key={group}>
                <div className="mb-2 flex items-baseline justify-between px-1" aria-hidden="true">
                  <Bone className="h-4 w-28" />
                  <Bone className="h-3 w-24" />
                </div>
                <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {Array.from({ length: rows }, (_, index) => (
                    <RowSkeleton key={index} index={index + group} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : effectiveView === 'reorder' ? (
          <SuggestedOrder lines={shown} money={money} canOrder={can.order && !!onCreatePurchaseOrder} onCreate={onCreatePurchaseOrder} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Package}
            kind={hasFilters ? 'search' : 'start'}
            title={hasFilters ? 'Nothing matches' : 'No stock at this location yet'}
            description={
              hasFilters
                ? 'Try another view, or clear the filters.'
                : 'Items you keep here appear with their levels and value once you add them.'
            }
            action={
              hasFilters
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearch('');
                      setView('all');
                      setCategory('all');
                    },
                  }
                : can.add
                  ? { label: 'Add item', icon: Plus, onClick: () => onAddOpenChange(true) }
                  : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.category ?? 'none'} aria-labelledby={`cat-${group.category ?? 'none'}`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 id={`cat-${group.category ?? 'none'}`} className="text-sm font-semibold text-foreground">
                    {categoryMeta(group.category).label}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {group.lines.length} {group.lines.length === 1 ? 'item' : 'items'} · {money(stockValue(group.lines).value)}
                  </p>
                </div>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {group.lines.map((line) => (
                    <StockRow
                      key={line.stockItemId}
                      line={line}
                      now={now}
                      money={money}
                      can={can}
                      showCover={forecasting}
                      onAction={open}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </motion.section>

      {addOpen && (
        <AddItemDrawer
          locationId={locationId}
          existingIds={existingIds}
          onClose={() => onAddOpenChange(false)}
          onSuccess={() => {
            invalidateStock();
            toast('success', 'Item added.');
          }}
        />
      )}
      {action?.kind === 'restock' && <RestockDrawer item={action.item} onClose={() => setAction(null)} onSuccess={invalidateStock} />}
      {action?.kind === 'par' && <EditThresholdDrawer item={action.item} onClose={() => setAction(null)} onSuccess={invalidateStock} />}
      {action?.kind === 'waste' && (
        <LogLossDrawer
          defaultLocationId={locationId}
          defaultStockItemId={action.item.stockItemId}
          onClose={() => setAction(null)}
          onSuccess={invalidateStock}
        />
      )}
    </motion.div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

/**
 * One item as an audit-log row: a health-tinted tile, the name and what it's
 * counted in, a level bar read against par, how long it lasts, its earliest
 * expiry when that matters, and its value. The fixes — request more, log
 * waste, set par — sit on the row, so nothing needs opening to act.
 */
function StockRow({
  line,
  now,
  money,
  can,
  showCover,
  onAction,
}: {
  line: StockLine;
  now: Date;
  money: (amount: number) => string;
  can: { restock: boolean; waste: boolean; par: boolean };
  /** Days left comes from the forecast; without Analytics there is none to show. */
  showCover: boolean;
  onAction: (kind: Action['kind'], stockItemId: string) => void;
}) {
  const health = stockHealth(line);
  const glyph = statusGlyph(health, line.category);
  const expired = isExpired(line.earliestExpiry, now);
  const expiring = !expired && expiresWithin(line.earliestExpiry, now, 7);
  const cover = line.coverDays;
  // The row is a link; an action inside it must not also follow it.
  const act = (kind: Action['kind']) => (event: React.MouseEvent) => {
    event.preventDefault();
    onAction(kind, line.stockItemId);
  };

  // The tinted tile carries the row's health. With a photo in its place, the
  // health moves to a badge on the photo's corner — only when there is
  // something to say; a healthy item's tile showed just its category.
  const statusTile = (
    <span
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_TINT[STATUS_TONE[health]])}
      title={glyph.label}
      role="img"
      aria-label={glyph.label}
    >
      <glyph.icon size={16} aria-hidden="true" />
    </span>
  );
  const photoTile = line.imageUrl ? (
    <span className="relative shrink-0">
      <StockItemThumb imageUrl={line.imageUrl} className="size-9 rounded-md" fallback={statusTile} />
      {health !== 'ok' && (
        <span
          className="absolute -right-1 -bottom-1 flex rounded-full bg-card ring-2 ring-card"
          title={glyph.label}
          role="img"
          aria-label={glyph.label}
        >
          <span className={cn('flex size-4 items-center justify-center rounded-full', TONE_TINT[STATUS_TONE[health]])}>
            <glyph.icon size={10} aria-hidden="true" />
          </span>
        </span>
      )}
    </span>
  ) : undefined;

  return (
    <ListRow
      href={`/inventory/items/${line.stockItemId}`}
      leading={photoTile}
      icon={glyph.icon}
      tone={STATUS_TONE[health]}
      iconLabel={glyph.label}
      title={line.name}
      // The word stays visible: Low and Critical share a glyph and differ only by colour.
      titleExtra={health !== 'ok' && <Pill tone={STATUS_TONE[health]}>{STATUS_LABEL[health]}</Pill>}
      meta={
        <span className="flex items-center gap-2">
          <ParMeter qty={line.qty} par={line.threshold} unit={line.unit} status={health} className="w-20 shrink-0" />
          <span className="truncate">
            <span className={cn('font-medium', health === 'out' || health === 'critical' ? 'text-exception' : 'text-foreground')}>
              {fmtQty(line.qty)} {line.unit}
            </span>
            {line.threshold > 0 && ` · par ${fmtQty(line.threshold)}`}
          </span>
        </span>
      }
      trailing={
        <>
          {showCover && (
            <span className="hidden w-28 text-right lg:block">
              {cover === null ? (
                <span className="text-xs text-muted-foreground">No recent use</span>
              ) : (
                <span
                  className={cn(
                    'text-xs font-medium',
                    cover <= 3 ? 'text-exception' : cover <= 7 ? 'text-measured' : 'text-muted-foreground',
                  )}
                >
                  {daysLeft(cover)}
                </span>
              )}
            </span>
          )}
          <span className="hidden w-32 md:flex md:justify-end">
            {expired ? (
              <Pill tone="exception">Expired</Pill>
            ) : expiring ? (
              <Pill tone="warning">Expires {formatDate(line.earliestExpiry!)}</Pill>
            ) : null}
          </span>
          <span className="w-20 text-right text-sm font-semibold text-foreground">
            {lineValue(line) !== null ? (
              money(lineValue(line)!)
            ) : (
              <span className="text-xs font-normal text-muted-foreground">No cost</span>
            )}
          </span>
        </>
      }
      actions={
        <>
          {can.restock && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={act('restock')}
              aria-label={`Request more ${line.name}`}
              title="Request more"
            >
              <Truck />
            </Button>
          )}
          {can.waste && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={act('waste')}
              aria-label={`Log waste for ${line.name}`}
              title="Log waste"
            >
              <Trash2 />
            </Button>
          )}
          {can.par && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={act('par')}
              aria-label={`Set par for ${line.name}`}
              title="Set par"
            >
              <SlidersHorizontal />
            </Button>
          )}
        </>
      }
    />
  );
}

// ── Needs attention ──────────────────────────────────────────────────────────

/**
 * What needs someone, worst first, each row with its fix — the pattern from
 * Odoo's replenishment report and MarketMan's alerts. Drawn by the shared
 * folded card, as on Menu → Items.
 */
function attentionItems(
  lines: StockLine[],
  now: Date,
  can: { restock: boolean; waste: boolean },
  onAction: (kind: Action['kind'], stockItemId: string) => void,
): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];
  for (const line of lines) {
    const health = stockHealth(line);
    if (isExpired(line.earliestExpiry, now))
      items.push({
        key: `exp-${line.stockItemId}`,
        tone: 'exception',
        icon: CalendarDays,
        title: `${line.name} has expired stock`,
        detail: `A batch passed its date on ${formatDate(line.earliestExpiry!)} — bin it and log the waste.`,
        fix: can.waste ? { label: 'Log waste', run: () => onAction('waste', line.stockItemId) } : undefined,
      });
    if (health === 'out' || health === 'critical')
      items.push({
        key: `low-${line.stockItemId}`,
        tone: 'exception',
        icon: AlertTriangle,
        title: health === 'out' ? `${line.name} is out` : `${line.name} is nearly out`,
        detail: `${fmtQty(line.qty)} ${line.unit} left against a par of ${fmtQty(line.threshold)}.`,
        fix: can.restock ? { label: 'Request more', run: () => onAction('restock', line.stockItemId) } : undefined,
      });
    else if (line.isAvailable && line.coverDays !== null && line.coverDays <= 2)
      items.push({
        key: `cover-${line.stockItemId}`,
        tone: 'measured',
        icon: Clock,
        title: `${line.name} runs out ${line.coverDays < 1 ? 'today' : 'within two days'}`,
        detail: `At recent usage — ${fmtQty(line.qty)} ${line.unit} on hand.`,
        fix: can.restock ? { label: 'Request more', run: () => onAction('restock', line.stockItemId) } : undefined,
      });
  }
  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'exception' ? -1 : 1));
}

// ── Suggested order ──────────────────────────────────────────────────────────

/**
 * What to order, worked out from par and the last 30 days' usage — Odoo's
 * replenishment report for a café. Quantities can be changed before the order
 * is made; "Create purchase order" opens the order form with these lines in it.
 */
function SuggestedOrder({
  lines,
  money,
  canOrder,
  onCreate,
}: {
  lines: StockLine[];
  money: (amount: number) => string;
  canOrder: boolean;
  onCreate?: (lines: DraftLine[]) => void;
}) {
  const suggestions = suggestedOrder(lines);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const qty = (id: string, fallback: number) => overrides[id] ?? fallback;
  const kept = suggestions.filter((entry) => !skipped.has(entry.line.stockItemId) && qty(entry.line.stockItemId, entry.quantity) > 0);
  const total = kept.reduce((sum, entry) => sum + qty(entry.line.stockItemId, entry.quantity) * (entry.line.unitCost ?? 0), 0);

  if (suggestions.length === 0)
    return (
      <EmptyState
        icon={CheckCircle2}
        kind="done"
        title="Nothing to order"
        description="Every item is above par and none runs out within a week."
      />
    );

  return (
    <SettingsSection
      title="Suggested order"
      description="From par and the last 30 days’ usage. Change a quantity or skip an item, then turn it into a purchase order."
      footnote={
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {kept.length} of {suggestions.length} {suggestions.length === 1 ? 'item' : 'items'} · about {money(total)} at last cost
          </span>
          {canOrder ? (
            <Button
              size="sm"
              disabled={kept.length === 0}
              onClick={() =>
                onCreate?.(
                  kept.map((entry) => ({
                    stockItemId: entry.line.stockItemId,
                    quantity: String(qty(entry.line.stockItemId, entry.quantity)),
                    unitCost: entry.line.unitCost !== null ? entry.line.unitCost.toFixed(2) : '',
                  })),
                )
              }
            >
              <Truck data-icon="inline-start" />
              Create purchase order
            </Button>
          ) : (
            <span>Creating orders needs purchasing access.</span>
          )}
        </span>
      }
    >
      <ul className="space-y-2">
        {suggestions.map(({ line, quantity }) => {
          const id = line.stockItemId;
          const off = skipped.has(id);
          const value = qty(id, quantity);
          return (
            <li
              key={id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3.5 py-3',
                off ? 'border-dashed border-rule/60 opacity-60' : 'border-rule/50 bg-background/60',
              )}
            >
              <span
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_TINT[STATUS_TONE[stockHealth(line)]])}
              >
                <Package size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{line.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {fmtQty(line.qty)} {line.unit} on hand
                  {line.threshold > 0 && ` · par ${fmtQty(line.threshold)}`}
                  {line.coverDays !== null && ` · ${daysLeft(line.coverDays).toLowerCase()}`}
                </span>
              </span>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value}
                  disabled={off}
                  aria-label={`Order quantity for ${line.name}`}
                  onChange={(event) => setOverrides({ ...overrides, [id]: Math.max(0, Number(event.target.value) || 0) })}
                  className="h-8 w-20 rounded-md border border-input bg-background px-2 text-right text-sm font-semibold text-foreground outline-none focus:border-ring disabled:opacity-60"
                />
                <span className="w-12 truncate">{line.unit}</span>
              </label>
              <span className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground sm:block">
                {line.unitCost !== null ? money(value * line.unitCost) : '—'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = new Set(skipped);
                  if (off) next.delete(id);
                  else next.add(id);
                  setSkipped(next);
                }}
              >
                {off ? 'Add back' : 'Skip'}
              </Button>
            </li>
          );
        })}
      </ul>
    </SettingsSection>
  );
}
