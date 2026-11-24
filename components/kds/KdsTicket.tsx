'use client';

import { useRouter } from 'next/navigation';
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock, ExternalLink, Flame, Loader2, RotateCcw, Smartphone } from '@/components/icons';
import { FULFILMENT_LABEL, SOURCE_META, STATUS_META } from '@/components/orders/orderMeta';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

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

/** Each lane's mark: a small square on its title, as on the marketing site's kitchen tile. Not amber or red — those are lateness. */
export const LANE_DOT: Record<KdsLane, string> = { pending: 'var(--key-1)', preparing: 'var(--key-5)', ready: 'var(--momentum)' };

/*
 * The header is the status, the way every kitchen screen does it: the age — the
 * one thing read from across the kitchen — fills it as colour, bar length and a
 * word ("Late"), so it survives colour blindness and a glance. Channel sits
 * below as text, never as the colour. The body stays neutral.
 */
const TONE = {
  ok: { band: 'bg-card text-heading active:bg-band', bar: 'bg-momentum', card: 'border-border' },
  approaching: { band: 'bg-measured/18 text-heading active:bg-measured/28', bar: 'bg-measured', card: 'border-measured/70' },
  crashed: { band: 'bg-exception text-on-fill active:brightness-95', bar: 'bg-on-fill/75', card: 'border-exception' },
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

/**
 * The first tap on the header arms it ("Tap again") for this long; a second tap
 * inside it moves the ticket on, one tap alone does nothing. Two seconds rather
 * than a double-click's ~350 ms: a cook with wet hands, looking up, isn't quick.
 */
const ARM_MS = 2000;

/** "No onion", "Without sugar", "Remove foam": the lines a kitchen must not miss. */
const isNegative = (name: string) => /^(no|without|remove|hold)\b/i.test(name.trim());

/**
 * Memoised: the board re-renders on every poll, and a ticket whose order,
 * items and state are unchanged (React Query keeps unchanged rows by
 * reference) skips it. The handlers take the order, so the board passes the
 * same function to every ticket.
 */
export const KdsTicket = memo(function KdsTicket({
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
  onBack,
  orderHref,
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
  onBump: (order: Order, lane: KdsLane) => void;
  /** Back one stage — none in the first lane. */
  onBack?: (order: Order, lane: KdsLane) => void;
  /** The order on the Orders screen, when this person may open it. */
  orderHref?: string;
  onRetryItems: (orderId: string) => void;
}) {
  // Tap, then tap again, moves the ticket on (Toast and Lightspeed use a double tap): the
  // first tap arms the header and says "Tap again"; a lone stray tap in a busy kitchen does nothing.
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const lastTap = useRef(0);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  const tapHeader = () => {
    const at = Date.now();
    if (at - lastTap.current < ARM_MS) {
      lastTap.current = 0;
      setArmed(false);
      onBump(order, lane);
      return;
    }
    lastTap.current = at;
    setArmed(true);
  };
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

  const previous = onBack ? LANE_LABEL[lane === 'ready' ? 'preparing' : 'pending'] : null;

  return (
    // Right-click (long-press on a tablet) for the rest: either way along, or the order itself.
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <article
      aria-labelledby={`ticket-${order.id}`}
      className={cn('flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-md border bg-card', tone.card)}
    >
      {/* Double-tap the header to move the ticket on — the Undo toast and Recall
          catch a mistake. Nothing else in it is a control. */}
      <button
        type="button"
        onClick={tapHeader}
        disabled={bumping}
        aria-label={`${action.label}: ${name}. Tap twice, or open the menu for more.`}
        className={cn(
          'block w-full touch-manipulation text-left transition-colors duration-75 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-wait',
          compact ? 'px-3 pt-2' : 'px-3.5 pt-2.5',
          // The age bar is the header's bottom edge; without one, a hairline is. Never both —
          // two translucent lines stacked read as one darker one.
          !lateness && 'border-b border-border',
          tone.band,
        )}
      >
        <span className="flex items-start justify-between gap-3">
          <span
            id={`ticket-${order.id}`}
            className={cn('min-w-0 truncate font-mono font-bold leading-tight', compact ? 'text-xl' : 'text-2xl')}
          >
            {name}
          </span>
          <span className="shrink-0 text-right">
            <span data-figure className={cn('block font-mono font-bold leading-tight tabular-nums', compact ? 'text-xl' : 'text-2xl')}>
              <span className="sr-only">In this stage for </span>
              {elapsedLabel(stageSince(order), now)}
            </span>
            {age.tone === 'crashed' && (
              <span className="block text-xs font-bold uppercase tracking-wide">
                Late<span className="sr-only"> — past {lateness ? durationLabel(lateness.lateMins) : ''}</span>
              </span>
            )}
            {age.tone === 'approaching' && <span className="block text-xs font-bold uppercase tracking-wide text-measured">Nearly late</span>}
          </span>
        </span>
        <span
          className={cn(
            'mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold',
            compact ? 'pb-1.5' : 'pb-2',
            age.tone === 'crashed' ? 'text-on-fill/85' : 'text-muted-foreground',
          )}
        >
          <span className="flex items-center gap-1.5">
            <source.icon size={15} aria-hidden="true" />
            {source.label}
          </span>
          {/* Eat in or takeaway decides plate or bag — said next to where the order came from. */}
          {order.fulfilmentType && FULFILMENT_LABEL[order.fulfilmentType] && (
            <span className={cn(age.tone === 'crashed' ? 'text-on-fill' : 'text-heading')}>{FULFILMENT_LABEL[order.fulfilmentType]}</span>
          )}
          {showStage && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: LANE_DOT[lane] }} />
              {LANE_LABEL[lane]}
            </span>
          )}
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
          {/* What the tap does, said once, quietly. */}
          <span aria-hidden="true" className={cn('ml-auto flex items-center gap-1 text-xs font-bold uppercase tracking-wide', armed && 'text-primary')}>
            {bumping ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Updating
              </>
            ) : armed ? (
              <>Tap again</>
            ) : (
              <>
                <action.icon size={13} /> {action.label}
                <ArrowRight size={12} />
              </>
            )}
          </span>
        </span>
        {/* No lateness, no ageing bar: there is nothing to run out of. */}
        {lateness && (
          <span className={cn('block h-1', age.tone === 'crashed' ? 'bg-black/15' : 'bg-border', compact ? '-mx-3' : '-mx-3.5')} aria-hidden="true">
            <AgeBar since={stageSince(order)} lateMins={lateness.lateMins} className={tone.bar} />
          </span>
        )}
      </button>

      {allergens.length > 0 && (
        <p className="flex items-center gap-2 bg-exception px-3.5 py-2 text-base font-bold uppercase tracking-wide text-on-fill">
          <AlertTriangle size={18} aria-hidden="true" className="shrink-0" />
          Allergens: {allergens.map((allergen) => allergen.replaceAll('_', ' ')).join(', ')}
        </p>
      )}

      {order.notes && (
        <p className="border-b border-measured/40 bg-measured/10 px-3.5 py-2.5 text-base font-semibold leading-snug text-heading">
          <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-measured">Note</span>
          {order.notes}
        </p>
      )}

      <div className="flex flex-1 flex-col py-1.5">
        {itemsError ? (
          <div className="m-3 flex items-center justify-between gap-3 rounded-md border border-exception/50 bg-exception/6 px-3 py-2">
            <p className="text-sm font-semibold text-exception">Items didn’t load</p>
            <Button variant="outline" onClick={() => onRetryItems(order.id)} className="h-11">
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
              const rowClass = cn('flex w-full gap-3 text-left', compact ? 'px-3 py-1.5' : 'px-3.5 py-2');
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

    </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>{name}</ContextMenuLabel>
        <ContextMenuItem icon={action.icon} disabled={bumping} onSelect={() => onBump(order, lane)}>
          {action.label}
        </ContextMenuItem>
        {onBack && previous && (
          <ContextMenuItem icon={RotateCcw} disabled={bumping} onSelect={() => onBack(order, lane)}>
            Back to {previous}
          </ContextMenuItem>
        )}
        {orderHref && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem icon={ExternalLink} onSelect={() => router.push(orderHref)}>
              Open in Orders
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

const ITEM_W = ['w-3/4', 'w-1/2', 'w-2/3'];

/** A ticket's item lines loading — quantity and name, the rows they become. */
function ItemRowsSkeleton({ compact, rows = 2, label }: { compact: boolean; rows?: number; label?: string }) {
  return (
    <div role={label ? 'status' : undefined} aria-busy={label ? true : undefined} aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn('flex gap-3', compact ? 'px-3 py-1.5' : 'px-3.5 py-2')} aria-hidden="true">
          <Bone className={cn('shrink-0', compact ? 'h-6 w-7' : 'h-7 w-9')} />
          <Bone className={cn(compact ? 'h-5' : 'h-6', ITEM_W[index % ITEM_W.length])} />
        </div>
      ))}
    </div>
  );
}

/** A whole `KdsTicket` loading: header band, age bar and item lines, same size. */
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
      className="flex shrink-0 break-inside-avoid flex-col overflow-hidden rounded-md border border-border bg-card"
      aria-hidden="true"
    >
      <div className={compact ? 'px-3 pt-2' : 'px-3.5 pt-2.5'}>
        <div className="flex items-start justify-between gap-3">
          <Bone className={cn(compact ? 'h-6' : 'h-7', index % 2 === 0 ? 'w-32' : 'w-24')} />
          <Bone className={cn('shrink-0', compact ? 'h-6 w-12' : 'h-7 w-14')} />
        </div>
        <div className={cn('mt-1 flex gap-3', compact ? 'pb-1.5' : 'pb-2.5')}>
          <Bone className="h-4 w-16" />
          {!compact && <Bone className="h-4 w-24" />}
        </div>
        <div className={cn('h-1 bg-border', compact ? '-mx-3' : '-mx-3.5')} />
      </div>
      <div className="flex flex-1 flex-col py-1.5">
        <ItemRowsSkeleton compact={compact} rows={2 + (index % 2)} />
      </div>
    </div>
  );
}
