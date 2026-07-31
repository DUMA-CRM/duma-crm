'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
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
  Loader2,
  Mail,
  MapPin,
  Monitor,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Popover } from 'radix-ui';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { SendEmailModal } from '@/components/email/SendEmailModal';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Modal } from '@/components/shared/Modal';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { API_PREFIX } from '@/lib/api/client';
import {
  type Order,
  type OrderDetail as OrderDetailType,
  type OrderSource,
  type OrderStatus,
  type RefundReason,
  type VoidReason,
  createRefund,
  getOrder,
  getOrders,
  getRefundOptions,
  updateOrderStatus,
} from '@/lib/api/orders.service';
import { getStaff } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 50;

const STATUS_FILTERS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

type StatusFilter = 'all' | OrderStatus;
type SourceFilter = 'all' | OrderSource;
type PaymentFilter = 'all' | 'cash' | 'card';
type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

const SOURCE_FILTERS: SelectOption[] = [
  { value: 'all', label: 'All sources' },
  { value: 'pos', label: 'POS' },
  { value: 'mobile', label: 'Mobile' },
];

const PAYMENT_FILTERS: SelectOption[] = [
  { value: 'all', label: 'All payments' },
  { value: 'card', label: 'Card' },
  { value: 'cash', label: 'Cash' },
];

const DATE_FILTERS: SelectOption[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom range' },
];

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

const VOID_REASON_OPTIONS: SelectOption[] = [
  { value: 'customer_request', label: 'Customer requested cancellation' },
  { value: 'duplicate', label: 'Duplicate order' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'item_unavailable', label: 'Item unavailable' },
  { value: 'staff_error', label: 'Staff entry error' },
  { value: 'other', label: 'Other' },
];

const REFUND_REASON_OPTIONS: SelectOption[] = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'item_issue', label: 'Item issue' },
  { value: 'service_issue', label: 'Service issue' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'pricing_error', label: 'Pricing error' },
  { value: 'other', label: 'Other' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function dateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function datesForPreset(preset: Exclude<DatePreset, 'all' | 'custom'>) {
  const end = new Date();
  const start = new Date();
  if (preset === '7d') start.setDate(start.getDate() - 6);
  if (preset === '30d') start.setDate(start.getDate() - 29);
  return { from: dateInputValue(start), to: dateInputValue(end) };
}

function startOfLocalDay(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfLocalDay(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function optionLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 pl-2.5 pr-1.5 text-xs font-medium text-primary">
      <span className="max-w-52 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-5 items-center justify-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

// ── Status badge + inline picker ─────────────────────────────────────────────

function StatusBadge({ order, stopProp = false }: { order: Order; stopProp?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState<VoidReason>('customer_request');
  const [voidNotes, setVoidNotes] = useState('');
  const s = STATUS_CONFIG[order.status];
  const nexts = NEXT_STATUSES[order.status];

  const { mutate, isPending } = useMutation({
    mutationFn: ({ status, details }: { status: OrderStatus; details?: { voidReason: VoidReason; voidNotes?: string } }) =>
      updateOrderStatus(order.id, status, details),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['orders-all'] });
      qc.invalidateQueries({ queryKey: ['order', order.id] });
      qc.invalidateQueries({ queryKey: ['inventory-overview'] });
      qc.invalidateQueries({ queryKey: ['location-stock'] });
      if (updated.inventoryWarnings?.length) {
        toast(
          'error',
          `Order completed with ${updated.inventoryWarnings.length} inventory shortfall${updated.inventoryWarnings.length === 1 ? '' : 's'}.`,
        );
      }
      setOpen(false);
      setVoidOpen(false);
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
    <>
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
                    if (next === 'cancelled') {
                      setOpen(false);
                      setVoidOpen(true);
                    } else {
                      mutate({ status: next });
                    }
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
    {voidOpen && (
      <Modal title="Void order" onClose={() => setVoidOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Choose the reason for cancelling order #{order.id.slice(0, 8).toUpperCase()}.</p>
          <Select value={voidReason} onValueChange={(value) => setVoidReason(value as VoidReason)} options={VOID_REASON_OPTIONS} ariaLabel="Void reason" className="w-full" />
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes</span>
            <textarea value={voidNotes} onChange={(event) => setVoidNotes(event.target.value)} maxLength={500} placeholder="Optional context for the audit trail…" className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVoidOpen(false)} disabled={isPending} className="flex-1">Keep order</Button>
            <Button variant="destructive" onClick={() => mutate({ status: 'cancelled', details: { voidReason, voidNotes: voidNotes.trim() || undefined } })} disabled={isPending} className="flex-1">
              {isPending ? 'Voiding…' : 'Void order'}
            </Button>
          </div>
        </div>
      </Modal>
    )}
    </>
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

function RefundModal({ order, refundable, onClose }: { order: OrderDetailType; refundable: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: options, isLoading } = useQuery({ queryKey: ['refund-options', order.id], queryFn: () => getRefundOptions(order.id) });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<RefundReason>('customer_request');
  const [notes, setNotes] = useState('');
  const amountNumber = (options?.items ?? []).reduce((total, item) => {
    total += item.base.unitAmounts.slice(0, quantities[`item:${item.id}`] ?? 0).reduce((sum, value) => sum + Number(value), 0);
    for (const modifier of item.modifiers) total += modifier.unitAmounts.slice(0, quantities[`modifier:${modifier.id}`] ?? 0).reduce((sum, value) => sum + Number(value), 0);
    return total;
  }, 0);
  const lines = (options?.items ?? []).flatMap((item) => [
    ...((quantities[`item:${item.id}`] ?? 0) > 0 ? [{ orderItemId: item.id, quantity: quantities[`item:${item.id}`] }] : []),
    ...item.modifiers.flatMap((modifier) => (quantities[`modifier:${modifier.id}`] ?? 0) > 0
      ? [{ orderItemId: item.id, orderItemModifierId: modifier.id, quantity: quantities[`modifier:${modifier.id}`] }]
      : []),
  ]);
  function setQuantity(key: string, value: number, max: number) {
    setQuantities((current) => ({ ...current, [key]: Math.max(0, Math.min(max, Math.floor(value || 0))) }));
  }
  function toggleWholeItem(item: NonNullable<typeof options>['items'][number]) {
    setQuantities((current) => {
      const next = { ...current };
      const selecting = !(current[`item:${item.id}`] > 0);
      next[`item:${item.id}`] = selecting ? item.base.remainingQuantity : 0;
      item.modifiers.forEach((modifier) => { next[`modifier:${modifier.id}`] = selecting ? modifier.remainingQuantity : 0; });
      return next;
    });
  }
  const refund = useMutation({
    mutationFn: () => createRefund(order.id, { lines, reason, notes: notes.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['customer-visits'] });
      toast('success', `${Math.abs(amountNumber - refundable) < 0.001 ? 'Full' : 'Partial'} refund recorded.`);
      onClose();
    },
    onError: (error) => toast('error', error.message || 'Could not record the refund.'),
  });
  return (
    <Modal title="Record refund" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-offset p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Order total</span><span>£{Number(order.totalAmount).toFixed(2)}</span></div>
          <div className="mt-1 flex justify-between font-semibold"><span>Available to refund</span><span>£{refundable.toFixed(2)}</span></div>
        </div>
        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {isLoading && <p className="text-sm text-muted-foreground">Loading refundable items…</p>}
          {options?.items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-w-0 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={(quantities[`item:${item.id}`] ?? 0) > 0} disabled={item.base.remainingQuantity === 0} onChange={() => toggleWholeItem(item)} /> <span className="truncate">{item.name}</span></label>
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Base qty</span><input aria-label={`${item.name} refund quantity`} className="h-8 w-16 rounded-md border border-border bg-background px-2 text-sm" type="number" min={0} max={item.base.remainingQuantity} value={quantities[`item:${item.id}`] ?? 0} onChange={(event) => setQuantity(`item:${item.id}`, Number(event.target.value), item.base.remainingQuantity)} /></div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Up to {item.base.remainingQuantity} · £{Number(item.base.remainingAmount).toFixed(2)} paid value</p>
              {item.modifiers.length > 0 && <div className="mt-3 space-y-2 border-t border-border pt-2">{item.modifiers.map((modifier) => (
                <div key={modifier.id} className="flex items-center justify-between gap-3 pl-4">
                  <label className="flex min-w-0 items-center gap-2 text-xs"><input type="checkbox" checked={(quantities[`modifier:${modifier.id}`] ?? 0) > 0} disabled={modifier.remainingQuantity === 0} onChange={() => setQuantity(`modifier:${modifier.id}`, (quantities[`modifier:${modifier.id}`] ?? 0) > 0 ? 0 : modifier.remainingQuantity, modifier.remainingQuantity)} /> <span className="truncate">+ {modifier.name} (£{Number(modifier.remainingAmount).toFixed(2)})</span></label>
                  <input aria-label={`${modifier.name} refund quantity`} className="h-7 w-16 rounded-md border border-border bg-background px-2 text-xs" type="number" min={0} max={modifier.remainingQuantity} value={quantities[`modifier:${modifier.id}`] ?? 0} onChange={(event) => setQuantity(`modifier:${modifier.id}`, Number(event.target.value), modifier.remainingQuantity)} />
                </div>
              ))}</div>}
            </div>
          ))}
        </div>
        <div className="flex justify-between rounded-xl bg-primary/8 px-3 py-2 text-sm font-bold"><span>Refund total</span><span>£{amountNumber.toFixed(2)}</span></div>
        <Select value={reason} onValueChange={(value) => setReason(value as RefundReason)} options={REFUND_REASON_OPTIONS} ariaLabel="Refund reason" className="w-full" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="How and where the money was returned…" className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
        <p className="text-xs text-muted-foreground">The refund is recorded in the internal ledger. Payment execution is a placeholder until a terminal or provider is connected.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={refund.isPending} className="flex-1">Cancel</Button>
          <Button onClick={() => refund.mutate()} disabled={refund.isPending || lines.length === 0 || amountNumber <= 0 || amountNumber > refundable + 0.001} className="flex-1">
            {refund.isPending ? 'Recording…' : 'Record refund'}
          </Button>
        </div>
      </div>
    </Modal>
  );
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
  const [showEmail, setShowEmail] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

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
  const refundedAmount = (data.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);
  const refundableAmount = Math.max(0, Number(data.totalAmount) - refundedAmount);

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
                  {item.refundStatus && item.refundStatus !== 'none' && <span className="ml-1 text-[9px] font-bold uppercase text-destructive">{item.refundStatus.replace('_', ' ')}</span>}
                </span>
                <span className="text-[11px] font-semibold tabular-nums shrink-0">£{parseFloat(item.subtotal).toFixed(2)}</span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="pl-4 flex flex-col gap-0.5 mt-0.5">
                  {item.modifiers.map((m, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">+ {m.name}</span>
                      {m.refundStatus && m.refundStatus !== 'none' && <span className="text-[9px] font-bold uppercase text-destructive">{m.refundStatus.replace('_', ' ')}</span>}
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
          {refundedAmount > 0 && (
            <div className="flex justify-between text-[11px] font-semibold text-destructive">
              <span>Refunded</span>
              <span className="tabular-nums">−£{refundedAmount.toFixed(2)}</span>
            </div>
          )}
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
              {data.voidReason && <InfoRow icon={XCircle} label="Void reason" value={optionLabel(VOID_REASON_OPTIONS, data.voidReason)} />}
            </InfoGroup>
          </div>
        </div>

        {(data.refunds?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Refund history</p>
            <div className="space-y-2">
              {data.refunds!.map((refund) => (
                <div key={refund.id} className="flex items-center justify-between rounded-xl border border-border bg-surface-offset px-3 py-2 text-xs">
                  <div><p className="font-semibold text-foreground">{optionLabel(REFUND_REASON_OPTIONS, refund.reason)}</p><p className="text-muted-foreground">{new Date(refund.createdAt).toLocaleString('en-GB')} · {refund.kind} · internal ledger</p>{refund.lines?.map((line) => <p key={line.id} className="mt-0.5 text-muted-foreground">{line.quantity}× {line.name} · £{Number(line.amount).toFixed(2)}</p>)}</div>
                  <span className="font-bold text-destructive">−£{Number(refund.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {data.customerId && (
            <Button variant="outline" size="sm" onClick={() => setShowEmail(true)}>
              <Mail />
              Send email
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>
            <Eye />
            View / Download Receipt
          </Button>
          {data.status === 'done' && refundableAmount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowRefund(true)} className="text-destructive">
              <Banknote />
              Refund
            </Button>
          )}
        </div>
      </div>

      {showReceipt && <ReceiptModal orderId={data.id} apiBase={API_PREFIX} onClose={() => setShowReceipt(false)} />}
      {showRefund && <RefundModal order={data} refundable={refundableAmount} onClose={() => setShowRefund(false)} />}
      {showEmail && data.customerId && (
        <SendEmailModal
          customerId={data.customerId}
          orderId={data.id}
          recipientLabel={`Customer for order #${data.id.slice(0, 8).toUpperCase()}`}
          onClose={() => setShowEmail(false)}
        />
      )}
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

function OrdersPageContent() {
  const searchParams = useSearchParams();
  const { locationId, tenantId } = useWorkspaceStore();
  const requestedStatus = searchParams.get('status');
  const requestedSource = searchParams.get('source');
  const requestedPayment = searchParams.get('paymentMethod');
  const initialFrom = searchParams.get('from') ?? '';
  const initialTo = searchParams.get('to') ?? '';
  const requestedDatePreset = searchParams.get('range') as DatePreset | null;
  const validDatePreset =
    requestedDatePreset && DATE_FILTERS.some((option) => option.value === requestedDatePreset) ? requestedDatePreset : null;
  const deepLinkedOrderId = searchParams.get('order');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    requestedStatus && STATUS_FILTERS.some((option) => option.value === requestedStatus) ? (requestedStatus as StatusFilter) : 'all',
  );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    requestedSource && SOURCE_FILTERS.some((option) => option.value === requestedSource) ? (requestedSource as SourceFilter) : 'all',
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>(
    requestedPayment && PAYMENT_FILTERS.some((option) => option.value === requestedPayment) ? (requestedPayment as PaymentFilter) : 'all',
  );
  const [createdBy, setCreatedBy] = useState(searchParams.get('createdBy') ?? 'all');
  const [customerSearch, setCustomerSearch] = useState(
    searchParams.get('customer') ?? searchParams.get('customerId') ?? searchParams.get('customerPhone') ?? '',
  );
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState(customerSearch);
  const [datePreset, setDatePreset] = useState<DatePreset>(validDatePreset ?? (initialFrom || initialTo ? 'custom' : 'all'));
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [page, setPage] = useState(() => initialPage(searchParams.get('page')));
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedCustomerSearch(customerSearch.trim()), customerSearch ? 400 : 0);
    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

  const invalidDateRange = Boolean(from && to && from > to);
  const hasFilters =
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    paymentFilter !== 'all' ||
    createdBy !== 'all' ||
    !!debouncedCustomerSearch ||
    datePreset !== 'all' ||
    !!from ||
    !!to;
  const advancedFilterCount = Number(createdBy !== 'all') + Number(datePreset === 'custom' && (!!from || !!to));

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const staffOptions = useMemo<SelectOption[]>(() => {
    const options = staff
      .map((member) => ({ value: member.userId, label: member.name || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (createdBy !== 'all' && !options.some((option) => option.value === createdBy)) {
      options.unshift({ value: createdBy, label: createdBy });
    }
    return [{ value: 'all', label: 'All staff' }, ...options];
  }, [createdBy, staff]);

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
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['orders', page, statusFilter, sourceFilter, paymentFilter, createdBy, debouncedCustomerSearch, from, to, locationId],
    queryFn: () =>
      getOrders({
        page,
        limit: LIMIT,
        locationId: locationId ?? undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        paymentMethod: paymentFilter === 'all' ? undefined : paymentFilter,
        createdBy: createdBy === 'all' ? undefined : createdBy,
        customerId: debouncedCustomerSearch && isUuid(debouncedCustomerSearch) ? debouncedCustomerSearch : undefined,
        customerPhone: debouncedCustomerSearch && !isUuid(debouncedCustomerSearch) ? debouncedCustomerSearch : undefined,
        from: from ? startOfLocalDay(from) : undefined,
        to: to ? endOfLocalDay(to) : undefined,
      }),
    enabled: !invalidDateRange,
    placeholderData: (previousData) => previousData,
  });

  const orders = useMemo(() => data?.data ?? [], [data?.data]);
  const totalPages = data?.pages ?? 1;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    ['page', 'status', 'source', 'paymentMethod', 'createdBy', 'customer', 'customerId', 'customerPhone', 'range', 'from', 'to'].forEach(
      (key) => params.delete(key),
    );
    if (page > 1) params.set('page', String(page));
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
    if (createdBy !== 'all') params.set('createdBy', createdBy);
    if (debouncedCustomerSearch) params.set('customer', debouncedCustomerSearch);
    if (datePreset !== 'all') params.set('range', datePreset);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
  }, [createdBy, datePreset, debouncedCustomerSearch, from, page, paymentFilter, sourceFilter, statusFilter, to]);

  // Deep link: /orders?order=<id> (e.g. from a customer's order list) opens the
  // page with that order expanded and scrolled into view.
  useEffect(() => {
    const id = deepLinkedOrderId;
    if (!id) return;
    const timer = window.setTimeout(() => {
      setExpandedOrderId(id);
      setActiveTicket(id);
      setPendingScrollId(id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deepLinkedOrderId]);

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

  function resetPage() {
    setPage(1);
  }

  function changeDatePreset(value: string) {
    const next = value as DatePreset;
    setDatePreset(next);
    resetPage();
    if (next === 'all') {
      setFrom('');
      setTo('');
    } else if (next === 'custom') {
      window.setTimeout(() => setAdvancedOpen(true), 0);
    } else {
      const dates = datesForPreset(next);
      setFrom(dates.from);
      setTo(dates.to);
    }
  }

  function clearFilters() {
    setStatusFilter('all');
    setSourceFilter('all');
    setPaymentFilter('all');
    setCreatedBy('all');
    setCustomerSearch('');
    setDebouncedCustomerSearch('');
    setDatePreset('all');
    setFrom('');
    setTo('');
    resetPage();
  }

  const filterBar = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-sm">
          <Input
            type="search"
            value={customerSearch}
            onChange={(event) => {
              setCustomerSearch(event.target.value);
              resetPage();
            }}
            aria-label="Find orders by customer ID or phone number"
            placeholder="Customer ID or phone…"
            leftIcon={<Search size={14} />}
            rightAction={
              customerSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearch('');
                    setDebouncedCustomerSearch('');
                    resetPage();
                  }}
                  aria-label="Clear customer ID search"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
            className="bg-background border-border"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter);
            resetPage();
          }}
          options={STATUS_FILTERS}
          ariaLabel="Filter orders by status"
          className="w-[calc(50%-0.25rem)] sm:w-40"
        />
        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value as SourceFilter);
            resetPage();
          }}
          options={SOURCE_FILTERS}
          ariaLabel="Filter orders by source"
          className="w-[calc(50%-0.25rem)] sm:w-36"
        />
        <Select
          value={paymentFilter}
          onValueChange={(value) => {
            setPaymentFilter(value as PaymentFilter);
            resetPage();
          }}
          options={PAYMENT_FILTERS}
          ariaLabel="Filter orders by payment method"
          className="w-[calc(50%-0.25rem)] sm:w-40"
        />
        <Select
          value={datePreset}
          onValueChange={changeDatePreset}
          options={DATE_FILTERS}
          ariaLabel="Filter orders by date range"
          icon={<CalendarDays />}
          className="w-[calc(50%-0.25rem)] sm:w-40"
        />

        <Popover.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Popover.Trigger asChild>
            <Button variant="outline" className="w-[calc(50%-0.25rem)] sm:w-auto" aria-label="Open more order filters">
              <SlidersHorizontal data-icon="inline-start" />
              More filters
              {advancedFilterCount > 0 && (
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {advancedFilterCount}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-[90] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">More filters</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Narrow results by staff member or an exact date range.</p>
                </div>
                <Popover.Close asChild>
                  <button
                    type="button"
                    aria-label="Close filters"
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </Popover.Close>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Created by</label>
                  <Select
                    value={createdBy}
                    onValueChange={(value) => {
                      setCreatedBy(value);
                      resetPage();
                    }}
                    options={staffOptions}
                    ariaLabel="Filter by staff member"
                    icon={<User />}
                    className="w-full"
                  />
                  {!tenantId && <p className="text-xs text-muted-foreground">Select a workspace to load staff names.</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Custom dates</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Orders from date"
                      className="bg-background border-border px-2"
                    />
                    <Input
                      type="date"
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setDatePreset('custom');
                        resetPage();
                      }}
                      aria-label="Orders to date"
                      className="bg-background border-border px-2"
                    />
                  </div>
                  {invalidDateRange && (
                    <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle size={12} aria-hidden="true" /> The end date must be on or after the start date.
                    </p>
                  )}
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <span
          className="ml-auto flex min-w-24 items-center justify-end gap-1.5 text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {isFetching && !isLoading && <Loader2 size={12} className="animate-spin" aria-label="Updating orders" />}
          {data ? `${data.total.toLocaleString()} orders` : ''}
        </span>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {statusFilter !== 'all' && (
            <FilterChip
              label={`Status: ${optionLabel(STATUS_FILTERS, statusFilter)}`}
              onRemove={() => {
                setStatusFilter('all');
                resetPage();
              }}
            />
          )}
          {sourceFilter !== 'all' && (
            <FilterChip
              label={`Source: ${optionLabel(SOURCE_FILTERS, sourceFilter)}`}
              onRemove={() => {
                setSourceFilter('all');
                resetPage();
              }}
            />
          )}
          {paymentFilter !== 'all' && (
            <FilterChip
              label={`Payment: ${optionLabel(PAYMENT_FILTERS, paymentFilter)}`}
              onRemove={() => {
                setPaymentFilter('all');
                resetPage();
              }}
            />
          )}
          {createdBy !== 'all' && (
            <FilterChip
              label={`Created by: ${optionLabel(staffOptions, createdBy)}`}
              onRemove={() => {
                setCreatedBy('all');
                resetPage();
              }}
            />
          )}
          {debouncedCustomerSearch && (
            <FilterChip
              label={`${isUuid(debouncedCustomerSearch) ? 'Customer ID' : 'Phone'}: ${debouncedCustomerSearch}`}
              onRemove={() => {
                setCustomerSearch('');
                setDebouncedCustomerSearch('');
                resetPage();
              }}
            />
          )}
          {datePreset !== 'all' && (
            <FilterChip
              label={datePreset === 'custom' ? `Date: ${from || 'Any'} – ${to || 'Any'}` : `Date: ${optionLabel(DATE_FILTERS, datePreset)}`}
              onRemove={() => {
                setDatePreset('all');
                setFrom('');
                setTo('');
                resetPage();
              }}
            />
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );

  return (
    <PageLayout eyebrow="Operations" title="Orders" headerBorder headerSlot={filterBar}>
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
            <DataTable className="w-full text-sm border-collapse">
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
                {invalidDateRange ? (
                  <tr>
                    <td colSpan={7} className="py-24">
                      <EmptyState
                        icon={CalendarDays}
                        title="Check the date range"
                        description="The end date must be on or after the start date."
                      />
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={7} className="py-24">
                      <div className="flex flex-col items-center gap-3 px-6 text-center">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                          <AlertCircle size={22} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Couldn’t load orders</p>
                          <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                          Try again
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : isLoading ? (
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
                        description={hasFilters ? 'Try adjusting or clearing your filters.' : 'Orders will appear here once created.'}
                      />
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <OrderRow key={order.id} order={order} isOpen={expandedOrderId === order.id} onOpenChange={handleRowOpenChange} />
                  ))
                )}
              </tbody>
            </DataTable>
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

function OrdersPageFallback() {
  return (
    <PageLayout eyebrow="Operations" title="Orders" headerBorder>
      <div className="space-y-4">
        <div className="h-9 w-full max-w-4xl animate-pulse rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </PageLayout>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersPageFallback />}>
      <OrdersPageContent />
    </Suspense>
  );
}
