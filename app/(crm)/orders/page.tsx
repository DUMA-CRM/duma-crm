'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Eye,
  Flame,
  MapPin,
  Monitor,
  ShoppingBag,
  Smartphone,
  User,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';

import { API_PREFIX } from '@/lib/api/client';
import {
  type Order,
  type OrderDetail as OrderDetailType,
  type OrderStatus,
  getOrder,
  getOrders,
  updateOrderStatus,
} from '@/lib/api/orders.service';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 50;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const STATUS_CONFIG: Record<OrderStatus, { label: string; dot: string; text: string; border: string; bg: string }> = {
  pending: { label: 'Pending', dot: 'bg-muted-foreground', text: 'text-muted-foreground', border: 'border-border', bg: 'bg-muted/50' },
  preparing: { label: 'Preparing', dot: 'bg-warning', text: 'text-warning', border: 'border-warning/40', bg: 'bg-warning/5' },
  ready: { label: 'Ready', dot: 'bg-primary', text: 'text-primary', border: 'border-primary/40', bg: 'bg-primary/5' },
  done: { label: 'Done', dot: 'bg-success', text: 'text-success', border: 'border-success/40', bg: 'bg-success/5' },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-destructive',
    text: 'text-destructive',
    border: 'border-destructive/40',
    bg: 'bg-destructive/5',
  },
};

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

const LIVE_STATUSES: OrderStatus[] = ['pending', 'preparing', 'ready'];

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Status badge + inline picker ─────────────────────────────────────────────

function StatusBadge({ order, stopProp = false }: { order: Order; stopProp?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const s = STATUS_CONFIG[order.status];
  const nexts = NEXT_STATUSES[order.status];

  const { mutate, isPending } = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(order.id, status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-all'] });
      qc.invalidateQueries({ queryKey: ['order', order.id] });
      qc.invalidateQueries({ queryKey: ['inventory-overview'] });
      qc.invalidateQueries({ queryKey: ['location-stock'] });
      if (updated.inventoryWarnings?.length) {
        toast('error', `Order completed with ${updated.inventoryWarnings.length} inventory shortfall${updated.inventoryWarnings.length === 1 ? '' : 's'}.`);
      }
      setOpen(false);
    },
    onError: (err) => toast('error', err.message || 'Failed to update the order status.'),
  });

  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
        s.bg,
        s.text,
        s.border,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );

  if (nexts.length === 0) return badge;

  return (
    <div
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        onClick={(e) => {
          if (stopProp) e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-opacity disabled:opacity-60 hover:opacity-80',
          s.bg,
          s.text,
          s.border,
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
        {s.label}
        <ChevronDown size={10} className="shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-36">
            {nexts.map((next) => {
              const ns = STATUS_CONFIG[next];
              return (
                <button
                  key={next}
                  onClick={(e) => {
                    e.stopPropagation();
                    mutate(next);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold hover:bg-muted transition-colors text-left',
                    ns.text,
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', ns.dot)} />
                  {ns.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Live ticket card ──────────────────────────────────────────────────────────

function LiveTicket({ order, active, onClick }: { order: Order; active: boolean; onClick: () => void }) {
  const s = STATUS_CONFIG[order.status];
  const preview =
    order.items
      ?.slice(0, 2)
      .map((i) => `${i.quantity}× ${i.name}`)
      .join(', ') ?? '—';
  const hasMore = (order.items?.length ?? 0) > 2;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 p-3 rounded-xl border w-52 shrink-0 text-left transition-all',
        active ? 'border-primary/60 bg-primary/5 shadow-sm' : 'border-border bg-card hover:bg-surface-offset',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground">#{order.id.slice(0, 8)}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide',
            s.bg,
            s.text,
            s.border,
          )}
        >
          <span className={cn('w-1 h-1 rounded-full shrink-0', s.dot)} />
          {s.label}
        </span>
      </div>
      <p className="text-[11px] text-foreground font-medium leading-snug line-clamp-2">
        {preview}
        {hasMore && <span className="text-muted-foreground"> +{(order.items?.length ?? 0) - 2} more</span>}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{timeAgo(order.createdAt)}</span>
        <span className="text-xs font-semibold tabular-nums">£{Number(order.totalAmount).toFixed(2)}</span>
      </div>
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_ICONS: Record<OrderStatus, React.ElementType> = {
  pending: Clock,
  preparing: Flame,
  ready: Bell,
  done: CheckCircle2,
  cancelled: XCircle,
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m} min ${rem} sec` : `${m} min`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM > 0 ? `${h} hr ${remM} min` : `${h} hr`;
}

// ── Receipt modal ──────────────────────────────────────────────────────────────

function ReceiptModal({ orderId, apiBase, onClose }: { orderId: string; apiBase: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/v1/receipts/${orderId}/receipt`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Couldn’t load the receipt (${res.status}).`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, apiBase]);

  function download() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${orderId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <Modal title="Receipt" onClose={onClose} className="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="h-[70vh] rounded-lg border border-border overflow-hidden bg-muted">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading receipt…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center px-6 text-center text-sm text-destructive">{error}</div>
          ) : url ? (
            <iframe src={url} title="Receipt" className="w-full h-full" />
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={download} disabled={!url}>
            <Download />
            Download PDF
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Order detail panel ────────────────────────────────────────────────────────

function OrderDetailPanel({ orderId }: { orderId: string }) {
  const [showReceipt, setShowReceipt] = useState(false);

  const { data, isLoading } = useQuery<OrderDetailType>({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex gap-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-1 h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const history = data.statusHistory ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* ── Receipt (left) ── */}
      <div className="w-full lg:w-80 shrink-0 bg-background border border-dashed border-border rounded-xl px-5 py-4 font-mono">
        <div className="text-center mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Receipt</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">#{data.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(data.createdAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="border-t border-dashed border-border pt-3 flex flex-col gap-1.5">
          {data.items.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between gap-2">
                <span className="text-[11px] text-foreground">
                  <span className="text-muted-foreground">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-[11px] font-semibold tabular-nums shrink-0">£{parseFloat(item.subtotal).toFixed(2)}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="pl-4 flex flex-col gap-0.5 mt-0.5">
                  {item.modifiers.map((m, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">+ {m.name}</span>
                      {parseFloat(m.priceAdjust) !== 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">£{parseFloat(m.priceAdjust).toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-border mt-3 pt-3 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Items</span>
            <span>{data.items.reduce((s, i) => s + i.quantity, 0)}</span>
          </div>
          {data.discountAmount && parseFloat(data.discountAmount) !== 0 && (
            <div className="flex justify-between text-[11px] text-success">
              <span>Discount</span>
              <span className="tabular-nums">−£{parseFloat(data.discountAmount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[12px] font-bold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">£{parseFloat(data.totalAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>Payment</span>
            <span className="inline-flex items-center gap-1">
              {data.paymentMethod === 'cash' ? <Banknote size={10} /> : <CreditCard size={10} />}
              {data.paymentMethod === 'cash' ? 'Cash' : 'Card'}
            </span>
          </div>
        </div>

        {data.notes && (
          <div className="border-t border-dashed border-border mt-3 pt-3">
            <p className="text-[10px] text-muted-foreground italic text-center">{data.notes}</p>
          </div>
        )}
      </div>

      {/* ── Right section ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Timeline + Details side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Timeline */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Timeline</p>
            {history.length > 0 ? (
              <div className="flex flex-col">
                {history.map((entry, idx) => {
                  const s = STATUS_CONFIG[entry.status];
                  const Icon = STATUS_ICONS[entry.status];
                  const isLast = idx === history.length - 1;
                  const prev = idx > 0 ? history[idx - 1] : null;
                  const duration = prev ? formatDuration(new Date(entry.createdAt).getTime() - new Date(prev.createdAt).getTime()) : null;

                  return (
                    <div key={entry.id} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 border', s.bg, s.border)}>
                          <Icon size={15} className={s.text} />
                        </div>
                        {!isLast && <div className="w-px flex-1 bg-border my-1.5" />}
                      </div>
                      <div className={cn('flex flex-col gap-0.5 pt-1', isLast ? 'pb-0' : 'pb-4')}>
                        <p className={cn('text-xs font-semibold leading-none', s.text)}>{s.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {new Date(entry.createdAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {entry.changedBy && <span className="ml-1">· {entry.changedBy}</span>}
                        </p>
                        {duration && <p className="text-[10px] text-muted-foreground/60 italic">{duration} since previous</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">No history available.</p>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Details</p>
            <InfoGroup>
              <InfoRow
                icon={data.paymentMethod === 'cash' ? Banknote : CreditCard}
                label="Payment"
                value={data.paymentMethod === 'cash' ? 'Cash' : 'Card'}
              />
              <InfoRow
                icon={data.source === 'pos' ? Monitor : Smartphone}
                label="Source"
                value={data.source === 'pos' ? 'POS' : 'Mobile'}
              />
              <InfoRow
                icon={CalendarDays}
                label="Created"
                value={new Date(data.createdAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              />
              {data.customerId && <InfoRow icon={User} label="Customer ID" value={data.customerId} copyable />}
              <InfoRow icon={User} label="Staff ID" value={data.createdBy} copyable />
              <InfoRow icon={MapPin} label="Location ID" value={data.locationId} copyable />
            </InfoGroup>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Email actions removed until the API supports them — they were console.log stubs. */}
          <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
            <Eye />
            View / Download Receipt
          </Button>
        </div>
      </div>

      {showReceipt && <ReceiptModal orderId={data.id} apiBase={API_PREFIX} onClose={() => setShowReceipt(false)} />}
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  isOpen: controlledOpen,
  onOpenChange,
}: {
  order: Order;
  isOpen?: boolean;
  onOpenChange?: (id: string, open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function toggle() {
    const next = !open;
    setInternalOpen(next);
    onOpenChange?.(order.id, next);
  }

  return (
    <>
      <tr
        id={`order-row-${order.id}`}
        className={cn(
          'group border-b border-border/50 transition-colors hover:bg-surface-offset cursor-pointer',
          open && 'bg-surface-offset',
          !open && 'last:border-0',
        )}
        onClick={toggle}
      >
        <td className="px-3 md:px-5 py-4 w-8">
          <ChevronRight size={13} className={cn('text-muted-foreground transition-transform duration-150 shrink-0', open && 'rotate-90')} />
        </td>
        <td className="px-3 md:px-5 py-4">
          <span className="font-mono text-xs font-medium text-muted-foreground">#{order.id.slice(0, 8)}</span>
        </td>
        <td className="hidden md:table-cell px-5 py-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {order.source === 'pos' ? <Monitor size={12} className="shrink-0" /> : <Smartphone size={12} className="shrink-0" />}
            {order.source === 'pos' ? 'POS' : 'Mobile'}
          </span>
        </td>
        <td className="hidden md:table-cell px-5 py-4 max-w-xs">
          <span className="text-xs text-muted-foreground truncate block">{order.notes ?? '—'}</span>
        </td>
        <td className="px-3 md:px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <StatusBadge order={order} stopProp />
        </td>
        <td className="px-3 md:px-5 py-4 text-right">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {order.totalAmount != null ? `£${Number(order.totalAmount).toFixed(2)}` : '—'}
          </span>
        </td>
        <td className="px-3 md:px-5 py-4 pr-4 md:pr-6 text-right">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/50">
          <td colSpan={7} className="px-4 md:px-8 pt-3 pb-5">
            <OrderDetailPanel orderId={order.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { locationId } = useWorkspaceStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  // Broad query for stats + live tickets
  const { data: allData } = useQuery({
    queryKey: ['orders-all', locationId],
    queryFn: () => getOrders({ limit: 200, locationId: locationId ?? undefined }),
    refetchInterval: 30_000,
  });

  const allOrders = useMemo(() => allData?.data ?? [], [allData?.data]);

  const today = new Date().toDateString();
  const todayOrders = useMemo(() => allOrders.filter((o) => new Date(o.createdAt).toDateString() === today), [allOrders, today]);

  const totalOrders = todayOrders.length;
  const revenue = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const liveCount = allOrders.filter((o) => LIVE_STATUSES.includes(o.status)).length;
  const cancelledCount = todayOrders.filter((o) => o.status === 'cancelled').length;

  const week7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toDateString();
      const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const dayOrders = allOrders.filter((o) => new Date(o.createdAt).toDateString() === key);
      return {
        dateLabel,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + Number(o.totalAmount), 0),
        live: dayOrders.filter((o) => LIVE_STATUSES.includes(o.status)).length,
        cancelled: dayOrders.filter((o) => o.status === 'cancelled').length,
      };
    });
  }, [allOrders]);

  const liveTickets = useMemo(
    () => allOrders.filter((o) => LIVE_STATUSES.includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allOrders],
  );

  // Paginated query for table
  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, statusFilter, locationId],
    queryFn: () =>
      getOrders({
        page,
        limit: LIMIT,
        locationId: locationId ?? undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const orders = useMemo(() => data?.data ?? [], [data?.data]);
  const totalPages = data?.pages ?? 1;

  // Deep link: /orders?order=<id> (e.g. from a customer's order list) opens the
  // page with that order expanded and scrolled into view.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order');
    if (!id) return;
    const timer = window.setTimeout(() => {
      setExpandedOrderId(id);
      setActiveTicket(id);
      setPendingScrollId(id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Scroll to the deep-linked row once it renders (i.e. once orders have loaded).
  useEffect(() => {
    if (!pendingScrollId) return;
    const el = document.getElementById(`order-row-${pendingScrollId}`);
    if (el) {
      const frame = window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPendingScrollId(null);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [orders, pendingScrollId]);

  function handleTicketClick(id: string) {
    setActiveTicket((prev) => (prev === id ? null : id));
    setExpandedOrderId(id);
    setTimeout(() => {
      document.getElementById(`order-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  function handleRowOpenChange(id: string, open: boolean) {
    setExpandedOrderId(open ? id : null);
  }

  return (
    <PageLayout
      eyebrow="Operations"
      title="Orders"
      headerBorder={false}
      headerSlot={
        <SegmentedControl
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
          <StatCard
            label="Orders today"
            value={String(totalOrders)}
            icon="ShoppingBag"
            iconVariant="primary"
            footer={{
              type: 'bars',
              values: week7.map((d) => d.orders),
              labels: week7.map((d) => String(d.orders)),
              titleLabels: week7.map((d) => `Orders (${d.dateLabel})`),
            }}
          />
          <StatCard
            label="Revenue"
            value={`£${revenue.toFixed(0)}`}
            icon="Wallet"
            iconVariant="success"
            footer={{
              type: 'bars',
              values: week7.map((d) => d.revenue),
              labels: week7.map((d) => `£${d.revenue.toFixed(0)}`),
              titleLabels: week7.map((d) => `Revenue (${d.dateLabel})`),
            }}
          />
          <StatCard label="Open / Preparing" value={String(liveCount)} icon="Tag" iconVariant="gold" />
          <StatCard label="Cancelled" value={String(cancelledCount)} icon="Receipt" iconVariant="info" />
        </div>

        {/* Live tickets */}
        {liveTickets.length > 0 && (
          <div className="shrink-0">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Live tickets · {liveTickets.length}
            </p>
            <div className="flex gap-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {liveTickets.map((order) => (
                <LiveTicket key={order.id} order={order} active={activeTicket === order.id} onClick={() => handleTicketClick(order.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Orders table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div>
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className="px-3 md:px-5 py-3.5 w-8" />
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Order
                  </th>
                  <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Source
                  </th>
                  <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Notes
                  </th>
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Total
                  </th>
                  <th className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className={cn('px-3 md:px-5 py-4', (j === 2 || j === 3) && 'hidden md:table-cell')}>
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-24">
                      <EmptyState
                        icon={ShoppingBag}
                        title="No orders found"
                        description={
                          statusFilter !== 'all'
                            ? `No ${statusFilter} orders${locationId ? ' at this location' : ''}.`
                            : 'Orders will appear here once created.'
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <OrderRow key={order.id} order={order} isOpen={expandedOrderId === order.id} onOpenChange={handleRowOpenChange} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0">
              <p className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages} · {(data?.total ?? 0).toLocaleString()} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-7 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-surface-offset transition-colors disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
