'use client';

import { useLayoutEffect, useRef } from 'react';

import { AlertTriangle, Bell, CheckCircle2, Clock, Flame, Loader2, Smartphone } from '@/components/icons';
import { SOURCE_META, STATUS_META } from '@/components/orders/orderMeta';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import type { Order, OrderItem } from '@/lib/modules/ordering/client';
import { cn } from '@/lib/utils/cn';
import { type KdsLane, elapsedLabel, ticketName } from '@/lib/utils/kds';
import { useLateness } from '@/lib/hooks/useLateness';
import { ageState, durationLabel, stageSince } from '@/lib/utils/kitchen-age';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useKdsStore } from '@/stores/kdsStore';

export const LANE_ACTION: Record<KdsLane, { label: string; icon: typeof Flame }> = {
  pending: { label: 'Start', icon: Flame },
  preparing: { label: 'Ready', icon: Bell },
  ready: { label: 'Collected', icon: CheckCircle2 },
};

/** The kitchen's lanes say the same word the orders screens do. */
export const LANE_LABEL: Record<KdsLane, string> = {
  pending: STATUS_META.pending.label,
  preparing: STATUS_META.preparing.label,
  ready: STATUS_META.ready.label,
};

/*
 * The header band carries the age — the one thing read from across the
 * kitchen — as colour, fill length and a word ("Late"), so it survives colour
 * blindness and a glance. Channel sits below it as text, never as the colour.
 */
const TONE = {
  ok: { band: 'bg-band/70 text-foreground', bar: 'bg-momentum', card: 'border-rule/70' },
  approaching: { band: 'bg-measured/15 text-foreground', bar: 'bg-measured', card: 'border-measured' },
  crashed: { band: 'bg-exception text-white dark:text-background', bar: 'bg-white/80 dark:bg-background/70', card: 'border-exception' },
} as const;

/**
 * The ageing bar runs itself: one linear CSS transition from the ticket's age
 * now to the limit, timed to arrive exactly at the workspace's "late" — smooth and live
 * without re-rendering the board every frame. It restarts when the ticket
 * enters a new stage (its `since` changes).
 */
function AgeBar({ since, lateMins, className }: { since: string; lateMins: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const limit = lateMins * 60_000;
    const elapsed = Math.max(0, Date.now() - new Date(since).getTime());
    bar.style.transition = 'none';
    bar.style.width = `${Math.min(1, elapsed / limit) * 100}%`;
    void bar.offsetWidth; // commit the starting width before animating from it
    bar.style.transition = `width ${Math.max(0, limit - elapsed)}ms linear, background-color 300ms`;
    bar.style.width = '100%';
  }, [since, lateMins]);
  return <div ref={ref} className={cn('h-full', className)} />;
}

/** "No onion", "Without sugar", "Remove foam": the lines a kitchen must not miss. */
const isNegative = (name: string) => /^(no|without|remove|hold)\b/i.test(name.trim());

export function KdsTicket({
  order,
  lane,
  items,
  itemsError,
  now,
  showStage,
  struck,
  bumping,
  onToggleItem,
  onBump,
  onRetryItems,
}: {
  order: Order;
  lane: KdsLane;
  items: OrderItem[] | undefined;
  itemsError: boolean;
  now: number;
  /** In the tiled layout the stage isn't implied by a lane, so the ticket says it. */
  showStage: boolean;
  struck: Set<string>;
  bumping: boolean;
  onToggleItem: (itemId: string) => void;
  onBump: () => void;
  onRetryItems: () => void;
}) {
  // When a ticket is late is the workspace's setting (Settings → Configuration → Orders).
  const lateness = useLateness();
  const age = ageState(order, now, lateness);
  const tone = TONE[age.tone];
  const name = ticketName(order);
  const channel = SOURCE_META[order.source] as (typeof SOURCE_META)[keyof typeof SOURCE_META] | undefined;
  const source = channel ? { label: channel.short, icon: channel.icon } : { label: 'Online', icon: Smartphone };
  const action = LANE_ACTION[lane];
  const allergens = [...new Set((items ?? []).flatMap((item) => item.allergens ?? []))];
  const collectAt = order.collectionTime ? new Date(order.collectionTime) : null;
  const compact = useKdsStore((state) => state.cardSize === 'compact');
  const tapToStrike = useKdsStore((state) => state.tapToStrike);
  const showModifiers = useKdsStore((state) => state.showModifiers);

  return (
    <article
      aria-labelledby={`ticket-${order.id}`}
      className={cn('flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-xl border-2 bg-card', tone.card)}
    >
      <header className={cn('pb-0', compact ? 'px-3 pt-2' : 'px-4 pt-3', tone.band)}>
        <div className="flex items-start justify-between gap-3">
          <h3 id={`ticket-${order.id}`} className={cn('min-w-0 truncate font-bold leading-tight', compact ? 'text-xl' : 'text-2xl')}>
            {name}
          </h3>
          <div className="shrink-0 text-right">
            <p data-figure className={cn('font-bold leading-tight tabular-nums', compact ? 'text-xl' : 'text-2xl')}>
              <span className="sr-only">In this stage for </span>
              {elapsedLabel(stageSince(order), now)}
            </p>
            {age.tone === 'crashed' && (
              <p className="text-xs font-bold uppercase tracking-wide">
                Late<span className="sr-only"> — past {lateness ? durationLabel(lateness.lateMins) : ''}</span>
              </p>
            )}
            {age.tone === 'approaching' && <p className="text-xs font-semibold uppercase tracking-wide text-measured">Nearly late</p>}
          </div>
        </div>
        <div
          className={cn(
            'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold',
            compact ? 'pb-1.5' : 'pb-2.5',
            age.tone === 'crashed' ? 'text-white/85 dark:text-background/80' : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5">
            <source.icon size={15} aria-hidden="true" />
            {source.label}
          </span>
          {showStage && <span className="rounded-md bg-background/70 px-2 py-0.5 text-foreground">{LANE_LABEL[lane]}</span>}
          {collectAt && (
            <span className="flex items-center gap-1.5">
              <Clock size={15} aria-hidden="true" /> Collect {formatInstant(collectAt, { hour: '2-digit', minute: '2-digit' }, '—', [])}
            </span>
          )}
          {!compact && (
            <span data-figure className="tabular-nums">
              Placed {elapsedLabel(order.createdAt, now)} ago
            </span>
          )}
        </div>
        {/* No lateness, no ageing bar: there is nothing to run out of. */}
        {lateness && (
          <div className="-mx-4 h-1.5 bg-black/10" aria-hidden="true">
            <AgeBar since={stageSince(order)} lateMins={lateness.lateMins} className={tone.bar} />
          </div>
        )}
      </header>

      {allergens.length > 0 && (
        <p className="flex items-center gap-2 border-b-2 border-exception bg-exception/10 px-4 py-2 text-base font-bold uppercase tracking-wide text-exception">
          <AlertTriangle size={18} aria-hidden="true" className="shrink-0" />
          Allergens: {allergens.map((allergen) => allergen.replaceAll('_', ' ')).join(', ')}
        </p>
      )}

      {order.notes && (
        <p className="border-b border-measured/40 bg-measured/10 px-4 py-2.5 text-base font-semibold leading-snug text-foreground">
          <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-measured">Note</span>
          {order.notes}
        </p>
      )}

      <div className="flex flex-1 flex-col py-1">
        {itemsError ? (
          <div className="m-3 flex items-center justify-between gap-3 rounded-lg border border-exception/50 bg-exception/6 px-3 py-2">
            <p className="text-sm font-semibold text-exception">Items didn’t load</p>
            <Button variant="outline" onClick={onRetryItems} className="h-11">
              Retry
            </Button>
          </div>
        ) : items === undefined ? (
          <ItemRowsSkeleton compact={compact} label={`Loading the items for ${name}`} />
        ) : items.length === 0 ? (
          <p className="px-4 py-3 text-base italic text-muted-foreground">No items</p>
        ) : (
          <ul>
            {items.map((item) => {
              const done = tapToStrike && struck.has(item.id);
              // Negative and allergy lines are never hidden, even with modifiers off.
              const modifiers = (item.modifiers ?? []).filter((modifier) => showModifiers || isNegative(modifier.name));
              const content = (
                <>
                  <span
                    data-figure
                    className={cn(
                      'shrink-0 font-bold leading-tight tabular-nums text-foreground',
                      compact ? 'w-7 text-xl' : 'w-9 text-2xl',
                      done && 'line-through',
                    )}
                  >
                    {item.quantity}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block font-semibold leading-tight text-foreground',
                        compact ? 'text-lg' : 'text-xl',
                        done && 'line-through',
                      )}
                    >
                      {item.name}
                    </span>
                    {modifiers.length > 0 &&
                      (compact ? (
                        // One line in compact, the "No …" ones still loud.
                        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                          {modifiers.map((modifier, index) => (
                            <span key={`${modifier.modifierId}-${index}`}>
                              {index > 0 && ' · '}
                              <span className={isNegative(modifier.name) ? 'font-bold uppercase text-exception' : 'font-medium'}>
                                {modifier.name}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="mt-1 block space-y-0.5">
                          {modifiers.map((modifier, index) => (
                            <span
                              key={`${modifier.modifierId}-${index}`}
                              className={cn(
                                'block text-base leading-snug',
                                isNegative(modifier.name) ? 'font-bold uppercase text-exception' : 'font-medium text-muted-foreground',
                              )}
                            >
                              {modifier.name}
                            </span>
                          ))}
                        </span>
                      ))}
                    {item.notes && (
                      <span className={cn('mt-1 block font-semibold italic text-measured', compact ? 'text-sm' : 'text-base')}>
                        “{item.notes}”
                      </span>
                    )}
                    {item.allergenCoverage === 'missing_recipe' && (
                      <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-warning">
                        <AlertTriangle size={14} aria-hidden="true" /> Allergens unknown — no recipe
                      </span>
                    )}
                  </span>
                </>
              );
              const rowClass = cn('flex w-full gap-3 text-left', compact ? 'px-3 py-1.5' : 'px-4 py-2');
              return (
                <li key={item.id}>
                  {tapToStrike ? (
                    // Tap an item to strike it off while making the rest — this screen only.
                    <button
                      type="button"
                      onClick={() => onToggleItem(item.id)}
                      aria-pressed={done}
                      className={cn(rowClass, 'touch-manipulation transition-opacity', done && 'opacity-45')}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={compact ? 'p-2 pt-1' : 'p-3 pt-1'}>
        <Button
          onClick={onBump}
          disabled={bumping}
          className={cn('w-full gap-2 active:not-aria-[haspopup]:translate-y-0', compact ? 'h-12 text-base' : 'h-16 text-lg')}
          aria-label={`${action.label}: ${name}`}
        >
          {bumping ? <Loader2 className="animate-spin" aria-hidden="true" /> : <action.icon size={20} aria-hidden="true" />}
          {bumping ? 'Updating…' : action.label}
        </Button>
      </div>
    </article>
  );
}

const ITEM_W = ['w-3/4', 'w-1/2', 'w-2/3'];

/** A ticket's item lines loading — quantity and name, the rows they become. */
function ItemRowsSkeleton({ compact, rows = 2, label }: { compact: boolean; rows?: number; label?: string }) {
  return (
    <div role={label ? 'status' : undefined} aria-busy={label ? true : undefined} aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn('flex gap-3', compact ? 'px-3 py-1.5' : 'px-4 py-2')} aria-hidden="true">
          <Bone className={cn('shrink-0', compact ? 'h-6 w-7' : 'h-7 w-9')} />
          <Bone className={cn(compact ? 'h-5' : 'h-6', ITEM_W[index % ITEM_W.length])} />
        </div>
      ))}
    </div>
  );
}

/** A whole `KdsTicket` loading: header band, age bar, item lines and the bump key, same size. */
export function KdsTicketSkeleton({
  index = 0,
  compact: forced,
}: {
  index?: number;
  /** Before mount, when the device's setting can't be read yet. */ compact?: boolean;
}) {
  const stored = useKdsStore((state) => state.cardSize === 'compact');
  const compact = forced ?? stored;
  return (
    <div
      className="flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-xl border-2 border-rule/60 bg-card"
      aria-hidden="true"
    >
      <div className={compact ? 'px-3 pt-2' : 'px-4 pt-3'}>
        <div className="flex items-start justify-between gap-3">
          <Bone className={cn(compact ? 'h-6' : 'h-7', index % 2 === 0 ? 'w-32' : 'w-24')} />
          <Bone className={cn('shrink-0', compact ? 'h-6 w-12' : 'h-7 w-14')} />
        </div>
        <div className={cn('mt-1 flex gap-3', compact ? 'pb-1.5' : 'pb-2.5')}>
          <Bone className="h-4 w-16" />
          {!compact && <Bone className="h-4 w-24" />}
        </div>
        <div className={cn('h-1.5 bg-band', compact ? '-mx-3' : '-mx-4')} />
      </div>
      <div className="flex flex-1 flex-col py-1">
        <ItemRowsSkeleton compact={compact} rows={2 + (index % 2)} />
      </div>
      <div className={compact ? 'p-2 pt-1' : 'p-3 pt-1'}>
        <Bone className={cn('w-full rounded-lg', compact ? 'h-12' : 'h-16')} />
      </div>
    </div>
  );
}
