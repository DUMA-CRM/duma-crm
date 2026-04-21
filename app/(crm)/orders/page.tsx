'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ShoppingBag, Monitor, Smartphone } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { EmptyState } from '@/components/shared/EmptyState';
import { getOrders, updateOrderStatus, type Order, type OrderStatus } from '@/lib/api/orders.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils/cn';

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

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-muted/30">
      <td className="px-4 py-3.5">
        <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {order.source === 'pos' ? <Monitor size={12} className="shrink-0" /> : <Smartphone size={12} className="shrink-0" />}
          {order.source === 'pos' ? 'POS' : 'Mobile'}
        </span>
      </td>
      <td className="px-4 py-3.5 max-w-xs">
        <span className="text-xs text-muted-foreground truncate block">{order.notes ?? '—'}</span>
      </td>
      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
        <StatusBadge order={order} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {order.total_amount != null ? `£${(order.total_amount / 100).toFixed(2)}` : '—'}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right pr-5">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(order.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </td>
    </tr>
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
      <div className="flex flex-col h-full -m-8">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Source</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notes</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</th>
                <th className="px-4 py-3 pr-5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24">
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-border shrink-0 bg-card">
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {totalPages} · {(data?.total ?? 0).toLocaleString()} orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
