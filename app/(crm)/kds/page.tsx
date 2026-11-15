'use client';

import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  AlertTriangle,
  Bell,
  ChefHat,
  ClipboardList,
  CloudOff,
  ExternalLink,
  History,
  ListChecks,
  MapPin,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from '@/components/icons';
import { KdsTicket, KdsTicketSkeleton, LANE_DOT, LANE_LABEL } from '@/components/kds/KdsTicket';
import { useMounted } from '@/components/settings/configuration/shared';
import { EditorShell } from '@/components/shared/EditorShell';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { type Order, type OrderItem, type OrderStatus, getOrder, getOrders, updateOrderStatus } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { dismissToast, toast } from '@/lib/toast';
import { chime, unlockAudio } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { KDS_LANES, type KdsLane, NEXT_STATUS, PREVIOUS_STATUS, allDay, arrivals, isOnScreen, ticketName } from '@/lib/utils/kds';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { type KdsTextSize, useKdsStore } from '@/stores/kdsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const POLL_INTERVAL_MS = 10_000;
/** How long Undo stays offered after a bump. Long enough to notice a mis-tap across a busy pass. */
const UNDO_MS = 10_000;
const RECENT_LIMIT = 10;
/** One size setting scales the whole ticket — header, items and button together. */
const ZOOM: Record<KdsTextSize, number> = { standard: 1, large: 1.15, xlarge: 1.3 };

/** The lanes as the marketing site's kitchen tile draws them: flat columns parted by 1px hairlines. */
const BOARD =
  'grid min-h-0 flex-1 grid-flow-col auto-cols-[minmax(20rem,88vw)] gap-px bg-border lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto';
const LANE_HEAD = 'flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4';

const LANE_EMPTY: Record<KdsLane, string> = { pending: 'No new orders', preparing: 'Nothing being made', ready: 'Nothing waiting' };

const laneKey = (locationId: string, status: KdsLane) => moduleQueryKeys.ordering.key('kds-orders', locationId, status);

/** Every page of a lane, then only what belongs on the screen (paid and released). */
async function getLaneOrders(locationId: string, status: KdsLane): Promise<Order[]> {
  // Not filtered to paid on the server: an order taken by hand is made now and paid later. isOnScreen decides.
  const first = await getOrders({ page: 1, limit: 100, locationId, status });
  const rest =
    first.pages > 1
      ? await Promise.all(
          Array.from({ length: first.pages - 1 }, (_, index) => getOrders({ page: index + 2, limit: 100, locationId, status })),
        )
      : [];
  const now = Date.now();
  const seen = new Set<string>();
  // Offset pages over a moving list can repeat a row; keep the first.
  return [first, ...rest]
    .flatMap((page) => page.data)
    .filter((order) => isOnScreen(order, now) && !seen.has(order.id) && seen.add(order.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The ticket moved on another screen between this one's last poll and the tap. */
class StaleTicket extends Error {
  constructor(public readonly current: OrderStatus) {
    super('stale');
  }
}

interface RecentBump {
  id: string;
  name: string;
  to: OrderStatus;
  at: number;
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

export default function KdsPage() {
  const queryClient = useQueryClient();
  const { locationId } = useWorkspaceStore();
  const display = useKdsStore();
  const mounted = useMounted();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const wake = useWakeLock(display.keepAwake);

  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<KdsLane | 'all'>('all');
  const [struck, setStruck] = useState<Set<string>>(() => new Set());
  const [bumping, setBumping] = useState<Set<string>>(() => new Set());
  const [recent, setRecent] = useState<RecentBump[]>([]);
  // The toast offering Undo for the last move, so Recall can withdraw it once it's been used.
  const undoToast = useRef<string | null>(null);
  const [lastMove, setLastMove] = useState<RecentBump | null>(null);
  const [recallOpen, setRecallOpen] = useState(false);
  // The Orders screen is gated on orders:read; the menu only offers it to whoever may open it.
  const canOpenOrders = hasCapability(
    useAuthStore((state) => state.capabilities),
    'orders:read',
  );

  useEffect(() => {
    // Timer labels and the ok → nearly late → late colour. The ageing bar animates on its own.
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  // Browsers only let audio start from a gesture: the first tap anywhere on the board unlocks the chime.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const laneQueries = useQueries({
    queries: KDS_LANES.map((status) => ({
      queryKey: laneKey(locationId ?? 'none', status),
      queryFn: () => getLaneOrders(locationId!, status),
      enabled: Boolean(locationId),
      refetchInterval: POLL_INTERVAL_MS,
      refetchIntervalInBackground: true,
      staleTime: 5_000,
    })),
  });
  const lanes = KDS_LANES.map((status, index) => ({ status, query: laneQueries[index], orders: laneQueries[index].data ?? [] }));
  const live = lanes
    .flatMap((lane) => lane.orders.map((order) => ({ order, lane: lane.status })))
    .sort((a, b) => a.order.createdAt.localeCompare(b.order.createdAt));
  const lastSync = Math.max(0, ...laneQueries.map((query) => query.dataUpdatedAt));
  const syncProblem = !online || laneQueries.some((query) => query.isError);

  // The list returns rows without items, so each live ticket reads its own detail (N+1 — no bulk endpoint).
  const detailQueries = useQueries({
    queries: live.map(({ order }) => ({
      queryKey: moduleQueryKeys.ordering.key('order', order.id),
      queryFn: () => getOrder(order.id),
      enabled: !Array.isArray(order.items),
      staleTime: 60_000,
    })),
  });
  const detail = new Map<string, { items?: OrderItem[]; isError: boolean; refetch: () => void }>();
  live.forEach(({ order }, index) => {
    const query = detailQueries[index];
    detail.set(order.id, {
      items: Array.isArray(order.items) ? order.items : query?.data ? (query.data.items ?? []) : undefined,
      isError: !!query?.isError,
      refetch: () => void query?.refetch(),
    });
  });

  // Chime for tickets that weren't there on the last poll — and start over when the location changes,
  // so switching queues doesn't ring for every order already waiting.
  const pendingIds = lanes[0].orders.map((order) => order.id).join(',');
  const seenRef = useRef<{ location: string | null; ids: Set<string> | null }>({ location: null, ids: null });
  const newLaneLoaded = lanes[0].query.isSuccess;
  useEffect(() => {
    if (!newLaneLoaded) return;
    const ids = pendingIds ? pendingIds.split(',') : [];
    const previous = seenRef.current.location === locationId ? seenRef.current.ids : null;
    if (display.soundOn && arrivals(previous, ids).length > 0) chime(display.sound);
    seenRef.current = { location: locationId, ids: new Set(ids) };
  }, [display.sound, display.soundOn, locationId, newLaneLoaded, pendingIds]);

  const invalidate = (id: string) => {
    for (const queryKey of [
      moduleQueryKeys.ordering.key('kds-orders'),
      moduleQueryKeys.ordering.key('order', id),
      moduleQueryKeys.ordering.key('orders'),
      moduleQueryKeys.ordering.key('orders-all'),
      moduleQueryKeys.ordering.key('orders-nav-count'),
      moduleQueryKeys.inventory.key('inventory-overview'),
      moduleQueryKeys.inventory.key('location-stock'),
    ])
      void queryClient.invalidateQueries({ queryKey });
  };

  // No optimistic move (the repo keeps them out of anything touching stock — Collected consumes it):
  // the ticket shows "Updating…" and moves when the API has answered.
  const move = useMutation({
    // 'always': an offline tap fails now instead of pausing and replaying a stale move later.
    networkMode: 'always',
    mutationFn: async ({ id, from, to }: { id: string; name: string; from: OrderStatus; to: OrderStatus }) => {
      if (!navigator.onLine) throw new Error('offline');
      // The API accepts any transition, so check first: a stale card must not move a ticket backwards.
      const fresh = await getOrder(id);
      if (fresh.status !== from) throw new StaleTicket(fresh.status);
      return updateOrderStatus(id, to);
    },
    onMutate: ({ id }) => setBumping((current) => new Set(current).add(id)),
    onSuccess: (updated, { id, name, to }) => {
      if (updated.inventoryWarnings?.length) {
        toast('error', `Stock shortfall: ${updated.inventoryWarnings.map((warning) => warning.name).join(', ')}.`);
      }
      const entry = { id, name, to, at: Date.now() };
      setRecent((current) => [entry, ...current.filter((bump) => bump.id !== id)].slice(0, RECENT_LIMIT));
      setLastMove(entry);
    },
    onError: (error, { name }) => {
      if (error instanceof StaleTicket) {
        toast(
          'info',
          `${name} was already moved on another screen${error.current in LANE_LABEL ? ` — it’s ${LANE_LABEL[error.current as KdsLane]}` : ''}.`,
        );
      } else if (error.message === 'offline') {
        toast('error', 'This screen is offline, so nothing changed. Try again when it reconnects.');
      } else {
        toast('error', error.message || 'The ticket didn’t move. Try again.');
      }
    },
    onSettled: (_data, _error, { id }) => {
      setBumping((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      invalidate(id);
    },
  });

  const bump = (order: Order, lane: KdsLane) => move.mutate({ id: order.id, name: ticketName(order), from: lane, to: NEXT_STATUS[lane] });
  /** Back one stage from the board itself (the ticket's menu), not only from Recall. */
  const stepBack = (order: Order, lane: KdsLane) => {
    const back = PREVIOUS_STATUS[lane];
    if (back) move.mutate({ id: order.id, name: ticketName(order), from: lane, to: back });
  };
  const moveBack = (entry: RecentBump) => {
    const back = PREVIOUS_STATUS[entry.to];
    if (!back) return;
    if (undoToast.current) dismissToast(undoToast.current);
    undoToast.current = null;
    setRecent((current) => current.filter((bump) => bump.id !== entry.id));
    move.mutate({ id: entry.id, name: entry.name, from: entry.to, to: back });
  };
  // The app's own toast for each move: what moved, and Undo while it can still go back.
  useEffect(() => {
    if (!lastMove) return;
    const back = PREVIOUS_STATUS[lastMove.to];
    if (undoToast.current) dismissToast(undoToast.current);
    undoToast.current = toast(
      'success',
      `${lastMove.name} ${lastMove.to === 'done' ? 'collected' : `moved to ${LANE_LABEL[lastMove.to as KdsLane]}`}`,
      {
        duration: UNDO_MS,
        ...(back ? { button: { title: `Undo — back to ${LANE_LABEL[back]}`, onClick: () => moveBack(lastMove) } } : {}),
      },
    );
    // moveBack is recreated each render; the toast only needs the one from this move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMove]);

  const toBeMade = live.filter(({ lane }) => lane !== 'ready').map(({ order }) => ({ items: detail.get(order.id)?.items }));
  const allDayLines = allDay(toBeMade);

  const ticket = ({ order, lane }: { order: Order; lane: KdsLane }, showStage: boolean) => {
    const d = detail.get(order.id);
    return (
      <KdsTicket
        key={order.id}
        order={order}
        lane={lane}
        items={d?.items}
        itemsError={!!d?.isError}
        now={now}
        showStage={showStage}
        struck={struck}
        bumping={bumping.has(order.id)}
        onToggleItem={(itemId) =>
          setStruck((current) => {
            const next = new Set(current);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
          })
        }
        onBump={() => bump(order, lane)}
        onBack={PREVIOUS_STATUS[lane] ? () => stepBack(order, lane) : undefined}
        orderHref={canOpenOrders ? `/orders?order=${encodeURIComponent(order.id)}&location=all` : undefined}
        onRetryItems={() => d?.refetch()}
      />
    );
  };

  const zoom = { zoom: ZOOM[display.textSize] } as React.CSSProperties;

  // The location and the display settings live in this device's storage, which
  // the server render can't see — paint the board only once mounted.
  if (!mounted) {
    return (
      <EditorShell title="Kitchen" icon={<ChefHat size={20} aria-hidden="true" />} flush>
        <div className="flex min-h-0 flex-1 flex-col bg-background" role="status" aria-busy="true" aria-label="Loading the kitchen board">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:px-4" aria-hidden="true">
            <Bone className="h-9 w-40" />
            <Bone className="ml-auto h-9 w-28" />
          </div>
          <div className={BOARD}>
            {KDS_LANES.map((status) => (
              <div key={status} className="flex min-h-0 flex-col overflow-hidden bg-background" aria-hidden="true">
                <div className={LANE_HEAD}>
                  <Bone className="h-4 w-24" />
                  <Bone className="h-4 w-5" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
                  {[0, 1].map((i) => (
                    <KdsTicketSkeleton key={i} index={i} compact={false} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </EditorShell>
    );
  }

  return (
    <EditorShell
      title="Kitchen"
      icon={<ChefHat size={20} aria-hidden="true" />}
      flush
      // The screen's few controls live in the app's own header — no second bar under it.
      actions={
        <>
          {/* Silent while all is well — a clock that only says "still live" is noise. It speaks up
              when the board stops updating, beside the banner that says since when. */}
          {syncProblem && (
            <span
              role="status"
              className="flex items-center gap-2 rounded-md bg-exception/10 px-2 py-1.5 text-sm font-semibold text-exception"
            >
              <span className="size-2 rounded-full bg-exception" aria-hidden="true" />
              {online ? 'Reconnecting' : 'Offline'}
            </span>
          )}
          <ToolbarButton
            active={display.showAllDay}
            onClick={() => display.setDisplay({ showAllDay: !display.showAllDay })}
            label="All day"
          >
            <ListChecks size={19} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton active={recallOpen} onClick={() => setRecallOpen((open) => !open)} label="Recall" badge={recent.length}>
            <History size={19} aria-hidden="true" />
          </ToolbarButton>
          <ToolbarButton
            active={display.soundOn}
            onClick={() => {
              const next = !display.soundOn;
              display.setSoundOn(next);
              if (next) chime(display.sound);
            }}
            label={display.soundOn ? 'Sound on' : 'Sound off'}
          >
            {display.soundOn ? <Volume2 size={19} aria-hidden="true" /> : <VolumeX size={19} aria-hidden="true" />}
          </ToolbarButton>
        </>
      }
      subheader={
        // Tiles mix the stages, so they get stage tabs; lanes are the stages already.
        display.layout === 'tiles' ? (
          <div
            role="tablist"
            aria-label="Show tickets"
            className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-3 md:px-4"
          >
            {(['all', ...KDS_LANES] as const).map((value) => {
              const count = value === 'all' ? live.length : lanes.find((lane) => lane.status === value)!.orders.length;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex h-9 touch-manipulation items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                    filter === value ? 'bg-band text-heading' : 'text-muted-foreground active:bg-band/60',
                  )}
                >
                  {value !== 'all' && (
                    <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: LANE_DOT[value] }} />
                  )}
                  {value === 'all' ? 'All' : LANE_LABEL[value]}
                  <span data-figure className="font-medium tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
        {syncProblem && locationId && (
          <div
            role="alert"
            className="flex shrink-0 items-center gap-3 border-b border-exception/40 bg-exception/8 px-4 py-2 text-sm font-semibold text-foreground"
          >
            <CloudOff size={18} aria-hidden="true" className="shrink-0 text-exception" />
            <span className="flex-1">
              {!online
                ? 'This screen is offline. Tickets stay on screen and refresh when it reconnects.'
                : 'Some tickets didn’t refresh. Retrying every 10 seconds.'}
              {lastSync > 0 && ` Last update ${formatInstant(lastSync, { hour: '2-digit', minute: '2-digit' }, '—', [])}.`}
            </span>
            <Button variant="outline" onClick={() => laneQueries.forEach((query) => void query.refetch())} className="h-11">
              Retry now
            </Button>
          </div>
        )}
        {display.keepAwake && !wake.supported && (
          <p className="shrink-0 border-b border-border bg-band/50 px-4 py-1.5 text-xs text-muted-foreground">
            This browser can’t keep the screen awake — set the tablet’s auto-lock to Never.
          </p>
        )}

        {!locationId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <span
                className="mx-auto flex size-12 items-center justify-center rounded-md bg-band text-muted-foreground"
                aria-hidden="true"
              >
                <MapPin size={24} />
              </span>
              <h2 className="mt-4 text-xl font-semibold">Choose a location</h2>
              <p className="mt-1 text-base text-muted-foreground">Pick the location whose orders this screen shows.</p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 min-w-0 flex-1" style={zoom}>
              {display.layout === 'lanes' ? (
                <div className={cn(BOARD, 'kds-scrollbar h-full snap-x snap-mandatory overflow-x-auto lg:overflow-x-hidden')}>
                  {lanes.map((lane) => (
                    <section
                      key={lane.status}
                      aria-labelledby={`lane-${lane.status}`}
                      className="flex min-h-0 snap-start flex-col overflow-hidden bg-background"
                    >
                      <div className={LANE_HEAD}>
                        <h2 id={`lane-${lane.status}`} className="flex items-center gap-2 text-base font-semibold text-heading">
                          <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ backgroundColor: LANE_DOT[lane.status] }} />
                          {LANE_LABEL[lane.status]}
                          {lane.query.isError && <AlertTriangle size={16} className="text-destructive" aria-label="Didn’t refresh" />}
                        </h2>
                        <span data-figure className="text-base font-semibold tabular-nums text-muted-foreground">
                          {lane.orders.length}
                        </span>
                      </div>
                      <div className="kds-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
                        <LaneBody lane={lane} empty={LANE_EMPTY[lane.status]}>
                          {lane.orders.map((order) => ticket({ order, lane: lane.status }, false))}
                        </LaneBody>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="kds-scrollbar h-full overflow-y-auto p-3">
                  {laneQueries.some((query) => query.isLoading) ? (
                    <div className="columns-[20rem] gap-3 [&>*]:mb-3" role="status" aria-busy="true" aria-label="Loading the kitchen board">
                      {[0, 1, 2, 3].map((i) => (
                        <KdsTicketSkeleton key={i} index={i} />
                      ))}
                    </div>
                  ) : (
                    (() => {
                      const shown = live.filter(({ lane }) => filter === 'all' || lane === filter);
                      if (shown.length === 0) return <Empty label={filter === 'all' ? 'No live orders' : LANE_EMPTY[filter]} />;
                      // Top to bottom, then left to right, oldest first — no row gaps under a short ticket.
                      return <div className="columns-[20rem] gap-3 [&>*]:mb-3">{shown.map((entry) => ticket(entry, true))}</div>;
                    })()
                  )}
                </div>
              )}
            </div>

            {display.showAllDay && (
              <aside aria-label="All day" className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
                  <h2 className="text-base font-semibold text-heading">All day</h2>
                  <span className="text-sm text-muted-foreground">New + preparing</span>
                </div>
                {allDayLines.length === 0 ? (
                  <p className="p-4 text-base text-muted-foreground">Nothing to make.</p>
                ) : (
                  <ul className="kds-scrollbar min-h-0 flex-1 divide-y divide-border overflow-y-auto" style={zoom}>
                    {allDayLines.map((line) => (
                      <li key={line.name} className="flex items-baseline gap-3 px-4 py-2.5">
                        <span data-figure className="w-10 shrink-0 text-2xl font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <span className="text-lg font-semibold leading-snug">{line.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            )}

            {recallOpen && (
              <aside aria-label="Recall" className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-border pr-1 pl-4">
                  <h2 className="text-base font-semibold text-heading">Recently moved</h2>
                  <Button variant="ghost" size="icon" onClick={() => setRecallOpen(false)} aria-label="Close recall" className="size-11">
                    <X size={18} />
                  </Button>
                </div>
                {recent.length === 0 ? (
                  <p className="p-4 text-base text-muted-foreground">
                    Tickets you move on this screen appear here, so a mis-tap can be put back.
                  </p>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                    {recent.map((entry) => {
                      const back = PREVIOUS_STATUS[entry.to];
                      return (
                        <li key={`${entry.id}-${entry.at}`} className="flex items-center gap-2 py-3 pr-2 pl-4">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold text-heading">{entry.name}</span>
                            <span className="block text-sm text-muted-foreground">
                              {entry.to === 'done' ? 'Collected' : `Moved to ${LANE_LABEL[entry.to as KdsLane]}`} ·{' '}
                              {formatInstant(entry.at, { hour: '2-digit', minute: '2-digit' }, '—', [])}
                            </span>
                          </span>
                          {back ? (
                            <Button variant="outline" onClick={() => moveBack(entry)} className="h-11 shrink-0 gap-1.5">
                              <RotateCcw size={15} aria-hidden="true" /> Back to {LANE_LABEL[back]}
                            </Button>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">Can’t reopen</span>
                          )}
                          {/* A collected order can't come back here, but it can still be looked up. */}
                          {canOpenOrders && (
                            <Tooltip label="Open in Orders" side="left">
                              <Button variant="ghost" size="icon" asChild className="size-11 shrink-0 text-muted-foreground">
                                <Link
                                  href={`/orders?order=${encodeURIComponent(entry.id)}&location=all`}
                                  aria-label={`Open ${entry.name} in Orders`}
                                >
                                  <ExternalLink size={17} aria-hidden="true" />
                                </Link>
                              </Button>
                            </Tooltip>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </aside>
            )}
          </div>
        )}
      </div>
    </EditorShell>
  );
}

/** A quiet icon key in the kitchen bar; its word is the tooltip and the accessible name. */
function ToolbarButton({
  active,
  onClick,
  label,
  badge = 0,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  /** A small count in the corner (Recall's recent moves). */
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} side="bottom">
      <Button
        variant="ghost"
        onClick={onClick}
        aria-pressed={active}
        aria-label={badge > 0 ? `${label} (${badge})` : label}
        className={cn('relative size-10 px-0', active ? 'bg-band text-heading' : 'text-muted-foreground')}
      >
        {children}
        {badge > 0 && (
          <span
            data-figure
            aria-hidden="true"
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-heading px-0.5 text-[10px] font-semibold tabular-nums text-background"
          >
            {badge}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}

function LaneBody({
  lane,
  empty,
  children,
}: {
  lane: { status: KdsLane; query: { isLoading: boolean; isError: boolean; data?: unknown; refetch: () => unknown }; orders: Order[] };
  empty: string;
  children: React.ReactNode;
}) {
  if (lane.query.isLoading)
    return (
      <div
        className="flex flex-col gap-3"
        role="status"
        aria-busy="true"
        aria-label={`Loading ${LANE_LABEL[lane.status].toLowerCase()} orders`}
      >
        {[0, 1].map((i) => (
          <KdsTicketSkeleton key={i} index={i} />
        ))}
      </div>
    );
  if (lane.query.isError && !lane.query.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <CloudOff size={26} className="text-destructive" aria-hidden="true" />
        <p className="text-base font-semibold">This lane didn’t load</p>
        <Button variant="outline" onClick={() => void lane.query.refetch()} className="h-12 px-5">
          Try again
        </Button>
      </div>
    );
  }
  if (lane.orders.length === 0) return <Empty label={empty} icon={LANE_EMPTY_ICON[lane.status]} />;
  return <>{children}</>;
}

/** Each lane's own picture when it's empty: tickets to come, the pass, the bell. */
const LANE_EMPTY_ICON: Record<KdsLane, typeof Bell> = { pending: ClipboardList, preparing: ChefHat, ready: Bell };

function Empty({ label, icon: Icon = ClipboardList }: { label: string; icon?: typeof Bell }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      {/* Faded as one layer (opacity), not with a see-through stroke colour — a translucent
          stroke darkens wherever the icon's own lines cross. */}
      <Icon size={30} className="text-muted-foreground opacity-40" aria-hidden="true" />
      <p className="text-base font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
