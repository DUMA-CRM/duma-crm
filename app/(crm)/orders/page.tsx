'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, ChevronDown, CreditCard, Monitor, ShoppingBag, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { type Order, type OrderDetail, type OrderStatus, getOrder, getOrders, updateOrderStatus } from '@/lib/api/orders.service';
import { cn } from '@/lib/utils/cn';
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

// ── Status badge + inline picker ─────────────────────────────────────────────

function StatusBadge({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const s = STATUS_CONFIG[order.status];
  const nexts = NEXT_STATUSES[order.status];

  const { mutate, isPending } = useMutation({
    mutationFn: (status: OrderStatus) => updateOrderStatus(order.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', order.id] });
      setOpen(false);
    },
  });

  if (nexts.length === 0) {
    return (
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
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
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

// ── Order detail (expanded row) ───────────────────────────────────────────────

function OrderDetail({ orderId }: { orderId: string }) {
  const { data, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-2 py-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-8">
      {/* Items list */}
      <div className="flex-1 flex flex-col gap-1.5">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-foreground">
                <span className="text-muted-foreground mr-1.5">{item.quantity}x</span>
                {item.name}
              </span>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.modifiers.map((m, i) => (
                    <span key={i} className="text-[11px] text-muted-foreground bg-card border border-border rounded-md px-1.5 py-px">
                      {m.name}
                      {parseFloat(m.priceAdjust) !== 0 && (
                        <span className="text-primary ml-1">+£{parseFloat(m.priceAdjust).toFixed(2)}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-xs font-semibold text-foreground tabular-nums shrink-0">£{parseFloat(item.subtotal).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Right meta column */}
      <div className="flex flex-col gap-2 items-end shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card text-[11px] font-medium text-muted-foreground">
          {data.paymentMethod === 'cash' ? <Banknote size={11} /> : <CreditCard size={11} />}
          {data.paymentMethod === 'cash' ? 'Cash' : 'Card'}
        </span>
        {data.notes && <p className="text-[11px] text-muted-foreground italic max-w-48 text-right">{data.notes}</p>}
      </div>
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        className={cn(
          'group border-b border-border/50 transition-colors hover:bg-surface-offset cursor-pointer',
          open && 'bg-surface-offset',
          !open && 'last:border-0',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-5 py-4 w-8">
          <ChevronDown size={13} className={cn('text-muted-foreground transition-transform duration-150 shrink-0', open && 'rotate-180')} />
        </td>
        <td className="px-5 py-4">
          <span className="font-mono text-xs font-medium text-muted-foreground">#{order.id.slice(0, 8)}</span>
        </td>
        <td className="px-5 py-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {order.source === 'pos' ? <Monitor size={12} className="shrink-0" /> : <Smartphone size={12} className="shrink-0" />}
            {order.source === 'pos' ? 'POS' : 'Mobile'}
          </span>
        </td>
        <td className="px-5 py-4 max-w-xs">
          <span className="text-xs text-muted-foreground truncate block">{order.notes ?? '—'}</span>
        </td>
        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
          <StatusBadge order={order} />
        </td>
        <td className="px-5 py-4 text-right">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {order.totalAmount != null ? `£${Number(order.totalAmount).toFixed(2)}` : '—'}
          </span>
        </td>
        <td className="px-5 py-4 pr-6 text-right">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-border/50 bg-surface-offset/50">
          <td colSpan={7} className="px-8 pt-3 pb-4">
            <OrderDetail orderId={order.id} />
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

  const orders = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <PageLayout
      eyebrow="Operations"
      title="Orders"
      fullHeight
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
      <div className="flex flex-col h-full gap-4">
        <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3.5 w-8" />
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Source</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notes</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</th>
                  <th className="px-5 py-3.5 pr-6 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
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
                  orders.map((order) => <OrderRow key={order.id} order={order} />)
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
