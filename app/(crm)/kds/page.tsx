'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Coffee, Flame, MapPin, Monitor, Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';

import { type Order, type OrderItem, type OrderStatus, getOrder, getOrders, updateOrderStatus } from '@/lib/api/orders.service';
import { chime } from '@/lib/utils/chime';
import { cn } from '@/lib/utils/cn';
import { parseModifierName } from '@/lib/utils/modifiers';
import { useKdsStore } from '@/stores/kdsStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: {
  status: OrderStatus;
  title: string;
  accent: string;
  count: string;
  action: { label: string; next: OrderStatus; className: string; icon: typeof Flame };
}[] = [
  {
    status: 'pending',
    title: 'New',
    accent: 'border-t-warning',
    count: 'bg-warning/10 text-warning',
    action: { label: 'Start', next: 'preparing', className: 'bg-warning hover:bg-warning/90', icon: Flame },
  },
  {
    status: 'preparing',
    title: 'Preparing',
    accent: 'border-t-primary',
    count: 'bg-primary/10 text-primary',
    action: { label: 'Ready', next: 'ready', className: 'bg-primary hover:bg-primary-hover', icon: Bell },
  },
  {
    status: 'ready',
    title: 'Ready',
    accent: 'border-t-success',
    count: 'bg-success/10 text-success',
    action: { label: 'Complete', next: 'done', className: 'bg-success hover:bg-success/90', icon: CheckCircle2 },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsedLabel(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Urgency styling based on how long the order has SAT IN ITS CURRENT COLUMN
 * (updatedAt changes on every status bump): amber after 2 minutes, red after 5.
 */
function ageClass(order: Order, now: number): string {
  const since = order.updatedAt ?? order.createdAt;
  const mins = (now - new Date(since).getTime()) / 60_000;
  if (mins >= 5) return 'bg-destructive/10 border-destructive/50 ring-2 ring-destructive/30';
  if (mins >= 2) return 'bg-warning/10 border-warning/50 ring-2 ring-warning/30';
  return 'bg-card';
}

// ── Order card ────────────────────────────────────────────────────────────────

function KdsCard({
  order,
  items,
  now,
  action,
  onBump,
  isBumping,
}: {
  order: Order;
  /** Line items — merged from the order detail when the list omits them. */
  items: OrderItem[] | undefined;
  now: number;
  action: (typeof COLUMNS)[number]['action'];
  onBump: () => void;
  isBumping: boolean;
}) {
  const Icon = action.icon;
  return (
    <div className={cn('border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-sm transition-colors', ageClass(order, now))}>
      {/* Head: order # · source · elapsed */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-foreground">#{order.id.slice(0, 6).toUpperCase()}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {order.source === 'pos' ? <Monitor size={13} aria-hidden="true" /> : <Smartphone size={13} aria-hidden="true" />}
          <span className="tabular-nums font-semibold">{elapsedLabel(order.createdAt, now)}</span>
        </span>
      </div>

      {/* Items — the part the barista actually reads, so it's big */}
      <div className="flex flex-col gap-1.5">
        {items === undefined ? (
          // Detail still loading
          <div className="space-y-1.5">
            <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-3.5 w-1/2 bg-muted rounded animate-pulse" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No item details</p>
        ) : (
          items.map((item) => (
            <div key={item.id}>
              <p className="text-base font-semibold text-foreground leading-snug">
                <span className="text-primary tabular-nums">{item.quantity}×</span> {item.name}
              </p>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-6 mt-1">
                  {item.modifiers.map((m, idx) => {
                    const { category, label } = parseModifierName(m.name);
                    return (
                      <span
                        key={`${m.modifierId}-${idx}`}
                        className="inline-flex items-center overflow-hidden rounded-md border border-primary/20 text-xs font-semibold leading-tight"
                      >
                        {category && <span className="px-2 py-0.5 bg-primary/10 text-primary">{category}</span>}
                        <span className="px-2 py-0.5 bg-primary/20 text-primary">{label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Notes stand out — allergies live here */}
      {order.notes && (
        <p className="text-xs font-medium text-warning bg-warning/10 border border-warning/30 rounded-lg px-2.5 py-1.5">{order.notes}</p>
      )}

      <button
        onClick={onBump}
        disabled={isBumping}
        className={cn(
          'h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors active:translate-y-px disabled:opacity-60',
          action.className,
        )}
      >
        <Icon size={16} aria-hidden="true" />
        {isBumping ? '…' : action.label}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KdsPage() {
  const qc = useQueryClient();
  const { locationId } = useWorkspaceStore();
  // New-order chime preference — set in Settings → Barista display, persisted per device.
  const soundOn = useKdsStore((s) => s.soundOn);
  const [bumpingId, setBumpingId] = useState<string | null>(null);

  // Ticking clock for elapsed labels / urgency rings.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Shares the cache entry the sidebar badge / dashboard / orders page use,
  // but polls faster while the display is open.
  const { data, isLoading } = useQuery({
    queryKey: ['orders-all', locationId],
    queryFn: () => getOrders({ limit: 200, locationId: locationId ?? undefined }),
    enabled: !!locationId,
    refetchInterval: 10_000,
  });

  const live = useMemo(() => {
    const orders = (data?.data ?? []).filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
    return orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first — FIFO
  }, [data]);

  // The list endpoint doesn't include line items — fetch the detail for each
  // live order (only ever a handful) and merge. Items never change after
  // creation, so cache them long; the key matches the orders page detail view.
  const detailQueries = useQueries({
    queries: live.map((o) => ({
      queryKey: ['order', o.id],
      queryFn: () => getOrder(o.id),
      enabled: !o.items?.length,
      staleTime: 10 * 60_000,
    })),
  });
  const itemsFor = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const o of live) if (o.items?.length) m.set(o.id, o.items);
    for (const q of detailQueries) if (q.data) m.set(q.data.id, q.data.items ?? []);
    return m;
  }, [live, detailQueries]);

  // Chime when a brand-new pending order appears.
  const prevPendingRef = useRef<Set<string> | null>(null);
  const pendingKey = live
    .filter((o) => o.status === 'pending')
    .map((o) => o.id)
    .join(',');
  useEffect(() => {
    const ids = new Set(pendingKey ? pendingKey.split(',') : []);
    const prev = prevPendingRef.current;
    if (prev && soundOn && [...ids].some((id) => !prev.has(id))) chime();
    prevPendingRef.current = ids;
  }, [pendingKey, soundOn]);

  const bump = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) => updateOrderStatus(id, next),
    onMutate: ({ id }) => setBumpingId(id),
    onSettled: () => setBumpingId(null),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['orders-all'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['inventory-overview'] });
      qc.invalidateQueries({ queryKey: ['location-stock'] });
      if (updated.inventoryWarnings?.length) {
        toast('error', `Inventory shortfall: ${updated.inventoryWarnings.map((warning) => warning.name).join(', ')}.`);
      }
    },
    onError: (err) => toast('error', err.message || 'Failed to update the order.'),
  });

  return (
    <PageLayout eyebrow="Service Mode" title="Barista Display" fullHeight headerBorder={false}>
      {!locationId ? (
        <EmptyState icon={MapPin} title="No location selected" description="Select a location from the header to see its order queue." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full min-h-0 pb-4">
          {COLUMNS.map((col) => {
            const orders = live.filter((o) => o.status === col.status);
            return (
              <section key={col.status} className="flex flex-col min-h-0 bg-surface-offset/40 rounded-2xl overflow-hidden">
                <div className={cn('flex items-center justify-between px-4 py-3 border-t-4 bg-card border-b border-border', col.accent)}>
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">{col.title}</h2>
                  <span
                    className={cn('min-w-7 h-7 px-2 rounded-lg flex items-center justify-center text-sm font-bold tabular-nums', col.count)}
                  >
                    {orders.length}
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-36 bg-muted rounded-2xl animate-pulse" />)
                  ) : orders.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-10">
                      <div className="text-center">
                        <Coffee size={22} className="text-muted-foreground/40 mx-auto mb-2" aria-hidden="true" />
                        <p className="text-xs text-muted-foreground">Nothing {col.status === 'pending' ? 'new' : col.status}</p>
                      </div>
                    </div>
                  ) : (
                    orders.map((order) => (
                      <KdsCard
                        key={order.id}
                        order={order}
                        items={itemsFor.get(order.id)}
                        now={now}
                        action={col.action}
                        isBumping={bumpingId === order.id}
                        onBump={() => bump.mutate({ id: order.id, next: col.action.next })}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
