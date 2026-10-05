'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  AlertTriangle,
  ChefHat,
  CloudOff,
  Coffee,
  History,
  ListChecks,
  MapPin,
  Maximize,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from '@/components/icons';
import { KdsTicket, LANE_LABEL } from '@/components/kds/KdsTicket';
import { useMounted } from '@/components/settings/configuration/shared';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import { useWakeLock } from '@/lib/hooks/useWakeLock';
import { type Order, type OrderItem, type OrderStatus, getOrder, getOrders, updateOrderStatus } from '@/lib/modules/ordering/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { chime, unlockAudio } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { KDS_LANES, type KdsLane, NEXT_STATUS, PREVIOUS_STATUS, allDay, arrivals, isOnScreen, ticketName } from '@/lib/utils/kds';
import { type KdsTextSize, useKdsStore } from '@/stores/kdsStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const POLL_INTERVAL_MS = 10_000;
/** How long Undo stays offered after a bump. Long enough to notice a mis-tap across a busy pass. */
const UNDO_MS = 10_000;
const RECENT_LIMIT = 10;
/** One size setting scales the whole ticket — header, items and button together. */
const ZOOM: Record<KdsTextSize, number> = { standard: 1, large: 1.15, xlarge: 1.3 };

const LANE_ACCENT: Record<KdsLane, string> = { pending: 'border-t-measured', preparing: 'border-t-reference', ready: 'border-t-momentum' };
const LANE_EMPTY: Record<KdsLane, string> = { pending: 'No new orders', preparing: 'Nothing being made', ready: 'Nothing waiting' };

const laneKey = (locationId: string, status: KdsLane) => moduleQueryKeys.ordering.key('kds-orders', locationId, status);

/** Every page of a lane, then only what belongs on the screen (paid and released). */
async function getLaneOrders(locationId: string, status: KdsLane): Promise<Order[]> {
  const first = await getOrders({ page: 1, limit: 100, locationId, status, paymentStatus: 'paid' });
  const rest =
    first.pages > 1
      ? await Promise.all(
          Array.from({ length: first.pages - 1 }, (_, index) =>
            getOrders({ page: index + 2, limit: 100, locationId, status, paymentStatus: 'paid' }),
          ),
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

const subscribeFullscreen = (notify: () => void) => {
  document.addEventListener('fullscreenchange', notify);
  return () => document.removeEventListener('fullscreenchange', notify);
};
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
  const { tenantId, locationId } = useWorkspaceStore();
  const display = useKdsStore();
  const mounted = useMounted();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => !!document.fullscreenElement,
    () => false,
  );
  const wake = useWakeLock(display.keepAwake);
  const rootRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<KdsLane | 'all'>('all');
  const [struck, setStruck] = useState<Set<string>>(() => new Set());
  const [bumping, setBumping] = useState<Set<string>>(() => new Set());
  const [recent, setRecent] = useState<RecentBump[]>([]);
  const [undo, setUndo] = useState<RecentBump | null>(null);
  const [recallOpen, setRecallOpen] = useState(false);

  useEffect(() => {
    // Timer labels and the ok → nearly late → late colour. The ageing bar animates on its own.
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);
  // Browsers only let audio start from a gesture: the first tap anywhere on the board unlocks the chime.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const locationName = locations.find((location) => location.id === locationId)?.name;

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
      setUndo(entry);
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
  const moveBack = (entry: RecentBump) => {
    const back = PREVIOUS_STATUS[entry.to];
    if (!back) return;
    setUndo(null);
    setRecent((current) => current.filter((bump) => bump.id !== entry.id));
    move.mutate({ id: entry.id, name: entry.name, from: entry.to, to: back });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => toast('error', 'This browser won’t go full screen here.'));
  };

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
        onRetryItems={() => d?.refetch()}
      />
    );
  };

  const zoom = { zoom: ZOOM[display.textSize] } as React.CSSProperties;

  // The location and the display settings live in this device's storage, which
  // the server render can't see — paint the board only once mounted.
  if (!mounted) {
    return (
      <EditorShell eyebrow="Kitchen" title="Kitchen display" icon={<ChefHat size={20} aria-hidden="true" />} flush>
        <div className="flex-1 animate-pulse bg-band/30" aria-busy="true" />
      </EditorShell>
    );
  }

  return (
    <EditorShell eyebrow="Kitchen" title={locationName ?? 'Kitchen display'} icon={<ChefHat size={20} aria-hidden="true" />} flush>
      <div ref={rootRef} className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
        {/* Toolbar — hideable in Configuration; the offline banner below still shows. */}
        {display.showToolbar && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule/60 bg-card px-3 py-2 md:px-4">
            {display.layout === 'tiles' ? (
              <div role="tablist" aria-label="Show tickets" className="flex gap-1.5">
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
                        'flex h-12 items-center gap-2 rounded-lg border px-4 text-base font-semibold transition-colors',
                        filter === value
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-rule/70 bg-background text-foreground',
                      )}
                    >
                      {value === 'all' ? 'All' : LANE_LABEL[value]}
                      <span data-figure className="tabular-nums opacity-70">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p data-figure className="px-1 text-base font-semibold tabular-nums text-foreground">
                {live.length} live {live.length === 1 ? 'ticket' : 'tickets'}
              </p>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              <span
                role="status"
                className={cn(
                  'mr-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold',
                  syncProblem ? 'bg-exception/10 text-exception' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn('size-2.5 rounded-full', syncProblem ? 'bg-exception' : 'animate-pulse bg-momentum')}
                  aria-hidden="true"
                />
                {!online ? 'Offline' : syncProblem ? 'Reconnecting' : 'Live'}
                {lastSync > 0 && (
                  <span data-figure className="font-medium tabular-nums opacity-80">
                    · {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </span>
              <ToolbarButton
                active={display.showAllDay}
                onClick={() => display.setDisplay({ showAllDay: !display.showAllDay })}
                label="All day"
              >
                <ListChecks size={20} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                active={recallOpen}
                onClick={() => setRecallOpen((open) => !open)}
                label={`Recall${recent.length ? ` (${recent.length})` : ''}`}
              >
                <History size={20} aria-hidden="true" />
              </ToolbarButton>
              <ToolbarButton
                active={display.soundOn}
                onClick={() => {
                  const next = !display.soundOn;
                  display.setSoundOn(next);
                  if (next) chime(display.sound);
                }}
                label={display.soundOn ? 'Sound on' : 'Sound off'}
                iconOnly
              >
                {display.soundOn ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
              </ToolbarButton>
              <ToolbarButton
                active={fullscreen}
                onClick={toggleFullscreen}
                label={fullscreen ? 'Exit full screen' : 'Full screen'}
                iconOnly
              >
                <Maximize size={20} aria-hidden="true" />
              </ToolbarButton>
            </div>
          </div>
        )}

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
              {lastSync > 0 && ` Last update ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`}
            </span>
            <Button variant="outline" onClick={() => laneQueries.forEach((query) => void query.refetch())} className="h-11">
              Retry now
            </Button>
          </div>
        )}
        {display.keepAwake && !wake.supported && (
          <p className="shrink-0 border-b border-rule/50 bg-band/50 px-4 py-1.5 text-xs text-muted-foreground">
            This browser can’t keep the screen awake — set the tablet’s auto-lock to Never.
          </p>
        )}

        {!locationId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="max-w-sm">
              <span
                className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-band text-muted-foreground"
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
                <div className="kds-scrollbar grid h-full min-h-0 snap-x snap-mandatory grid-flow-col auto-cols-[minmax(20rem,88vw)] gap-3 overflow-x-auto p-3 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-x-hidden">
                  {lanes.map((lane) => (
                    <section
                      key={lane.status}
                      aria-labelledby={`lane-${lane.status}`}
                      className="flex min-h-0 snap-start flex-col overflow-hidden rounded-xl border border-rule/60 bg-band/40"
                    >
                      <div
                        className={cn(
                          'flex shrink-0 items-center justify-between border-b border-t-4 border-rule/60 bg-card px-4 py-3',
                          LANE_ACCENT[lane.status],
                        )}
                      >
                        <h2 id={`lane-${lane.status}`} className="flex items-center gap-2 text-lg font-bold">
                          {LANE_LABEL[lane.status]}
                          {lane.query.isError && <AlertTriangle size={16} className="text-destructive" aria-label="Didn’t refresh" />}
                        </h2>
                        <span
                          data-figure
                          className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-foreground px-2 text-lg font-bold tabular-nums text-background"
                        >
                          {lane.orders.length}
                        </span>
                      </div>
                      <div className="kds-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
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
                    <div className="columns-[20rem] gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="mb-3 h-56 animate-pulse rounded-xl bg-band" />
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
              <aside aria-label="All day" className="flex w-72 shrink-0 flex-col border-l border-rule/60 bg-card">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule/60 px-4">
                  <h2 className="text-lg font-bold">All day</h2>
                  <span className="text-sm text-muted-foreground">New + preparing</span>
                </div>
                {allDayLines.length === 0 ? (
                  <p className="p-4 text-base text-muted-foreground">Nothing to make.</p>
                ) : (
                  <ul className="kds-scrollbar min-h-0 flex-1 divide-y divide-rule/45 overflow-y-auto" style={zoom}>
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
              <aside aria-label="Recall" className="flex w-80 shrink-0 flex-col border-l border-rule/60 bg-card">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-rule/60 pl-4 pr-2">
                  <h2 className="text-lg font-bold">Recently moved</h2>
                  <Button variant="ghost" size="icon" onClick={() => setRecallOpen(false)} aria-label="Close recall" className="size-11">
                    <X size={18} />
                  </Button>
                </div>
                {recent.length === 0 ? (
                  <p className="p-4 text-base text-muted-foreground">
                    Tickets you move on this screen appear here, so a mis-tap can be put back.
                  </p>
                ) : (
                  <ul className="min-h-0 flex-1 divide-y divide-rule/45 overflow-y-auto">
                    {recent.map((entry) => {
                      const back = PREVIOUS_STATUS[entry.to];
                      return (
                        <li key={`${entry.id}-${entry.at}`} className="flex items-center gap-3 px-4 py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold">{entry.name}</span>
                            <span className="block text-sm text-muted-foreground">
                              {entry.to === 'done' ? 'Collected' : `Moved to ${LANE_LABEL[entry.to as KdsLane]}`} ·{' '}
                              {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </span>
                          {back ? (
                            <Button variant="outline" onClick={() => moveBack(entry)} className="h-11 shrink-0 gap-1.5">
                              <RotateCcw size={15} aria-hidden="true" /> Back to {LANE_LABEL[back]}
                            </Button>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">Can’t reopen</span>
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

        {undo && (
          <div role="status" className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-4 rounded-xl bg-foreground py-2 pl-5 pr-2 text-background shadow-xl">
              <span className="text-base font-medium">
                {undo.name} {undo.to === 'done' ? 'collected' : `moved to ${LANE_LABEL[undo.to as KdsLane]}`}
              </span>
              {PREVIOUS_STATUS[undo.to] ? (
                <Button
                  variant="ghost"
                  onClick={() => moveBack(undo)}
                  className="h-12 gap-2 px-4 text-base text-background hover:bg-background/10 hover:text-background"
                >
                  <RotateCcw size={17} aria-hidden="true" /> Undo
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUndo(null)}
                  aria-label="Dismiss"
                  className="size-12 text-background hover:bg-background/10 hover:text-background"
                >
                  <X size={18} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </EditorShell>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  iconOnly = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  iconOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      aria-label={iconOnly ? label : undefined}
      className={cn(
        'h-12 gap-2 text-base',
        iconOnly ? 'w-12 px-0' : 'px-3.5',
        active ? 'bg-band text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
      {!iconOnly && label}
    </Button>
  );
}

function LaneBody({
  lane,
  empty,
  children,
}: {
  lane: { query: { isLoading: boolean; isError: boolean; data?: unknown; refetch: () => unknown }; orders: Order[] };
  empty: string;
  children: React.ReactNode;
}) {
  if (lane.query.isLoading)
    return [0, 1].map((i) => <div key={i} className="h-56 shrink-0 animate-pulse rounded-xl bg-band" aria-hidden="true" />);
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
  if (lane.orders.length === 0) return <Empty label={empty} />;
  return <>{children}</>;
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <Coffee size={30} className="text-muted-foreground/40" aria-hidden="true" />
      <p className="text-base font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
