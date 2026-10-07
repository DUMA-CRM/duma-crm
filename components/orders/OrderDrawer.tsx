'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { SendEmailModal } from '@/components/email/SendEmailModal';
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Receipt,
  RotateCcw,
  Timer,
  User,
  XCircle,
} from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { LoadingState } from '@/components/shared/Skeleton';
import { TONE_INK } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { API_PREFIX } from '@/lib/modules/core/client';
import { type OrderDetail, getOrder } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import {
  type ActivityEvent,
  STATUS_EVENT,
  formatGap,
  itemCount,
  nextStep,
  orderActivity,
  orderCode,
  paymentSummary,
  turnaround,
} from '@/lib/utils/orders-list';
import { useAuthStore } from '@/stores/authStore';

import { RefundBody, RefundFooter, useRefundDraft } from './RefundPanel';
import { StatusMenu, useStatusChange } from './StatusMenu';
import { REFUND_REASON_OPTIONS, SOURCE_META, STATUS_META, VOID_REASON_OPTIONS, optionLabel } from './orderMeta';

/** Stands in for the order while it loads, so the refund hook can run unconditionally. */
const PLACEHOLDER_ORDER = {
  id: '',
  locationId: '',
  createdBy: null,
  status: 'pending',
  source: 'pos',
  totalAmount: '0',
  paymentMethod: null,
  items: [],
  createdAt: '',
} as OrderDetail;

/**
 * One order, beside the list it came from. Read top to bottom: what was
 * ordered and what it came to, how it was paid and by whom, then what happened
 * to it. The next step (Mark ready, Complete) is the primary action; receipt,
 * email and refund sit beside it. ↑/↓ steps through the list without closing.
 */
export function OrderDrawer({
  orderId,
  staffName,
  locationName,
  onClose,
  onPrev,
  onNext,
}: {
  orderId: string;
  staffName: (userId: string | null | undefined) => string | null;
  locationName: (locationId: string) => string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const money = useWorkspaceMoney();
  const canRefund = hasCapability(
    useAuthStore((state) => state.capabilities),
    'orders:refund',
  );
  const [showReceipt, setShowReceipt] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const { data, isPending, isError, refetch } = useQuery<OrderDetail>({
    queryKey: moduleQueryKeys.ordering.key('order', orderId),
    queryFn: () => getOrder(orderId),
  });
  const advance = useStatusChange({ id: orderId });

  // ↑/↓ step through the list, the way a mail client does — unless a field or
  // another dialog has the keyboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      if (event.key === 'ArrowUp' && onPrev) {
        event.preventDefault();
        onPrev();
      } else if (event.key === 'ArrowDown' && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onPrev, onNext]);

  // The refund lives in this drawer: the hook runs always (hooks can't be
  // conditional) and only fetches what's refundable once refund mode opens.
  const refundedSoFar = (data?.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);
  const refundableNow = data ? Math.max(0, Number(data.totalAmount) - refundedSoFar) : 0;
  const draft = useRefundDraft(data ?? PLACEHOLDER_ORDER, refundableNow, !!data && showRefund, () => setShowRefund(false));

  const nav = (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous order (↑)">
        <ChevronUp />
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext} disabled={!onNext} aria-label="Next order (↓)">
        <ChevronDown />
      </Button>
    </div>
  );

  if (isPending || isError || !data) {
    return (
      <Drawer title={orderCode(orderId)} onClose={onClose} actions={nav}>
        {isError ? (
          <ErrorState title="This order couldn’t be loaded" onRetry={() => void refetch()} />
        ) : (
          <LoadingState label="Loading the order" />
        )}
      </Drawer>
    );
  }

  const source = SOURCE_META[data.source];
  const payment = paymentSummary({ paymentMethod: data.paymentMethod, paymentStatus: data.paymentStatus });
  const refunded = (data.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);
  const refundable = Math.max(0, Number(data.totalAmount) - refunded);
  const step = nextStep(data);
  // Refund mode: the same drawer, its body and footer swapped for the refund.
  const refunding = canRefund && showRefund && data.status === 'done' && refundable > 0;
  const discount = Number(data.discountAmount ?? 0);
  const listOrder = {
    ...data,
    totalAmount: Number(data.totalAmount),
    updatedAt: data.updatedAt ?? data.createdAt,
    tenantId: data.tenantId ?? '',
  };

  // Status changes and refunds, in the order they happened, with the gap between each.
  const activity = orderActivity(data.statusHistory, data.refunds);
  const summary = turnaround(data.statusHistory);

  return (
    <Drawer
      title={refunding ? `Refund order ${orderCode(data.id)}` : `Order ${orderCode(data.id)}`}
      description={refunding ? undefined : `${source.label} · ${formatDateTime(data.createdAt)}`}
      onClose={onClose}
      actions={refunding ? undefined : nav}
      footer={
        refunding ? (
          <RefundFooter draft={draft} money={money} onCancel={() => setShowRefund(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowReceipt(true)}>
              <Receipt data-icon="inline-start" />
              Receipt
            </Button>
            {data.customerId && (
              <Button type="button" variant="outline" onClick={() => setShowEmail(true)}>
                <Mail data-icon="inline-start" />
                Email
              </Button>
            )}
            {canRefund && data.status === 'done' && refundable > 0 && (
              <Button type="button" variant="destructive" onClick={() => setShowRefund(true)}>
                <RotateCcw data-icon="inline-start" />
                Refund
              </Button>
            )}
            {step && (
              <Button
                type="button"
                className="ml-auto"
                disabled={advance.isPending}
                onClick={() => advance.mutate({ status: step.status })}
              >
                {advance.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {step.label}
              </Button>
            )}
          </div>
        )
      }
    >
      {refunding ? (
        <RefundBody draft={draft} order={data} refundable={refundable} money={money} />
      ) : (
        <div className="space-y-6">
          {/* The headline: what it came to, how it was paid, where it's up to. */}
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
            <div className="flex items-start gap-3.5 px-4 pt-4 pb-3.5">
              <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-lg', STATUS_META[data.status].tint)}>
                <source.icon size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-2xl font-semibold tracking-headline', refunded > 0 ? 'text-muted-foreground' : 'text-foreground')}>
                  {money(data.totalAmount)}
                  {refunded > 0 && <span className="ml-2 text-sm font-medium text-exception">− {money(refunded)} refunded</span>}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {itemCount(data.items) ?? 0} {itemCount(data.items) === 1 ? 'item' : 'items'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 font-medium',
                      payment.tone === 'success' ? 'text-foreground' : TONE_INK[payment.tone],
                    )}
                  >
                    {data.paymentMethod === 'cash' ? (
                      <Banknote size={13} aria-hidden="true" />
                    ) : (
                      <CreditCard size={13} aria-hidden="true" />
                    )}
                    {payment.state ? `${payment.method} · ${payment.state}` : payment.method}
                  </span>
                  {data.customerName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">For {data.customerName}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0">
                <StatusMenu order={listOrder} />
              </div>
            </div>
            <OrderProgress status={data.status} history={data.statusHistory ?? []} />
          </div>

          <section aria-labelledby="order-items">
            <h3 id="order-items" className="mb-2 text-sm font-semibold text-foreground">
              Items
            </h3>
            <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              <ul>
                {data.items.map((item) => {
                  const refundedLine = item.refundStatus && item.refundStatus !== 'none';
                  const extras = (item.modifiers ?? []).map((modifier) =>
                    Number(modifier.priceAdjust) !== 0 ? `${modifier.name} +${money(modifier.priceAdjust)}` : modifier.name,
                  );
                  return (
                    <li key={item.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                      <span
                        className={cn(
                          'flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                          refundedLine ? 'bg-exception/8 text-exception' : 'bg-band text-foreground',
                        )}
                      >
                        {item.quantity}×
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-semibold',
                            item.refundStatus === 'refunded' ? 'text-muted-foreground line-through' : 'text-foreground',
                          )}
                        >
                          {item.name}
                          {item.variantName && <span className="font-normal text-muted-foreground"> · {item.variantName}</span>}
                        </span>
                        {extras.length > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{extras.join(' · ')}</span>}
                        {item.notes && <span className="mt-0.5 block text-xs italic text-muted-foreground">“{item.notes}”</span>}
                        {(item.quantity > 1 || refundedLine) && (
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.quantity > 1 && <span className="text-xs text-muted-foreground">{money(item.unitPrice)} each</span>}
                            {refundedLine && (
                              <span className="rounded-sm bg-exception/8 px-1.5 py-0.5 text-micro font-semibold text-exception">
                                {item.refundStatus === 'refunded' ? 'Refunded' : 'Part refunded'}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{money(item.subtotal)}</span>
                    </li>
                  );
                })}
              </ul>
              {/* Totals: the lines that adjust it muted, the figure that matters largest. */}
              <dl className="space-y-1 border-t border-rule/60 bg-band/25 px-3.5 py-3 text-sm">
                {discount !== 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Discount</dt>
                    <dd className="text-momentum">− {money(discount)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between">
                  <dt className="font-semibold text-foreground">Total</dt>
                  <dd className="text-base font-semibold text-foreground">{money(data.totalAmount)}</dd>
                </div>
                {refunded > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <dt>Refunded</dt>
                      <dd className="text-exception">− {money(refunded)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-rule/45 pt-1 font-semibold text-foreground">
                      <dt>Kept</dt>
                      <dd>{money(refundable)}</dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          </section>

          <section aria-labelledby="order-details">
            <h3 id="order-details" className="mb-2 text-sm font-semibold text-foreground">
              Details
            </h3>
            <dl className="grid grid-cols-2 gap-2">
              <Detail
                icon={User}
                label="Taken by"
                value={staffName(data.createdBy) ?? (data.createdBy ? 'A former team member' : 'Self-service')}
              />
              <Detail icon={MapPin} label="Location" value={locationName(data.locationId) ?? 'Unknown location'} />
              {data.collectionTime && <Detail icon={Clock} label="Collect at" value={formatDateTime(data.collectionTime)} />}
              {data.voidReason && (
                <Detail
                  wide
                  tone="exception"
                  icon={XCircle}
                  label="Cancelled because"
                  value={`${optionLabel(VOID_REASON_OPTIONS, data.voidReason)}${data.voidNotes ? ` — ${data.voidNotes}` : ''}`}
                />
              )}
              {data.notes && <Detail wide icon={FileText} label="Note" value={data.notes} />}
            </dl>
          </section>

          <section aria-labelledby="order-activity">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 id="order-activity" className="text-sm font-semibold text-foreground">
                Activity
              </h3>
              {summary && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Timer size={12} aria-hidden="true" />
                  {summary}
                </span>
              )}
            </div>
            {activity.length === 0 ? (
              <p className="rounded-lg border border-dashed border-rule/70 px-4 py-5 text-center text-sm text-muted-foreground">
                No history recorded.
              </p>
            ) : (
              <ol className="rounded-lg border border-rule/60 bg-card px-4 py-3">
                {activity.map((event, index) => (
                  <ActivityItem
                    key={event.kind === 'status' ? `s-${event.entry.id}` : `r-${event.refund.id}`}
                    event={event}
                    first={index === 0}
                    last={index === activity.length - 1}
                    staffName={staffName}
                    money={money}
                  />
                ))}
              </ol>
            )}
          </section>
        </div>
      )}

      {showReceipt && <ReceiptModal orderId={data.id} onClose={() => setShowReceipt(false)} />}
      {showEmail && data.customerId && (
        <SendEmailModal
          customerId={data.customerId}
          orderId={data.id}
          recipientName={data.customerName || `Customer for order ${orderCode(data.id)}`}
          onClose={() => setShowEmail(false)}
        />
      )}
    </Drawer>
  );
}

const ACTIVITY_TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const ACTIVITY_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/**
 * One step in the order's life, as an activity feed reads: a tinted marker on
 * a line that joins the steps, what happened and who did it, the time on the
 * right (full date on hover), and — on the line leading into it — how long it
 * took since the step before. The latest step's marker is ringed: it's where
 * the order is now. A refund is its own inset card, because it is money moving.
 */
function ActivityItem({
  event,
  first,
  last,
  staffName,
  money,
}: {
  event: ActivityEvent<NonNullable<OrderDetail['statusHistory']>[number], NonNullable<OrderDetail['refunds']>[number]>;
  first: boolean;
  last: boolean;
  staffName: (userId: string | null | undefined) => string | null;
  money: (amount: string | number | null | undefined) => string;
}) {
  const refund = event.kind === 'refund' ? event.refund : null;
  const meta = event.kind === 'status' ? STATUS_META[event.entry.status] : null;
  const Icon = meta ? meta.icon : RotateCcw;
  const tint = meta ? meta.tint : 'bg-exception/8 text-exception';
  const actor = staffName(event.kind === 'status' ? event.entry.changedBy : event.refund.createdBy);
  const at = new Date(event.at);
  const sameDayAsNow = at.toDateString() === new Date().toDateString();

  return (
    <li className="relative flex gap-3">
      {/* The line joining this step to its neighbours, broken around the marker. */}
      <div className="relative flex w-7 shrink-0 flex-col items-center">
        <span className={cn('w-px flex-none bg-rule/70', first ? 'h-2 bg-transparent' : 'h-2')} aria-hidden="true" />
        <span
          className={cn(
            'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full',
            tint,
            last && 'ring-2 ring-offset-2 ring-offset-card',
            last && (meta ? meta.ring : 'ring-exception/35'),
          )}
        >
          <Icon size={14} aria-hidden="true" />
        </span>
        {!last && <span className="w-px flex-1 bg-rule/70" aria-hidden="true" />}
      </div>

      <div className={cn('min-w-0 flex-1 pt-2', last ? 'pb-1' : 'pb-4')}>
        {event.gapMs !== null && event.gapMs >= 1000 && (
          <span className="absolute -top-2 left-9 rounded-sm bg-band px-1.5 py-px text-micro font-semibold text-muted-foreground">
            +{formatGap(event.gapMs)}
          </span>
        )}
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn('text-sm font-medium', refund ? 'text-exception' : 'text-foreground')}>
            {refund
              ? `${refund.kind === 'full' ? 'Refunded in full' : 'Part refunded'} · ${money(refund.amount)}`
              : STATUS_EVENT[event.kind === 'status' ? event.entry.status : 'done']}
          </p>
          <time dateTime={event.at} title={formatDateTime(event.at)} className="shrink-0 text-xs text-muted-foreground">
            {sameDayAsNow ? ACTIVITY_TIME.format(at) : `${ACTIVITY_DAY.format(at)}, ${ACTIVITY_TIME.format(at)}`}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {actor ? `by ${actor}` : event.kind === 'status' && event.entry.status === 'pending' ? 'Self-service' : 'Automatically'}
        </p>
        {refund && (
          <div className="mt-2 rounded-md border border-exception/20 bg-exception/4 px-3 py-2 text-xs">
            <p className="text-foreground">
              {optionLabel(REFUND_REASON_OPTIONS, refund.reason)} ·{' '}
              <span className="text-muted-foreground">
                {refund.processingMode === 'stripe'
                  ? 'back to the card'
                  : refund.processingMode === 'cash_manual'
                    ? 'cash handed back'
                    : 'recorded'}
              </span>
            </p>
            {refund.lines && refund.lines.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {refund.lines.map((line) => (
                  <li key={line.id} className="rounded-sm bg-card px-1.5 py-0.5 text-muted-foreground">
                    {line.quantity}× {line.name} · {money(line.amount)}
                  </li>
                ))}
              </ul>
            )}
            {refund.notes && <p className="mt-1.5 italic text-muted-foreground">“{refund.notes}”</p>}
          </div>
        )}
      </div>
    </li>
  );
}

const PROGRESS: OrderDetail['status'][] = ['pending', 'preparing', 'ready', 'done'];
const PROGRESS_LABEL: Record<string, string> = { pending: 'Placed', preparing: 'Preparing', ready: 'Ready', done: 'Done' };

/**
 * Where the order is in the kitchen, as a four-step track — placed, preparing,
 * ready, done — with the time each step was reached. A cancelled or expired
 * order has no track to be on; it says so instead.
 */
function OrderProgress({ status, history }: { status: OrderDetail['status']; history: NonNullable<OrderDetail['statusHistory']> }) {
  if (status === 'cancelled' || status === 'expired') {
    const meta = STATUS_META[status];
    const at = history.find((entry) => entry.status === status)?.createdAt;
    return (
      <div className={cn('flex items-center gap-2 border-t border-rule/45 px-4 py-2.5 text-xs font-medium', meta.tint)}>
        <meta.icon size={13} aria-hidden="true" />
        {status === 'cancelled' ? 'Cancelled' : 'Expired before it was paid'}
        {at && <span className="font-normal opacity-80">· {ACTIVITY_TIME.format(new Date(at))}</span>}
      </div>
    );
  }
  const reached = PROGRESS.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1.5 border-t border-rule/45 px-4 pt-3 pb-3.5" aria-label="Progress">
      {PROGRESS.map((step, index) => {
        const done = index <= reached;
        const at = history.find((entry) => entry.status === step)?.createdAt;
        return (
          <li key={step} aria-current={index === reached ? 'step' : undefined}>
            <span
              className={cn('block h-1.5 rounded-full', done ? (index === reached ? STATUS_META[step].dot : 'bg-momentum/50') : 'bg-band')}
            />
            <span
              className={cn(
                'mt-1.5 block text-xs',
                index === reached ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {PROGRESS_LABEL[step]}
            </span>
            <span className="block text-xs text-muted-foreground">{at ? ACTIVITY_TIME.format(new Date(at)) : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One detail as a small tile — a grid of these reads faster than a table of label/value rows. */
function Detail({
  icon: Icon,
  label,
  value,
  wide = false,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  wide?: boolean;
  tone?: 'default' | 'exception';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
        wide && 'col-span-2',
        tone === 'exception' ? 'border-exception/25 bg-exception/4' : 'border-rule/60 bg-card',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md',
          tone === 'exception' ? 'bg-exception/8 text-exception' : 'bg-band/70 text-muted-foreground',
        )}
      >
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-label uppercase text-muted-foreground">{label}</dt>
        <dd className={cn('mt-0.5 text-sm font-medium text-foreground', !wide && 'truncate')}>{value}</dd>
      </div>
    </div>
  );
}

// ── Receipt ──────────────────────────────────────────────────────────────────

function ReceiptModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_PREFIX}/v1/receipts/${orderId}/receipt`, { credentials: 'include' });
        if (!res.ok) throw new Error(`The receipt couldn’t be loaded (${res.status}).`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId]);

  return (
    <Modal
      title={`Receipt ${orderCode(orderId)}`}
      size="xl"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button asChild size="lg" className="flex-1" disabled={!url}>
            <a href={url ?? undefined} download={`receipt-${orderId.slice(0, 8)}.pdf`} aria-disabled={!url}>
              <Download data-icon="inline-start" />
              Download PDF
            </a>
          </Button>
        </div>
      }
    >
      <div className="h-[65vh] overflow-hidden rounded-lg border border-rule/60 bg-band/40">
        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-exception">{error}</div>
        ) : url ? (
          <iframe src={url} title="Receipt" className="h-full w-full" />
        ) : (
          <LoadingState label="Loading the receipt" className="h-full" />
        )}
      </div>
    </Modal>
  );
}
