'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Coins,
  Droplets,
  History,
  type IconComponent,
  PackageMinus,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from '@/components/icons';
import { fmtQty } from '@/components/inventory/stock/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadMore } from '@/components/shared/LoadMore';
import { FactsSkeleton } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { type LossRecord, getLossLog } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupByDay } from '@/lib/utils/ledger';
import { LOSS_LABEL, type LossKind, type LossPeriod, periodFrom, readLoss, summariseLosses } from '@/lib/utils/losses';
import { movementValue } from '@/lib/utils/stock-cost';
import { formatInstant } from '@/lib/utils/workspace-time';

/*
 * What's been written off for this item here: a period summary (how much, what
 * it cost, the main reason), then the losses by day as audit rows. Period is a
 * server filter; reason filters what's loaded. Loads more on scroll.
 */

const PAGE_SIZE = 100;

const KIND: Record<LossKind, { tile: string; icon: IconComponent }> = {
  expired: { tile: 'bg-measured/10 text-measured', icon: Clock },
  damaged: { tile: 'bg-exception/8 text-exception', icon: PackageMinus },
  spilt: { tile: 'bg-reference/8 text-reference', icon: Droplets },
  quality: { tile: 'bg-momentum/8 text-momentum', icon: Sparkles },
  theft: { tile: 'bg-exception/8 text-exception', icon: ShieldAlert },
  other: { tile: 'bg-band text-muted-foreground', icon: CircleDot },
};

const PERIOD_LABEL: Record<LossPeriod, string> = { '30d': 'Last 30 days', '90d': 'Last 90 days', '12m': 'Last 12 months', all: 'All time' };
const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });

export function LossesSection({
  stockItemId,
  locationId,
  tenantId,
  unit,
  cost,
  canLog,
  onLogWaste,
}: {
  stockItemId: string;
  locationId: string | null;
  tenantId: string | null;
  unit: string;
  cost: number | null;
  canLog: boolean;
  onLogWaste: () => void;
}) {
  const money = useWorkspaceMoney();
  const { location } = useCurrentWorkspace();
  const [period, setPeriod] = useState<LossPeriod>('all');
  const [kind, setKind] = useState<LossKind | 'all'>('all');
  const [now] = useState(() => new Date());
  const from = periodFrom(period, now);

  // Under 'loss-log' so the page's invalidation after logging waste refreshes it.
  const query = useInfiniteQuery({
    queryKey: moduleQueryKeys.inventory.key('loss-log', 'item', stockItemId, locationId, period),
    queryFn: ({ pageParam }) =>
      getLossLog({
        tenantId: tenantId ?? undefined,
        stockItemId,
        locationId: locationId ?? undefined,
        from,
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !!tenantId && !!locationId,
  });

  // When the period is empty, one row from all time says whether anything was ever
  // logged — "nothing this month, last was in August" reads very differently from
  // "never".
  const loaded: LossRecord[] = query.data?.pages.flatMap((page) => page.data) ?? [];
  const periodEmpty = !query.isPending && !query.isError && loaded.length === 0;
  const latest = useQuery({
    queryKey: moduleQueryKeys.inventory.key('loss-log', 'item', stockItemId, locationId, 'latest'),
    queryFn: () => getLossLog({ tenantId: tenantId ?? undefined, stockItemId, locationId: locationId ?? undefined, limit: 1 }),
    enabled: periodEmpty && period !== 'all' && !!tenantId && !!locationId,
  });

  if (!locationId) return null;

  const total = query.data?.pages[0]?.total ?? 0;
  const partial = loaded.length < total;
  const summary = summariseLosses(loaded, cost);
  const kinds = [...new Set(loaded.map((loss) => readLoss(loss).kind))];
  const shown = kind === 'all' ? loaded : loaded.filter((loss) => readLoss(loss).kind === kind);
  const days = groupByDay(shown, now);
  const lastEver = latest.data?.data[0];
  const here = location?.name ?? 'this location';

  return (
    // A flex column, so an empty tab's message centres in the page — as Transfers does.
    <motion.div className="flex flex-1 flex-col space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.section
        variants={SECTION_RISE}
        aria-labelledby="losses-waste"
        // Only an empty tab stretches: with entries, History follows right below.
        className={cn('space-y-4', periodEmpty && 'flex flex-1 flex-col')}
      >
        <div className="flex min-h-9 flex-wrap items-center gap-2">
          <h2 id="losses-waste" className="flex-1 text-base font-semibold tracking-title text-foreground">
            Waste
          </h2>
          <Select
            value={period}
            onValueChange={(value) => {
              setPeriod(value as LossPeriod);
              setKind('all');
            }}
            ariaLabel="Period"
            options={(Object.keys(PERIOD_LABEL) as LossPeriod[]).map((value) => ({ value, label: PERIOD_LABEL[value] }))}
            className="w-40"
          />
          {canLog && (
            <Button onClick={onLogWaste}>
              <PackageMinus aria-hidden="true" /> Log waste
            </Button>
          )}
        </div>
        {query.isError ? (
          <ErrorState title="Couldn’t load losses" onRetry={() => void query.refetch()} />
        ) : query.isPending || (periodEmpty && period !== 'all' && latest.isPending) ? (
          <FactsSkeleton count={3} surface="card" label="Loading losses" className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-3" />
        ) : periodEmpty ? (
          lastEver ? (
            <EmptyState
              className="flex-1"
              icon={CheckCircle2}
              compact
              kind="done"
              title={`Nothing written off in the ${PERIOD_LABEL[period].toLowerCase()}`}
              description={`The last was on ${formatDay(lastEver.createdAt)} — ${LOSS_LABEL[readLoss(lastEver).kind].toLowerCase()}, ${fmtQty(Math.abs(Number(lastEver.quantity)))} ${unit}.`}
              action={{ label: 'Show all time', icon: History, onClick: () => setPeriod('all') }}
            />
          ) : (
            <EmptyState
              className="flex-1"
              icon={PackageMinus}
              compact
              kind="start"
              title="No waste logged yet"
              description={`When something is thrown away — expired, spilt, damaged — log it so stock at ${here} stays true and you can see what waste costs.`}
              action={canLog ? { label: 'Log waste', icon: PackageMinus, onClick: onLogWaste } : undefined}
            />
          )
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact
              surface="card"
              icon={PackageMinus}
              label="Written off"
              value={`${fmtQty(summary.quantity)} ${unit}`}
              tone="warning"
              hint={`${summary.count} ${summary.count === 1 ? 'entry' : 'entries'}${partial ? ` of ${total} loaded` : ''}`}
            />
            <Fact
              surface="card"
              icon={Coins}
              label="Cost"
              value={summary.valuePence == null ? '—' : money(summary.valuePence / 100)}
              tone={summary.valuePence ? 'danger' : 'default'}
              hint={summary.valuePence == null ? 'No cost for this item yet' : 'At what it cost when written off'}
            />
            <Fact
              surface="card"
              icon={summary.topKind ? KIND[summary.topKind].icon : TriangleAlert}
              label="Main reason"
              value={summary.topKind ? LOSS_LABEL[summary.topKind] : '—'}
              hint={
                summary.topKind === 'expired'
                  ? 'Order less, or use first'
                  : summary.topKind === 'theft'
                    ? 'Worth checking the till area'
                    : undefined
              }
            />
          </dl>
        )}
      </motion.section>

      {loaded.length > 0 && (
        <motion.section variants={SECTION_RISE} aria-labelledby="losses-history" className="space-y-4">
          <div className="flex min-h-9 items-center gap-3">
            <h2 id="losses-history" className="flex-1 text-base font-semibold tracking-title text-foreground">
              History
            </h2>
            {kinds.length > 1 && (
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as LossKind | 'all')}
                ariaLabel="Reason"
                options={[{ value: 'all', label: 'All reasons' }, ...kinds.map((value) => ({ value, label: LOSS_LABEL[value] }))]}
                className="w-40"
              />
            )}
          </div>
          {days.map((day) => (
            <section key={day.key} aria-label={day.label}>
              <h3 className="mb-2 text-label uppercase text-muted-foreground">{day.label}</h3>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {day.items.map((loss) => (
                  <LossRow key={loss.id} loss={loss} unit={unit} cost={cost} money={money} />
                ))}
              </ul>
            </section>
          ))}
          <LoadMore hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />
        </motion.section>
      )}
    </motion.div>
  );
}

const formatDay = (iso: string) => formatInstant(iso, { day: 'numeric', month: 'short', year: 'numeric' });


function LossRow({
  loss,
  unit,
  cost,
  money,
}: {
  loss: LossRecord;
  unit: string;
  cost: number | null;
  money: ReturnType<typeof useWorkspaceMoney>;
}) {
  const { kind, note } = readLoss(loss);
  const meta = KIND[kind];
  const quantity = Math.abs(Number(loss.quantity));
  const value = movementValue({ quantity, unitCost: loss.unitCost }, cost);

  return (
    <li className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.tile)} aria-hidden="true">
        <meta.icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{LOSS_LABEL[kind]}</span>
        {/* Who logged it leads the line — the question a manager asks of a loss. */}
        {(loss.user?.name || note) && (
          <span className="block text-xs leading-relaxed text-muted-foreground">
            {[loss.user?.name && `by ${loss.user.name}`, note].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums text-exception">
          −{fmtQty(quantity)} {unit}
        </span>
        <span className="flex items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground">
          {value != null ? (
            money(value)
          ) : (
            <>
              {fmtQty(Number(loss.quantityBefore))}
              <ArrowRight size={10} aria-hidden="true" />
              {fmtQty(Number(loss.quantityAfter))}
            </>
          )}
        </span>
      </span>
      <time
        dateTime={loss.createdAt}
        className="hidden w-12 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground sm:block"
      >
        {time(loss.createdAt)}
      </time>
    </li>
  );
}
