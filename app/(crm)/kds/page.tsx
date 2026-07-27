'use client';

import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCircle2, Clock3, CloudOff, Coffee, Flame, MapPin, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';

import {
  type Order,
  type OrderItem,
  type OrderStatus,
  type OrdersResponse,
  getOrder,
  getOrders,
  updateOrderStatus,
} from '@/lib/api/orders.service';
import { chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { parseModifierName } from '@/lib/utils/modifiers';
import { useKdsStore } from '@/stores/kdsStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const POLL_INTERVAL_MS = 10_000;
const LIVE_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready'];

const COLUMNS: {
  status: OrderStatus;
  title: string;
  emptyLabel: string;
  accent: string;
  count: string;
  action: { label: string; next: OrderStatus; className: string; icon: typeof Flame };
}[] = [
  {
    status: 'pending',
    title: 'New',
    emptyLabel: 'No new orders',
    accent: 'border-t-warning',
    count: 'bg-warning/10 text-warning',
    action: { label: 'Start', next: 'preparing', className: 'bg-warning hover:bg-warning/90', icon: Flame },
  },
  {
    status: 'preparing',
    title: 'Preparing',
    emptyLabel: 'Nothing in preparation',
    accent: 'border-t-primary',
    count: 'bg-primary/10 text-primary',
    action: { label: 'Ready', next: 'ready', className: 'bg-primary hover:bg-primary-hover', icon: Bell },
  },
  {
    status: 'ready',
    title: 'Ready',
    emptyLabel: 'Nothing waiting for collection',
    accent: 'border-t-success',
    count: 'bg-success/10 text-success',
    action: { label: 'Complete', next: 'done', className: 'bg-success hover:bg-success/90', icon: CheckCircle2 },
  },
];

function orderQueryKey(locationId: string, status: OrderStatus) {
  return ['kds-orders', locationId, status] as const;
}

async function getLaneOrders(locationId: string, status: OrderStatus): Promise<OrdersResponse> {
  const firstPage = await getOrders({ page: 1, limit: 100, locationId, status });
  if (firstPage.pages <= 1) return firstPage;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.pages - 1 }, (_, index) => getOrders({ page: index + 2, limit: 100, locationId, status })),
  );

  return {
    ...firstPage,
    data: [firstPage, ...remainingPages].flatMap((page) => page.data),
    page: 1,
    limit: firstPage.total,
    pages: 1,
  };
}

function elapsedLabel(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1_000));
  if (seconds < 60) return '<1m';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function ageClass(order: Order, now: number): string {
  const since = order.updatedAt ?? order.createdAt;
  const mins = (now - new Date(since).getTime()) / 60_000;
  if (mins >= 5) return 'bg-destructive/10 border-destructive/60 ring-2 ring-destructive/30';
  if (mins >= 2) return 'bg-warning/10 border-warning/60 ring-2 ring-warning/25';
  return 'bg-card';
}

function KdsCard({
  order,
  items,
  itemsError,
  now,
  action,
  onBump,
  onRetryItems,
  isBumping,
}: {
  order: Order;
  items: OrderItem[] | undefined;
  itemsError: boolean;
  now: number;
  action: (typeof COLUMNS)[number]['action'];
  onBump: () => void;
  onRetryItems: () => void;
  isBumping: boolean;
}) {
  const Icon = action.icon;
  const orderNumber = order.id.slice(0, 6).toUpperCase();
  const stageSince = order.updatedAt ?? order.createdAt;

  return (
    <article
      aria-labelledby={`order-${order.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition-[background-color,border-color,opacity,transform]',
        ageClass(order, now),
        isBumping && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id={`order-${order.id}`} className="font-mono text-base font-black tracking-wide text-foreground">
            #{orderNumber}
          </p>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {order.source === 'pos' ? <Monitor size={13} aria-hidden="true" /> : <Smartphone size={13} aria-hidden="true" />}
            {order.source === 'pos' ? 'POS' : 'Mobile'}
          </span>
        </div>

        <div className="grid gap-1 text-right text-[11px] font-semibold text-muted-foreground">
          <span className="tabular-nums">
            <span className="sr-only">Total age: </span>
            Total {elapsedLabel(order.createdAt, now)}
          </span>
          <span className="tabular-nums text-foreground">
            <span className="sr-only">Time in current stage: </span>
            Stage {elapsedLabel(stageSince, now)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {itemsError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
            <p className="text-xs font-semibold text-destructive">Item details unavailable</p>
            <button onClick={onRetryItems} className="mt-1 text-xs font-bold text-foreground underline underline-offset-2">
              Retry
            </button>
          </div>
        ) : items === undefined ? (
          <div className="space-y-2" aria-label="Loading item details">
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No item details</p>
        ) : (
          items.map((item) => (
            <div key={item.id}>
              <p className="text-[17px] font-bold leading-snug text-foreground">
                <span className="tabular-nums text-primary">{item.quantity}×</span> {item.name}
              </p>
              {item.notes && <p className="mt-1 pl-6 text-xs font-semibold text-warning">Item note: {item.notes}</p>}
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                  {item.modifiers.map((modifier, index) => {
                    const { category, label } = parseModifierName(modifier.name);
                    return (
                      <span
                        key={`${modifier.modifierId}-${index}`}
                        className="inline-flex overflow-hidden rounded-md border border-primary/25 text-xs font-bold leading-tight"
                      >
                        {category && <span className="bg-primary/10 px-2 py-1 text-primary">{category}</span>}
                        <span className="bg-primary/20 px-2 py-1 text-primary">{label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {order.notes && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-warning">Order note</p>
          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{order.notes}</p>
        </div>
      )}

      <button
        onClick={onBump}
        disabled={isBumping}
        aria-label={`${action.label} order ${orderNumber}`}
        className={cn(
          'flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black text-white transition-colors active:translate-y-px disabled:cursor-wait disabled:opacity-60',
          action.className,
        )}
      >
        <Icon size={17} aria-hidden="true" />
        {isBumping ? 'Updating…' : action.label}
      </button>
    </article>
  );
}

export default function KdsPage() {
  const queryClient = useQueryClient();
  const { locationId } = useWorkspaceStore();
  const soundOn = useKdsStore((state) => state.soundOn);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const previousPendingRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const laneQueries = useQueries({
    queries: COLUMNS.map((column) => ({
      queryKey: orderQueryKey(locationId ?? 'none', column.status),
      queryFn: () => getLaneOrders(locationId!, column.status),
      enabled: Boolean(locationId),
      refetchInterval: POLL_INTERVAL_MS,
      refetchIntervalInBackground: true,
      staleTime: 5_000,
      retry: 2,
    })),
  });

  const live = useMemo(
    () => laneQueries.flatMap((query) => query.data?.data ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [laneQueries],
  );

  const detailQueries = useQueries({
    queries: live.map((order) => ({
      queryKey: ['order', order.id],
      queryFn: () => getOrder(order.id),
      enabled: !Array.isArray(order.items),
      staleTime: 10 * 60_000,
      retry: 2,
    })),
  });

  const itemsFor = useMemo(() => {
    const items = new Map<string, OrderItem[]>();
    for (const order of live) {
      if (Array.isArray(order.items)) items.set(order.id, order.items);
    }
    for (const query of detailQueries) {
      if (query.data) items.set(query.data.id, query.data.items ?? []);
    }
    return items;
  }, [detailQueries, live]);

  const pendingKey = live
    .filter((order) => order.status === 'pending')
    .map((order) => order.id)
    .join(',');

  useEffect(() => {
    const ids = new Set(pendingKey ? pendingKey.split(',') : []);
    const previous = previousPendingRef.current;
    if (previous && soundOn && [...ids].some((id) => !previous.has(id))) chime();
    previousPendingRef.current = ids;
  }, [pendingKey, soundOn]);

  const bump = useMutation({
    mutationKey: ['kds-bump'],
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) => updateOrderStatus(id, next),
    onMutate: async ({ id, next }) => {
      setPendingIds((current) => new Set(current).add(id));
      if (!locationId) return {};

      await queryClient.cancelQueries({ queryKey: ['kds-orders', locationId] });

      let previous: Order | undefined;
      for (const status of LIVE_STATUSES) {
        const data = queryClient.getQueryData<OrdersResponse>(orderQueryKey(locationId, status));
        previous ??= data?.data.find((order) => order.id === id);
        queryClient.setQueryData<OrdersResponse>(orderQueryKey(locationId, status), (current) => {
          if (!current || !current.data.some((order) => order.id === id)) return current;
          return {
            ...current,
            data: current.data.filter((order) => order.id !== id),
            total: Math.max(0, current.total - 1),
          };
        });
      }

      if (previous && LIVE_STATUSES.includes(next)) {
        const moved = { ...previous, status: next, updatedAt: new Date().toISOString() };
        queryClient.setQueryData<OrdersResponse>(orderQueryKey(locationId, next), (current) => {
          if (!current) return current;
          return {
            ...current,
            data: [...current.data.filter((order) => order.id !== id), moved].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            total: current.data.some((order) => order.id === id) ? current.total : current.total + 1,
          };
        });
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (locationId && context?.previous) {
        for (const status of LIVE_STATUSES) {
          queryClient.setQueryData<OrdersResponse>(orderQueryKey(locationId, status), (current) => {
            if (!current) return current;
            const containedOrder = current.data.some((order) => order.id === variables.id);
            const withoutOrder = current.data.filter((order) => order.id !== variables.id);
            if (status !== context.previous?.status) {
              return {
                ...current,
                data: withoutOrder,
                total: containedOrder ? Math.max(0, current.total - 1) : current.total,
              };
            }
            return {
              ...current,
              data: [...withoutOrder, context.previous].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
              total: containedOrder ? current.total : current.total + 1,
            };
          });
        }
      }
      toast('error', error instanceof Error ? error.message : 'Failed to update the order.');
    },
    onSuccess: (updated) => {
      if (updated.inventoryWarnings?.length) {
        toast('error', `Inventory shortfall: ${updated.inventoryWarnings.map((warning) => warning.name).join(', ')}.`);
      }
    },
    onSettled: (_data, _error, variables) => {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(variables.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-all'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-overview'] });
      queryClient.invalidateQueries({ queryKey: ['location-stock'] });
    },
  });

  const hasQueryError = laneQueries.some((query) => query.isError);
  const connectionProblem = !online || hasQueryError;

  async function refreshAll() {
    await Promise.all(laneQueries.map((query) => query.refetch()));
  }

  return (
    <PageLayout
      eyebrow="Service Mode"
      title="Barista Display"
      fullHeight
      headerBorder={false}
      className="flex flex-col gap-3 overflow-hidden"
    >
      {connectionProblem && locationId && (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-2 text-xs font-semibold text-foreground"
        >
          <AlertTriangle size={15} className="shrink-0 text-destructive" aria-hidden="true" />
          <span className="flex-1">
            {!online
              ? 'This display is offline. Existing tickets remain visible and will refresh when the connection returns.'
              : 'Some lanes could not sync. Existing tickets are retained; retrying automatically.'}
          </span>
          <button onClick={() => void refreshAll()} className="font-black text-destructive underline underline-offset-2">
            Retry now
          </button>
        </div>
      )}

      {!locationId ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPin size={23} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-foreground">Choose a location</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select a location from the toolbar to start monitoring its order queue.</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <div className="kds-scrollbar grid h-full min-h-0 snap-x snap-mandatory grid-flow-col auto-cols-[minmax(18rem,88vw)] gap-3 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-3 lg:auto-cols-auto lg:overflow-x-hidden lg:pb-0">
            {COLUMNS.map((column, columnIndex) => {
              const query = laneQueries[columnIndex];
              const orders = [...(query.data?.data ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

              return (
                <section
                  key={column.status}
                  aria-labelledby={`lane-${column.status}`}
                  className="flex min-h-0 snap-start flex-col overflow-hidden rounded-2xl bg-surface-offset/50"
                >
                  <div
                    className={cn(
                      'flex shrink-0 items-center justify-between border-b border-t-4 border-border bg-card px-4 py-3',
                      column.accent,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <h2 id={`lane-${column.status}`} className="text-sm font-black uppercase tracking-widest text-foreground">
                        {column.title}
                      </h2>
                      {query.isError && <AlertTriangle size={14} className="text-destructive" aria-label="Lane sync failed" />}
                    </div>
                    <span
                      className={cn(
                        'flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-sm font-black tabular-nums',
                        column.count,
                      )}
                    >
                      {orders.length}
                    </span>
                  </div>

                  <div className="kds-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                    {query.isLoading ? (
                      Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="h-44 shrink-0 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />
                      ))
                    ) : query.isError && !query.data ? (
                      <div className="flex flex-1 items-center justify-center py-10">
                        <div className="max-w-48 text-center">
                          <CloudOff size={23} className="mx-auto text-destructive" aria-hidden="true" />
                          <p className="mt-2 text-sm font-bold text-foreground">Lane unavailable</p>
                          <button
                            onClick={() => void query.refetch()}
                            className="mt-2 text-xs font-black text-destructive underline underline-offset-2"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center py-10">
                        <div className="text-center">
                          <Coffee size={24} className="mx-auto text-muted-foreground/40" aria-hidden="true" />
                          <p className="mt-2 text-xs font-medium text-muted-foreground">{column.emptyLabel}</p>
                        </div>
                      </div>
                    ) : (
                      orders.map((order) => {
                        const detailIndex = live.findIndex((candidate) => candidate.id === order.id);
                        const detailQuery = detailQueries[detailIndex];
                        return (
                          <KdsCard
                            key={order.id}
                            order={order}
                            items={itemsFor.get(order.id)}
                            itemsError={Boolean(detailQuery?.isError)}
                            now={now}
                            action={column.action}
                            isBumping={pendingIds.has(order.id)}
                            onRetryItems={() => void detailQuery?.refetch()}
                            onBump={() => bump.mutate({ id: order.id, next: column.action.next })}
                          />
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="pointer-events-none fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] font-bold text-muted-foreground shadow-sm backdrop-blur lg:hidden">
            <Clock3 size={12} aria-hidden="true" />
            Swipe between lanes
          </div>
        </div>
      )}
    </PageLayout>
  );
}
