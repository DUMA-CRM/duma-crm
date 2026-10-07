'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import {
  ArrowLeftRight,
  ArrowRight,
  Gauge,
  History,
  type IconComponent,
  PackageMinus,
  PackagePlus,
  TrendingDown,
} from '@/components/icons';
import { fmtQty } from '@/components/inventory/stock/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadMore } from '@/components/shared/LoadMore';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import { Select } from '@/components/ui/select';

import { type StockMovement, getInventoryLedger } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type LedgerTone, type LedgerView, groupByDay, inLedgerView, movementTitle, netChange, sourceLabel } from '@/lib/utils/ledger';

/*
 * The item's stock ledger at this location, in the audit log's shape: day
 * headings, one row per movement read as a sentence — what happened, which
 * container, who, from where — with the signed change and the balance it left.
 * Loads more on scroll.
 */

const PAGE_SIZE = 40;

const TONE: Record<LedgerTone, { tile: string; text: string; icon: IconComponent }> = {
  in: { tile: 'bg-primary/8 text-primary', text: 'text-primary', icon: PackagePlus },
  out: { tile: 'bg-momentum/8 text-momentum', text: 'text-foreground', icon: TrendingDown },
  waste: { tile: 'bg-exception/8 text-exception', text: 'text-exception', icon: PackageMinus },
  adjust: { tile: 'bg-measured/10 text-measured', text: 'text-measured', icon: Gauge },
  transfer: { tile: 'bg-reference/8 text-reference', text: 'text-reference', icon: ArrowLeftRight },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function LedgerSection({ stockItemId, locationId, unit }: { stockItemId: string; locationId: string | null; unit: string }) {
  const [view, setView] = useState<LedgerView>('all');
  const [now] = useState(() => new Date());

  // Keyed under 'stock-movements', stockItemId so the page's invalidateStock refreshes it.
  const query = useInfiniteQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-movements', stockItemId, 'ledger', locationId),
    queryFn: ({ pageParam }) => getInventoryLedger({ locationId: locationId ?? undefined, stockItemId, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !!locationId,
  });

  if (!locationId) return null;

  const loaded = query.data?.pages.flatMap((page) => page.data) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const shown = loaded.filter((m) => inLedgerView(view, m));
  const days = groupByDay(shown, now);

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <Select
          value={view}
          onValueChange={(value) => setView(value as LedgerView)}
          ariaLabel="Show"
          options={[
            { value: 'all', label: 'All movements' },
            { value: 'in', label: 'Stock in' },
            { value: 'out', label: 'Stock out' },
            { value: 'receive', label: 'Deliveries' },
            { value: 'consume', label: 'Used in orders' },
            { value: 'waste', label: 'Waste' },
            { value: 'adjust', label: 'Corrections' },
            { value: 'transfer', label: 'Transfers' },
          ]}
          className="w-52"
        />
        {loaded.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {view === 'all'
              ? `${loaded.length} of ${total} movements`
              : `${shown.length} shown · net ${formatSigned(netChange(shown))} ${unit}`}
            {view !== 'all' && loaded.length < total && ' in what’s loaded'}
          </span>
        )}
      </motion.div>

      <motion.section variants={SECTION_RISE} aria-label="Ledger" className="space-y-5">
        {query.isError ? (
          <ErrorState title="Couldn’t load the ledger" onRetry={() => void query.refetch()} />
        ) : query.isPending ? (
          // A day: its label, then the card of movements.
          <div role="status" aria-busy="true" aria-label="Loading the ledger">
            <Bone className="mb-2 h-3 w-24" />
            <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {Array.from({ length: 4 }, (_, index) => (
                <RowSkeleton key={index} index={index} />
              ))}
            </div>
          </div>
        ) : days.length === 0 ? (
          <EmptyState
            icon={History}
            compact
            kind={loaded.length === 0 ? 'start' : 'search'}
            title={loaded.length === 0 ? 'No movements yet' : 'Nothing of that kind'}
            description={
              loaded.length === 0
                ? 'Deliveries, orders, waste, transfers and stocktakes at this location will appear here as they happen.'
                : 'Try another view, or scroll to load older movements.'
            }
            action={loaded.length === 0 ? undefined : { label: 'Show all movements', onClick: () => setView('all') }}
          />
        ) : (
          days.map((day) => (
            <section key={day.key} aria-label={day.label}>
              <h3 className="mb-2 flex items-center gap-2 text-label uppercase text-muted-foreground">
                {day.label}
                {(() => {
                  const net = netChange(day.items);
                  return (
                    <span
                      className={cn(
                        'rounded-sm px-1.5 py-0.5 text-micro font-semibold normal-case tabular-nums',
                        net > 0
                          ? 'bg-momentum/8 text-momentum'
                          : net < 0
                            ? 'bg-exception/8 text-exception'
                            : 'bg-band text-muted-foreground',
                      )}
                    >
                      net {formatSigned(net)} {unit}
                    </span>
                  );
                })()}
              </h3>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {day.items.map((movement) => (
                  <LedgerRow key={movement.id} movement={movement} fallbackUnit={unit} />
                ))}
              </ul>
            </section>
          ))
        )}
        {!query.isError && (
          <LoadMore hasMore={!!query.hasNextPage} loading={query.isFetchingNextPage} onLoadMore={() => void query.fetchNextPage()} />
        )}
      </motion.section>
    </motion.div>
  );
}

const formatSigned = (n: number) => (n > 0 ? `+${fmtQty(n)}` : n < 0 ? `−${fmtQty(-n)}` : '0');

/** One movement as an audit row. `showContainer: false` on a container's own page, where every row is that container. */
export function LedgerRow({
  movement,
  fallbackUnit,
  showContainer = true,
}: {
  movement: StockMovement;
  fallbackUnit: string;
  showContainer?: boolean;
}) {
  const { title, tone } = movementTitle(movement);
  const meta = TONE[tone];
  const quantity = Number(movement.quantity);
  const unit = movement.unitOfMeasure ?? fallbackUnit;
  const source = sourceLabel(movement.sourceType);
  const detail = [
    showContainer ? movement.stockUnit?.label : null,
    movement.user?.name ? `by ${movement.user.name}` : null,
    source && !title.toLowerCase().includes(source.toLowerCase()) ? source : null,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.tile)} aria-hidden="true">
        <meta.icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {detail.join(' · ') || 'Stock movement'}
          {movement.orderId && (
            <>
              {' · '}
              <Link href={`/orders?order=${movement.orderId}`} className="font-semibold text-primary hover:underline">
                View order
              </Link>
            </>
          )}
        </span>
        {movement.notes && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/80">{movement.notes}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className={cn('block text-sm font-semibold tabular-nums', quantity < 0 && tone !== 'waste' ? 'text-foreground' : meta.text)}>
          {formatSigned(quantity)} {unit}
        </span>
        {movement.quantityAfter != null && (
          <span
            className="flex items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground"
            title="Balance at this location after the movement"
          >
            {movement.quantityBefore != null && fmtQty(Number(movement.quantityBefore))}
            <ArrowRight size={10} aria-hidden="true" />
            {fmtQty(Number(movement.quantityAfter))}
          </span>
        )}
      </span>
      <time
        dateTime={movement.createdAt}
        className="hidden w-12 shrink-0 pt-0.5 text-right text-xs tabular-nums text-muted-foreground sm:block"
      >
        {time(movement.createdAt)}
      </time>
    </li>
  );
}
