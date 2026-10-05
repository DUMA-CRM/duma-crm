'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  Equal,
  EyeOff,
  type IconComponent,
  Loader2,
  Minus,
  Play,
  Plus,
  Search,
  X,
} from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact, Switch } from '@/components/settings/controls';
import { ConfirmDrawer } from '@/components/shared/ConfirmDrawer';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type LocationStock,
  type Stocktake,
  type StocktakeLine,
  type StocktakeStatus,
  cancelStocktake,
  completeStocktake,
  getLocationStock,
  getStocktake,
  getStocktakes,
  saveStocktakeCounts,
  startStocktake,
} from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import {
  type CountLine,
  type CountView,
  byImpact,
  countDuration,
  formatDelta,
  formatQty,
  inView,
  parseCount,
  summarise,
  variance,
} from '@/lib/utils/stocktake';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * Stocktakes in the settings vocabulary. With no count running: a history of
 * audit rows, each opening a drawer with what changed. While counting: a count
 * sheet grouped by category — search, a "show" selector, blind counting, Enter
 * to move down the sheet — and a review drawer that shows every difference and
 * its value before anything is applied.
 */

const CATEGORY_LABEL: Record<string, string> = { FOOD: 'Food', BEVERAGE: 'Drinks', SUPPLY: 'Supplies', MERCH: 'Retail' };
const CATEGORY_ORDER = ['FOOD', 'BEVERAGE', 'SUPPLY', 'MERCH'];

const STATUS_META: Record<StocktakeStatus, { label: string; pill: string; tile: string; icon: IconComponent }> = {
  in_progress: { label: 'Counting', pill: 'bg-measured/10 text-measured', tile: 'bg-measured/10 text-measured', icon: ClipboardCheck },
  completed: { label: 'Applied', pill: 'bg-success/10 text-success', tile: 'bg-primary/8 text-primary', icon: Check },
  cancelled: { label: 'Cancelled', pill: 'bg-band text-muted-foreground', tile: 'bg-band text-muted-foreground', icon: X },
};

const TONE_TEXT = { match: 'text-success', over: 'text-primary', short: 'text-exception' } as const;

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** A stocktake line joined with what location stock knows about the item: its category and last cost. */
interface SheetLine extends CountLine {
  id: string;
  name: string;
  unit: string;
  category: string | null;
}

function useCatalogue(locationId: string) {
  const { data } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId),
  });
  return useMemo(() => new Map((data ?? []).map((row: LocationStock) => [row.stockItemId, row.stockItem])), [data]);
}

function toSheet(lines: StocktakeLine[], catalogue: ReturnType<typeof useCatalogue>, counted: (line: StocktakeLine) => number | null): SheetLine[] {
  return lines.map((line) => {
    const item = catalogue.get(line.stockItemId);
    const cost = item?.costPerUnit != null ? Number(item.costPerUnit) : null;
    return {
      id: line.id,
      stockItemId: line.stockItemId,
      name: line.stockItem?.name ?? item?.name ?? 'Unknown item',
      unit: line.stockItem?.unit ?? item?.unit ?? '',
      category: item?.category ?? null,
      expected: Number(line.expectedQty),
      counted: counted(line),
      cost: Number.isFinite(cost) ? cost : null,
    };
  });
}

function groupByCategory(lines: SheetLine[]) {
  const groups = new Map<string, SheetLine[]>();
  for (const line of lines) {
    const key = line.category ?? 'OTHER';
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (CATEGORY_ORDER.indexOf(a) + 1 || 99) - (CATEGORY_ORDER.indexOf(b) + 1 || 99))
    .map(([key, items]) => ({ key, label: CATEGORY_LABEL[key] ?? 'Other', items }));
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** The location's stocktakes, plus the id of the one being counted right now. */
function useStocktakes(locationId: string) {
  const query = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktakes', locationId),
    queryFn: () => getStocktakes({ locationId, limit: 30 }),
  });
  const stocktakes = query.data?.data ?? [];
  return { query, stocktakes, activeId: stocktakes.find((s) => s.status === 'in_progress')?.id };
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktakes') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktake') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
}

function useStart(locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => startStocktake({ locationId }),
    onSuccess: () => {
      invalidateAll(qc);
      toast('success', 'Stocktake started — expected quantities are snapshotted now.');
    },
    onError: (err) => toast('error', err.message || 'The stocktake didn’t start. Try again.'),
  });
}

/**
 * "Start stocktake" for the page header. It shares the list query with the
 * panel, so it disappears the moment a count is running — one at a time.
 */
export function StartStocktakeButton({ locationId }: { locationId: string }) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const { activeId } = useStocktakes(locationId);
  const start = useStart(locationId);
  if (activeId || !hasCapability(capabilities, 'stocktakes:write')) return null;
  return (
    <Button onClick={() => start.mutate()} disabled={start.isPending} className="h-10 gap-1.5">
      {start.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
      <span className="hidden md:inline">Start stocktake</span>
    </Button>
  );
}

export function StocktakePanel({ locationId }: { locationId: string }) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'stocktakes:write');
  const { query, stocktakes, activeId } = useStocktakes(locationId);
  const catalogue = useCatalogue(locationId);

  // The list endpoint doesn't include lines — fetch the active one's detail.
  const active = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktake', activeId),
    queryFn: () => getStocktake(activeId!),
    enabled: !!activeId,
  });

  if (query.isError) return <ErrorState title="Couldn’t load stocktakes" onRetry={() => void query.refetch()} />;
  if (query.isPending || (activeId && active.isPending)) {
    return (
      <div className="space-y-3" aria-label="Loading stocktakes">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-band/60" />
        ))}
      </div>
    );
  }
  if (activeId && active.isError) return <ErrorState title="Couldn’t load the count" onRetry={() => void active.refetch()} />;
  if (activeId && active.data) return <CountSheet key={active.data.id} stocktake={active.data} catalogue={catalogue} canWrite={canWrite} />;
  return <History stocktakes={stocktakes} locationId={locationId} canWrite={canWrite} catalogue={catalogue} />;
}

// ── History ───────────────────────────────────────────────────────────────────

function History({
  stocktakes,
  locationId,
  canWrite,
  catalogue,
}: {
  stocktakes: Stocktake[];
  locationId: string;
  canWrite: boolean;
  catalogue: ReturnType<typeof useCatalogue>;
}) {
  const [status, setStatus] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const start = useStart(locationId);
  const [mountedAt] = useState(() => Date.now());

  const shown = stocktakes.filter((s) => status === 'all' || s.status === status);
  const lastApplied = stocktakes.find((s) => s.status === 'completed');
  const daysSince = lastApplied ? Math.floor((mountedAt - new Date(lastApplied.completedAt ?? lastApplied.createdAt).getTime()) / 86_400_000) : null;
  const months: { label: string; items: Stocktake[] }[] = [];
  for (const s of shown) {
    const label = monthLabel(s.createdAt);
    const last = months.at(-1);
    if (last?.label === label) last.items.push(s);
    else months.push({ label, items: [s] });
  }

  if (stocktakes.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <EmptyState
          icon={ClipboardCheck}
          title="No stocktakes yet"
          description="A stocktake snapshots what the system expects, you count what’s really there, and the differences are applied as adjustments."
        />
        {canWrite && (
          <div className="-mt-4 flex justify-center pb-8">
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
              Start the first count
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as typeof status)}
          ariaLabel="Status"
          options={[
            { value: 'all', label: `All stocktakes · ${stocktakes.length}` },
            { value: 'completed', label: `Applied · ${stocktakes.filter((s) => s.status === 'completed').length}` },
            { value: 'cancelled', label: `Cancelled · ${stocktakes.filter((s) => s.status === 'cancelled').length}` },
          ]}
          className="w-52"
        />
        <span className={cn('ml-auto text-xs', daysSince !== null && daysSince > 30 ? 'font-semibold text-measured' : 'text-muted-foreground')}>
          {daysSince === null ? 'Never fully counted' : daysSince === 0 ? 'Last applied today' : `Last applied ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago`}
        </span>
      </motion.div>

      {shown.length === 0 ? (
        <motion.div variants={SECTION_RISE} className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <EmptyState icon={ClipboardCheck} title="Nothing here" description="No stocktakes with that status." />
        </motion.div>
      ) : (
        months.map((month) => (
          <motion.section key={month.label} variants={SECTION_RISE} aria-label={month.label}>
            <h3 className="mb-2 text-label uppercase text-muted-foreground">{month.label}</h3>
            <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {month.items.map((s) => {
                const meta = STATUS_META[s.status];
                const took = countDuration(s.createdAt, s.completedAt);
                return (
                  <li key={s.id} className="border-b border-rule/45 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenId(s.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.tile)} aria-hidden="true">
                        <meta.icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{dateTime(s.createdAt)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[s.startedByUser?.name, took && `took ${took}`, s.notes].filter(Boolean).join(' · ') || 'Stocktake'}
                        </span>
                      </span>
                      <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
                      <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        ))
      )}

      {openId && <StocktakeDrawer id={openId} catalogue={catalogue} onClose={() => setOpenId(null)} />}
    </motion.div>
  );
}

/** A finished stocktake: what was counted, and every difference worst first. */
function StocktakeDrawer({ id, catalogue, onClose }: { id: string; catalogue: ReturnType<typeof useCatalogue>; onClose: () => void }) {
  const money = useWorkspaceMoney();
  const { data, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stocktake', id),
    queryFn: () => getStocktake(id),
  });
  const sheet = data ? toSheet(data.lines ?? [], catalogue, (l) => (l.countedQty != null ? Number(l.countedQty) : null)) : [];
  const summary = summarise(sheet);
  const differences = byImpact(sheet.filter((l) => l.counted !== null && l.counted !== l.expected));
  const uncounted = sheet.filter((l) => l.counted === null);
  const meta = data ? STATUS_META[data.status] : null;
  const took = data ? countDuration(data.createdAt, data.completedAt) : null;

  return (
    <Drawer
      title="Stocktake"
      description={data ? [dateTime(data.createdAt), data.startedByUser?.name, data.location?.name].filter(Boolean).join(' · ') : undefined}
      onClose={onClose}
    >
      {isError ? (
        <ErrorState title="Couldn’t load this stocktake" onRetry={() => void refetch()} />
      ) : !data || !meta ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-band/60" />
          <div className="h-48 animate-pulse rounded-lg bg-band/60" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
              <span className="text-xs text-muted-foreground">
                {data.status === 'completed' && data.completedAt ? `Applied ${dateTime(data.completedAt)}${took ? ` · took ${took}` : ''}` : null}
                {data.status === 'cancelled' ? 'Nothing was applied' : null}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <Fact surface="card" icon={ClipboardCheck} label="Counted" value={`${summary.counted} of ${summary.total}`} hint={summary.uncounted ? `${summary.uncounted} left as they were` : 'Every item'} />
              <Fact surface="card" icon={Check} label="Matched" value={summary.matched} hint={summary.counted ? `${Math.round((summary.matched / summary.counted) * 100)}% of counted` : undefined} />
              <Fact surface="card" icon={AlertTriangle} label="Differences" value={summary.differences} tone={summary.differences ? 'warning' : 'default'} hint={`${summary.over} over · ${summary.short} short`} />
              <ValueFact summary={summary} money={money} />
            </dl>
          </div>

          <DiffList title="Differences" lines={differences} money={money} empty="Every counted item matched what was expected." />

          {uncounted.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Not counted</h3>
              <p className="rounded-lg border border-rule/60 bg-card px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                {uncounted.map((l) => l.name).join(', ')}
              </p>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function ValueFact({ summary, money }: { summary: ReturnType<typeof summarise>; money: ReturnType<typeof useWorkspaceMoney> }) {
  const pence = summary.valuePence;
  return (
    <Fact
      surface="card"
      icon={pence < 0 ? Minus : Plus}
      label="Stock value"
      value={pence === 0 ? money(0) : `${pence > 0 ? '+' : '−'}${money(Math.abs(pence) / 100)}`}
      tone={pence < 0 ? 'danger' : 'default'}
      hint={summary.unpriced ? `${summary.unpriced} without a cost` : 'At last cost'}
    />
  );
}

/** Differences as audit rows: item, expected → counted, the difference and its value. */
function DiffList({ title, lines, money, empty }: { title: string; lines: SheetLine[]; money: ReturnType<typeof useWorkspaceMoney>; empty: string }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {title} <span className="font-normal text-muted-foreground">· {lines.length}</span>
      </h3>
      {lines.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-rule/60 bg-card px-3.5 py-3 text-sm text-muted-foreground">
          <Check size={15} className="text-success" aria-hidden="true" /> {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          {lines.map((line) => {
            const v = variance(line.expected, line.counted ?? 0);
            return (
              <li key={line.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                <span
                  className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', v.tone === 'short' ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary')}
                  aria-hidden="true"
                >
                  {v.tone === 'short' ? <Minus size={16} /> : <Plus size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{line.name}</span>
                  <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
                    {formatQty(line.expected)} <ArrowRight size={11} aria-hidden="true" /> {formatQty(line.counted ?? 0)} {line.unit}
                    {v.large && <span className="ml-1 rounded-sm bg-measured/10 px-1 text-micro font-semibold text-measured">Large</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={cn('block text-sm font-semibold tabular-nums', TONE_TEXT[v.tone])}>{formatDelta(v.delta)}</span>
                  {line.cost != null && (
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {v.delta < 0 ? '−' : '+'}
                      {money(Math.abs(v.delta * line.cost))}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Count sheet ───────────────────────────────────────────────────────────────

function CountSheet({ stocktake, catalogue, canWrite }: { stocktake: Stocktake; catalogue: ReturnType<typeof useCatalogue>; canWrite: boolean }) {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  // Local draft keyed by stock item; absent = the saved value.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [view, setView] = useState<CountView>('all');
  const [search, setSearch] = useState('');
  const [blind, setBlind] = useState(false);
  const [confirm, setConfirm] = useState<'review' | 'cancel' | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => stocktake.lines ?? [], [stocktake.lines]);
  const saved = (line: StocktakeLine) => (line.countedQty != null ? formatQty(Number(line.countedQty)) : '');
  const textFor = (line: StocktakeLine) => draft[line.stockItemId] ?? saved(line);
  const unsaved = lines.filter((line) => draft[line.stockItemId] !== undefined && draft[line.stockItemId].trim() !== saved(line)).length;
  const invalid = lines.filter((line) => parseCount(textFor(line)) === 'invalid');

  const sheet = toSheet(lines, catalogue, (line) => {
    const parsed = parseCount(textFor(line));
    return parsed === 'invalid' ? null : parsed;
  });
  const summary = summarise(sheet);
  const q = search.trim().toLowerCase();
  const visible = sheet.filter((line) => inView(view, line.expected, line.counted) && (!q || line.name.toLowerCase().includes(q)));
  const groups = groupByCategory(visible);
  const progress = summary.total ? summary.counted / summary.total : 0;

  // Leaving with typed-but-unsaved counts loses a shift's work; the browser asks first.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const payload = () =>
    lines.map((line) => {
      const parsed = parseCount(textFor(line));
      return { stockItemId: line.stockItemId, countedQty: parsed === 'invalid' ? null : parsed };
    });

  const save = useMutation({
    mutationFn: () => saveStocktakeCounts(stocktake.id, payload()),
    onSuccess: async () => {
      // Refetch the count before dropping the draft, or the inputs flash back to the old values.
      await qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stocktake', stocktake.id) });
      setDraft({});
      toast('success', 'Counts saved.');
    },
    onError: (err) => toast('error', err.message || 'The counts weren’t saved. Check the quantities and try again.'),
  });

  const complete = useMutation({
    mutationFn: async () => {
      // Persist any unsaved edits first, then apply the differences.
      await saveStocktakeCounts(stocktake.id, payload());
      return completeStocktake(stocktake.id);
    },
    onSuccess: (res) => {
      invalidateAll(qc);
      setConfirm(null);
      toast('success', `Stocktake applied — ${res.adjustments ?? 0} ${res.adjustments === 1 ? 'adjustment' : 'adjustments'} recorded.`);
    },
    onError: (err) => toast('error', err.message || 'The stocktake wasn’t applied. Review the counts and try again.'),
  });

  const cancel = useMutation({
    mutationFn: () => cancelStocktake(stocktake.id),
    onSuccess: () => {
      invalidateAll(qc);
      setConfirm(null);
      toast('info', 'Stocktake cancelled — nothing was applied.');
    },
    onError: (err) => toast('error', err.message || 'The stocktake wasn’t cancelled. Try again.'),
  });

  const set = (stockItemId: string, value: string) => setDraft((current) => ({ ...current, [stockItemId]: value }));
  /** Enter moves down the sheet, the way a counter works through a shelf. */
  const next = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const inputs = [...(sheetRef.current?.querySelectorAll<HTMLInputElement>('input[data-count]') ?? [])];
    const at = inputs.indexOf(event.currentTarget);
    inputs[at + 1]?.focus();
    inputs[at + 1]?.select();
  };

  const counts: Record<CountView, number> = {
    all: summary.total,
    todo: summary.uncounted,
    counted: summary.counted,
    differences: summary.differences,
  };
  const pending = save.isPending || complete.isPending || cancel.isPending;

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {/* What's running and how far along — the top card, as in the order drawer. */}
      <motion.div variants={SECTION_RISE} className="rounded-lg border border-rule/60 bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-measured/10 text-measured" aria-hidden="true">
            <ClipboardCheck size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold tracking-title text-foreground">Counting in progress</p>
            <p className="truncate text-xs text-muted-foreground">
              Started {dateTime(stocktake.createdAt)}
              {stocktake.startedByUser?.name ? ` by ${stocktake.startedByUser.name}` : ''} · expected quantities are as of {time(stocktake.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {summary.counted} <span className="font-normal text-muted-foreground">of {summary.total} counted</span>
            </p>
            {!blind && (
              <p className={cn('text-xs tabular-nums', summary.differences ? 'text-measured' : 'text-muted-foreground')}>
                {summary.differences} {summary.differences === 1 ? 'difference' : 'differences'}
                {summary.valuePence !== 0 && ` · ${summary.valuePence > 0 ? '+' : '−'}${money(Math.abs(summary.valuePence) / 100)}`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-band" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Counted">
          <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.3 }} />
        </div>
      </motion.div>

      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
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
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              ) : undefined
            }
          />
        </div>
        <Select
          value={view}
          onValueChange={(value) => setView(value as CountView)}
          ariaLabel="Show"
          options={[
            { value: 'all', label: `All items · ${counts.all}` },
            { value: 'todo', label: `To count · ${counts.todo}` },
            { value: 'counted', label: `Counted · ${counts.counted}` },
            ...(blind ? [] : [{ value: 'differences', label: `Differences · ${counts.differences}` }]),
          ]}
          className="w-48"
        />
        {/* Blind counting: hide what the system expects so the count isn't nudged towards it. */}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" title="Hide expected quantities while counting">
          <EyeOff size={14} aria-hidden="true" />
          Blind count
          <Switch
            label="Blind count"
            checked={blind}
            onChange={(on) => {
              setBlind(on);
              if (on && view === 'differences') setView('all');
            }}
          />
        </label>
      </motion.div>

      <motion.div variants={SECTION_RISE} ref={sheetRef} className="space-y-5">
        {groups.length === 0 ? (
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            <EmptyState
              icon={view === 'todo' ? Check : Search}
              title={view === 'todo' && !q ? 'Everything is counted' : 'Nothing matches'}
              description={view === 'todo' && !q ? 'Review the differences, then apply the stocktake.' : 'Try another search or show all items.'}
            />
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
                {group.label}
                <span className="tabular-nums normal-case">
                  {group.items.filter((l) => l.counted !== null).length}/{group.items.length}
                </span>
              </h3>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {group.items.map((line) => {
                  const raw = lines.find((l) => l.id === line.id)!;
                  const text = textFor(raw);
                  const bad = parseCount(text) === 'invalid';
                  const v = line.counted !== null ? variance(line.expected, line.counted) : null;
                  return (
                    <li key={line.id} className={cn('flex items-center gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0', v && 'bg-band/15')}>
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-md',
                          !v ? 'bg-band text-muted-foreground' : blind || v.tone === 'match' ? 'bg-success/10 text-success' : v.tone === 'short' ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
                        )}
                        aria-hidden="true"
                      >
                        {!v ? <span className="size-1.5 rounded-full bg-muted-foreground/50" /> : blind || v.tone === 'match' ? <Check size={16} /> : v.tone === 'short' ? <Minus size={16} /> : <Plus size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{line.name}</span>
                        <span className="block truncate text-xs tabular-nums text-muted-foreground">
                          {blind ? line.unit : `Expected ${formatQty(line.expected)} ${line.unit}`}
                          {!blind && v && v.tone !== 'match' && (
                            <span className={cn('ml-1.5 font-semibold', TONE_TEXT[v.tone])}>
                              {formatDelta(v.delta)}
                              {line.cost != null && ` · ${v.delta < 0 ? '−' : '+'}${money(Math.abs(v.delta * line.cost))}`}
                            </span>
                          )}
                          {!blind && v?.large && <span className="ml-1.5 rounded-sm bg-measured/10 px-1 text-micro font-semibold text-measured">Recount?</span>}
                        </span>
                      </span>
                      {canWrite && !blind && text === '' && (
                        <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={() => set(line.stockItemId, formatQty(line.expected))} title="Counted exactly what was expected">
                          <Equal aria-hidden="true" />
                          <span className="hidden sm:inline">Matches</span>
                        </Button>
                      )}
                      <input
                        data-count
                        value={text}
                        onChange={(event) => set(line.stockItemId, event.target.value)}
                        onKeyDown={next}
                        onFocus={(event) => event.currentTarget.select()}
                        inputMode="decimal"
                        enterKeyHint="next"
                        placeholder="—"
                        disabled={!canWrite}
                        aria-label={`Counted ${line.name}`}
                        aria-invalid={bad}
                        className={cn(
                          'h-9 w-24 shrink-0 rounded-md border bg-field px-3 text-right text-base tabular-nums text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured disabled:opacity-50 sm:text-sm',
                          bad ? 'border-exception' : 'border-input',
                        )}
                      />
                      <span className="w-12 shrink-0 truncate text-xs text-muted-foreground" title={line.unit}>
                        {line.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </motion.div>

      {canWrite && (
        // Pinned to the bottom of the viewport so saving is never a scroll away on a long sheet.
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-rule/60 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur">
          <Button variant="ghost" className="text-exception hover:bg-exception/6 hover:text-exception" onClick={() => setConfirm('cancel')} disabled={pending}>
            Cancel stocktake
          </Button>
          <p className={cn('flex-1 text-xs', invalid.length ? 'font-semibold text-exception' : unsaved ? 'text-measured' : 'text-muted-foreground')} aria-live="polite">
            {invalid.length
              ? `${invalid.length} ${invalid.length === 1 ? 'count needs' : 'counts need'} fixing — numbers up to two decimals.`
              : unsaved
                ? `${unsaved} unsaved ${unsaved === 1 ? 'count' : 'counts'}`
                : 'All counts saved'}
          </p>
          <Button variant="outline" onClick={() => save.mutate()} disabled={pending || !unsaved || invalid.length > 0}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save counts
          </Button>
          <Button onClick={() => setConfirm('review')} disabled={pending || summary.counted === 0 || invalid.length > 0}>
            Review &amp; apply
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      )}

      <AnimatePresence>
        {confirm === 'review' && (
          <ReviewDrawer sheet={sheet} summary={summary} pending={complete.isPending} onApply={() => complete.mutate()} onClose={() => setConfirm(null)} />
        )}
      </AnimatePresence>
      {confirm === 'cancel' && (
        <ConfirmDrawer
          title="Cancel this stocktake?"
          message={<>The counts entered so far are discarded and no stock changes. You can start a new count any time.</>}
          confirmLabel="Cancel stocktake"
          pendingLabel="Cancelling…"
          isPending={cancel.isPending}
          onConfirm={() => cancel.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </motion.div>
  );
}

/** The last look before stock changes: every difference, its value, and what's left alone. */
function ReviewDrawer({
  sheet,
  summary,
  pending,
  onApply,
  onClose,
}: {
  sheet: SheetLine[];
  summary: ReturnType<typeof summarise>;
  pending: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  const differences = byImpact(sheet.filter((l) => l.counted !== null && l.counted !== l.expected));
  return (
    <Drawer
      title="Review stocktake"
      description="On-hand stock is set to your counts and each difference recorded as an adjustment."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={pending}>
            Keep counting
          </Button>
          <Button size="lg" className="flex-1" onClick={onApply} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            {differences.length ? `Apply ${differences.length} ${differences.length === 1 ? 'adjustment' : 'adjustments'}` : 'Apply — no changes'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3">
          <Fact surface="card" icon={ClipboardCheck} label="Counted" value={`${summary.counted} of ${summary.total}`} hint={summary.uncounted ? `${summary.uncounted} not counted` : 'Every item'} />
          <Fact surface="card" icon={Check} label="Matched" value={summary.matched} />
          <Fact surface="card" icon={AlertTriangle} label="Differences" value={summary.differences} tone={summary.differences ? 'warning' : 'default'} hint={`${summary.over} over · ${summary.short} short`} />
          <ValueFact summary={summary} money={money} />
        </dl>

        {summary.uncounted > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
            <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
            {summary.uncounted} {summary.uncounted === 1 ? 'item wasn’t' : 'items weren’t'} counted and will keep {summary.uncounted === 1 ? 'its' : 'their'} current stock.
          </p>
        )}

        <DiffList title="What will change" lines={differences} money={money} empty="Every counted item matched — applying records no adjustments." />
      </div>
    </Drawer>
  );
}
