'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Package,
  Search,
  SlidersHorizontal,
  Timer,
  Trash2,
  Truck,
  Wallet,
  X,
} from '@/components/icons';
import { AddItemDrawer, EditThresholdDrawer, LogLossDrawer, RestockDrawer } from '@/components/inventory/stock/StockDrawers';
import { fmtQty, normaliseArray } from '@/components/inventory/stock/shared';
import type { DraftLine } from '@/components/purchasing/PurchaseOrdersPanel';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { serverCache } from '@/lib/api/cache-policy';
import { hasCapability } from '@/lib/auth/capabilities';
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
  type StockHealth,
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

const HEALTH: Record<StockHealth, { label: string; tint: string; bar: string }> = {
  ok: { label: 'Healthy', tint: 'bg-momentum/8 text-momentum', bar: 'bg-momentum' },
  low: { label: 'Low', tint: 'bg-measured/10 text-measured', bar: 'bg-measured' },
  critical: { label: 'Critical', tint: 'bg-exception/8 text-exception', bar: 'bg-exception' },
  out: { label: 'Out', tint: 'bg-exception/8 text-exception', bar: 'bg-exception' },
  unavailable: { label: 'Unavailable', tint: 'bg-band text-muted-foreground', bar: 'bg-muted-foreground/40' },
};

const CATEGORY_LABEL: Record<string, string> = { FOOD: 'Food', BEVERAGE: 'Drinks', SUPPLY: 'Supplies', MERCH: 'Retail' };

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
  };
  const [now] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [view, setView] = useState<StockView>('all');
  const effectiveView = !purchasingEnabled && view === 'reorder' ? 'all' : view;
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<StockSort>('name');
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
        coverDays: forecast?.daysOfStockRemaining ?? null,
        earliestExpiry: projected?.earliestExpiryDate ?? null,
        recommendedQty: forecast?.recommendedReorderQuantity ?? 0,
        reorderQty: row.reorderQuantity != null ? Number(row.reorderQuantity) : null,
        needsReorder: projected?.needsReorder ?? false,
      };
    });
  }, [stock, rawForecast, rawOverview]);

  const counts = useMemo(() => stockCounts(lines, now), [lines, now]);
  const value = useMemo(() => stockValue(lines), [lines]);
  const shown = useMemo(
    () => sortStock(filterStock(lines, { view: effectiveView, category, search, now }), sort),
    [lines, effectiveView, category, search, now, sort],
  );
  const groups = useMemo(() => groupByCategory(shown), [shown]);
  const categories = useMemo(() => [...new Set(lines.map((line) => line.category).filter(Boolean))] as string[], [lines]);
  const existingIds = useMemo(() => new Set(stock.map((row) => row.stockItemId)), [stock]);
  const open = (kind: Action['kind'], stockItemId: string) => {
    const item = byItem.get(stockItemId);
    if (item) setAction({ kind, item });
  };

  const views: { value: StockView; label: string }[] = [
    { value: 'all', label: `All items · ${counts.total}` },
    ...(purchasingEnabled ? [{ value: 'reorder' as const, label: `Suggested order · ${counts.reorder}` }] : []),
    { value: 'low', label: `Low & out · ${counts.low}` },
    { value: 'expiring', label: `Expiring this week · ${counts.expiring + counts.expired}` },
    { value: 'unavailable', label: `Unavailable · ${counts.unavailable}` },
  ];
  const hasFilters = !!search || effectiveView !== 'all' || category !== 'all';

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <NeedsAttention lines={lines} now={now} can={can} onAction={open} />

      <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        <Fact
          surface="page"
          icon={Timer}
          label="Runs out within a week"
          value={counts.runningOut}
          tone={counts.runningOut > 0 ? 'warning' : 'default'}
          hint={counts.reorder > 0 ? `${counts.reorder} on the suggested order` : 'At the last 30 days’ usage'}
          onSelect={() => setView('reorder')}
        />
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
              className="border-rule bg-background"
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
              ...categories.map((value) => ({ value, label: CATEGORY_LABEL[value] ?? value })),
            ]}
            ariaLabel="Category"
            className="w-40"
          />
          {effectiveView !== 'reorder' && (
            <Select value={sort} onValueChange={(next) => setSort(next as StockSort)} options={SORTS} ariaLabel="Sort" className="w-48" />
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
          <div className="h-96 animate-pulse rounded-lg bg-band/60" aria-label="Loading stock" />
        ) : effectiveView === 'reorder' ? (
          <SuggestedOrder lines={shown} money={money} canOrder={can.order && !!onCreatePurchaseOrder} onCreate={onCreatePurchaseOrder} />
        ) : shown.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            <EmptyState
              icon={Package}
              title={hasFilters ? 'Nothing matches' : 'No stock at this location yet'}
              description={hasFilters ? 'Try another view, or clear the filters.' : 'Add the items you keep here with Add item above.'}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.category ?? 'none'} aria-labelledby={`cat-${group.category ?? 'none'}`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 id={`cat-${group.category ?? 'none'}`} className="text-sm font-semibold text-foreground">
                    {group.category ? (CATEGORY_LABEL[group.category] ?? group.category) : 'Uncategorised'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {group.lines.length} {group.lines.length === 1 ? 'item' : 'items'} · {money(stockValue(group.lines).value)}
                  </p>
                </div>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {group.lines.map((line) => (
                    <StockRow key={line.stockItemId} line={line} now={now} money={money} can={can} onAction={open} />
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
  onAction,
}: {
  line: StockLine;
  now: Date;
  money: (amount: number) => string;
  can: { restock: boolean; waste: boolean; par: boolean };
  onAction: (kind: Action['kind'], stockItemId: string) => void;
}) {
  const health = stockHealth(line);
  const meta = HEALTH[health];
  const scale = line.threshold > 0 ? line.threshold * 2 : Math.max(line.qty, 1);
  const fill = Math.max(0, Math.min(1, line.qty / scale));
  const parAt = line.threshold > 0 ? Math.min(1, line.threshold / scale) : null;
  const expired = isExpired(line.earliestExpiry, now);
  const expiring = !expired && expiresWithin(line.earliestExpiry, now, 7);
  const cover = line.coverDays;

  return (
    <li className="group border-b border-rule/45 last:border-b-0">
      <div className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-band/40">
        <Link
          href={`/inventory/items/${line.stockItemId}`}
          className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.tint)}>
            <Package size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{line.name}</span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative block h-1.5 w-20 shrink-0 rounded-full bg-band" aria-hidden="true">
                <span className={cn('absolute inset-y-0 left-0 rounded-full', meta.bar)} style={{ width: `${fill * 100}%` }} />
                {parAt !== null && <span className="absolute -inset-y-0.5 w-px bg-foreground/50" style={{ left: `${parAt * 100}%` }} />}
              </span>
              <span className="truncate">
                <span className={cn('font-medium', health === 'out' || health === 'critical' ? 'text-exception' : 'text-foreground')}>
                  {fmtQty(line.qty)} {line.unit}
                </span>
                {line.threshold > 0 ? ` · par ${fmtQty(line.threshold)}` : ' · no par set'}
              </span>
            </span>
          </span>
          <span className="hidden w-28 shrink-0 text-right lg:block">
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
          <span className="hidden w-32 shrink-0 md:flex md:justify-end">
            {expired ? (
              <span className="rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold text-exception">Expired</span>
            ) : expiring ? (
              <span className="rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">
                Expires {formatDate(line.earliestExpiry!)}
              </span>
            ) : health !== 'ok' ? (
              <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.tint)}>{meta.label}</span>
            ) : null}
          </span>
          <span className="w-20 shrink-0 text-right text-sm font-semibold text-foreground">
            {line.unitCost !== null ? (
              money(Math.max(0, line.qty) * line.unitCost)
            ) : (
              <span className="text-xs font-normal text-muted-foreground">No cost</span>
            )}
          </span>
        </Link>
        {/* The row's fixes — visible on hover or focus, always reachable by keyboard. */}
        <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {can.restock && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction('restock', line.stockItemId)}
              aria-label={`Request more ${line.name}`}
              title="Request more"
            >
              <Truck />
            </Button>
          )}
          {can.waste && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction('waste', line.stockItemId)}
              aria-label={`Log waste for ${line.name}`}
              title="Log waste"
            >
              <Trash2 />
            </Button>
          )}
          {can.par && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAction('par', line.stockItemId)}
              aria-label={`Set par for ${line.name}`}
              title="Set par"
            >
              <SlidersHorizontal />
            </Button>
          )}
          <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
    </li>
  );
}

// ── Needs attention ──────────────────────────────────────────────────────────

/**
 * What needs someone, worst first, each row with its fix — the pattern from
 * Odoo's replenishment report and MarketMan's alerts. Folded to one line by
 * default, as on the staff overview.
 */
function NeedsAttention({
  lines,
  now,
  can,
  onAction,
}: {
  lines: StockLine[];
  now: Date;
  can: { restock: boolean; waste: boolean };
  onAction: (kind: Action['kind'], stockItemId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  type Item = {
    key: string;
    tone: 'exception' | 'measured';
    icon: typeof AlertTriangle;
    title: string;
    detail: string;
    fix?: { label: string; run: () => void };
  };
  const items: Item[] = [];
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
  items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'exception' ? -1 : 1));

  if (items.length === 0)
    return (
      <motion.section variants={SECTION_RISE} className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-momentum/10 text-momentum">
          <CheckCircle2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Nothing needs you</span>
          <span className="block text-xs text-muted-foreground">Nothing is out, expired or about to run out.</span>
        </span>
      </motion.section>
    );

  const worst = items[0].tone;
  return (
    <motion.section
      variants={SECTION_RISE}
      aria-label="Needs attention"
      className="overflow-hidden rounded-lg border border-rule/60 bg-field"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-band/40"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            worst === 'exception' ? 'bg-exception/8 text-exception' : 'bg-measured/10 text-measured',
          )}
        >
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {items.length} {items.length === 1 ? 'thing needs' : 'things need'} you
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{items.map((item) => item.title).join(' · ')}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-rule/50"
          >
            <ul className="space-y-2 p-2">
              {items.map((item) => {
                const Icon = item.icon;
                const body = (
                  <>
                    <span
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-md',
                        item.tone === 'exception' ? 'bg-exception/8 text-exception' : 'bg-measured/10 text-measured',
                      )}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                    </span>
                  </>
                );
                return (
                  <li
                    key={item.key}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-background/60 px-3.5 py-3',
                      item.tone === 'exception' ? 'border-exception/35' : 'border-rule/60',
                    )}
                  >
                    {body}
                    {item.fix && (
                      <Button variant="outline" size="sm" onClick={item.fix.run}>
                        {item.fix.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
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
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <EmptyState icon={CheckCircle2} title="Nothing to order" description="Every item is above par and none runs out within a week." />
      </div>
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
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', HEALTH[stockHealth(line)].tint)}>
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
