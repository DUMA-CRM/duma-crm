'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { ExtensionSlot } from '@/components/marketplace/ExtensionSlot';
import { SendEmailModal } from '@/components/email/SendEmailModal';
import {
  ArrowUpRight,
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  CreditCard,
  Download,
  Globe,
  Hash,
  type IconComponent,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Printer,
  Receipt,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Timer,
  Trash2,
  Truck,
  User,
  UtensilsCrossed,
  XCircle,
} from '@/components/icons';
import { RecordLink, useRecordHrefs } from '@/components/shared/RecordLink';
import { Avatar } from '@/components/shared/Avatar';
import { Drawer, type DrawerEnter, DrawerHeaderButton } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { LoadingState } from '@/components/shared/Skeleton';
import { TONE_INK, TONE_TINT, type Tone } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { CopyButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { API_PREFIX } from '@/lib/modules/core/client';
import { getCustomer } from '@/lib/modules/customers/client';
import { type OrderDetail, getOrder } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import {
  type ActivityEvent,
  REFUND_NEEDS_PAYMENT,
  STATUS_EVENT,
  canEditDelivery,
  canRecordPayment,
  formatGap,
  itemCount,
  nextStep,
  orderActivity,
  orderCode,
  paymentSourceLabel,
  paymentSummary,
  refundPosition,
  shippingAddressLines,
  turnaround,
} from '@/lib/utils/orders-list';
import { workspaceDateKey, workspaceFormatter } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import { OrderDeliveryEditor } from './OrderDeliveryEditor';
import { OrderNote } from './OrderNote';
import { PaymentDueCard } from './PaymentDueCard';
import { RefundBody, RefundFooter, useRefundDraft } from './RefundPanel';
import { DeleteOrderModal, useMayDeleteOrder } from './DeleteOrderModal';
import { StatusPill, VoidModal, nextStatuses, useStatusChange } from './StatusMenu';
import { FULFILMENT_LABEL, REFUND_REASON_OPTIONS, SOURCE_META, STATUS_META, VOID_REASON_OPTIONS, optionLabel } from './orderMeta';

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

/** A white card on the drawer — every section shares it. */
const CARD = 'overflow-hidden rounded-lg border border-border bg-card shadow-sm';
const SECTION_HEADING = 'mb-2 px-1 text-sm font-semibold text-heading';
const MENU_ITEM =
  'flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-band/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

/**
 * One order, beside the list it came from, laid out the way Square's order
 * details read: where it's up to and what it came to, who it's for and how it
 * reaches them, what was ordered and how it was paid, then the note, what
 * happened to it and the reference details. The next step (Mark ready,
 * Complete) is the primary action; receipt and refund sit beside it; the rarer
 * actions (email, copy, cancel) live under ⋯. ↑/↓ step through the list.
 */
export function OrderDrawer({
  orderId,
  staffName,
  locationName,
  onClose,
  onPrev,
  onNext,
  enter,
}: {
  orderId: string;
  staffName: (userId: string | null | undefined) => string | null;
  locationName: (locationId: string) => string | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** `instant` when ↑/↓ brought this order in: no slide, just the new order. */
  enter?: DrawerEnter;
}) {
  const money = useWorkspaceMoney();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canRefund = hasCapability(capabilities, 'orders:refund');
  // Anyone who works orders can keep a note on one (POST /orders/:id/notes checks the same).
  const canNote = hasAnyCapability(capabilities, 'orders:status', 'orders:create');
  // Whoever can take an order by hand can record its payment (the API checks the same).
  const canTakeOrders = hasCapability(capabilities, 'orders:create');
  const hrefs = useRecordHrefs();
  const [showReceipt, setShowReceipt] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const { data, isPending, isError, refetch } = useQuery<OrderDetail>({
    queryKey: moduleQueryKeys.ordering.key('order', orderId),
    queryFn: () => getOrder(orderId),
  });
  // The linked customer: their name for orders created before the API stored
  // one, and their phone and email so staff can reach them from the order.
  const linkedCustomer = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer', data?.customerId ?? null),
    queryFn: () => getCustomer(data!.customerId!),
    enabled: !!data?.customerId,
  });
  const advance = useStatusChange({ id: orderId });
  const mayDelete = useMayDeleteOrder(data?.status);
  const [deleting, setDeleting] = useState(false);

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
  // In pence (`refundPosition`), so a fully refunded order reads as exactly nothing left.
  const position = refundPosition(data ?? PLACEHOLDER_ORDER);
  const draft = useRefundDraft(data ?? PLACEHOLDER_ORDER, position.refundable, !!data && showRefund, () => setShowRefund(false));

  const nav = (
    <>
      <DrawerHeaderButton label="Previous order (↑)" onClick={onPrev} disabled={!onPrev}>
        <ChevronUp size={16} />
      </DrawerHeaderButton>
      <DrawerHeaderButton label="Next order (↓)" onClick={onNext} disabled={!onNext}>
        <ChevronDown size={16} />
      </DrawerHeaderButton>
    </>
  );

  if (isPending || isError || !data) {
    return (
      <Drawer icon={ReceiptText} title={orderCode(orderId)} onClose={onClose} actions={nav} enter={enter}>
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
  const { refunded, refundable, refundedFull } = position;
  const step = nextStep(data);
  const canCancel = nextStatuses(data).includes('cancelled');
  // A refund gives back money that was taken; on an unpaid order the API refuses (409), so the button says why instead.
  const refundEligible = canRefund && data.status === 'done' && refundable > 0;
  const mayRefund = refundEligible && position.paid;
  // Refund mode: the same drawer, its body and footer swapped for the refund.
  const refunding = mayRefund && showRefund;
  const discount = Number(data.discountAmount ?? 0);
  const deliveryFee = Number(data.deliveryFee ?? 0);
  const itemsTotal = data.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const sendsOut = data.fulfilmentType === 'delivery' || data.fulfilmentType === 'shipping';
  const count = itemCount(data.items) ?? 0;
  const paymentDue = canRecordPayment(data) && canTakeOrders;

  const customer = linkedCustomer.data;
  const customerName =
    data.customerName || (customer ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email : null) || null;
  const phone = customer?.phone ?? data.shippingAddress?.phone ?? null;
  // The number to ring about the drop-off: the one given with the address, else the customer's own.
  const deliveryPhone = data.shippingAddress?.phone ?? customer?.phone ?? null;
  const email = customer?.email ?? data.customerEmail ?? null;
  const editableDelivery = canEditDelivery(data) && canTakeOrders;

  // Status changes and refunds, in the order they happened, with the gap between each.
  const activity = orderActivity(data.statusHistory, data.refunds, data.payments);
  const summary = turnaround(data.statusHistory);

  const more = (
    <Popover open={moreOpen} onOpenChange={setMoreOpen}>
      <PopoverTrigger asChild>
        <DrawerHeaderButton label="More actions">
          <MoreHorizontal size={16} />
        </DrawerHeaderButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {data.customerId && (
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              setMoreOpen(false);
              setShowEmail(true);
            }}
          >
            <Mail size={16} className="text-muted-foreground" aria-hidden="true" />
            Email the customer
          </button>
        )}
        <button
          type="button"
          className={MENU_ITEM}
          onClick={() => {
            setMoreOpen(false);
            void navigator.clipboard.writeText(orderCode(data.id)).then(
              () => toast('success', `${orderCode(data.id)} copied.`),
              () => toast('error', 'Couldn’t copy the code.'),
            );
          }}
        >
          <Copy size={16} className="text-muted-foreground" aria-hidden="true" />
          Copy order code
        </button>
        {canCancel && (
          <button
            type="button"
            className={cn(MENU_ITEM, 'text-exception hover:bg-exception/8')}
            onClick={() => {
              setMoreOpen(false);
              setVoiding(true);
            }}
          >
            <XCircle size={16} aria-hidden="true" />
            Cancel order…
          </button>
        )}
        {mayDelete && (
          <button
            type="button"
            className={cn(MENU_ITEM, 'text-exception hover:bg-exception/8')}
            onClick={() => {
              setMoreOpen(false);
              setDeleting(true);
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete order…
          </button>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <Drawer
      icon={ReceiptText}
      title={refunding ? `Refund order ${orderCode(data.id)}` : `Order ${orderCode(data.id)}`}
      description={refunding ? undefined : `${source.label} · ${formatDateTime(data.createdAt)}`}
      onClose={onClose}
      enter={enter}
      actions={
        refunding ? undefined : (
          <>
            {nav}
            {more}
          </>
        )
      }
      footer={
        refunding ? (
          <RefundFooter draft={draft} money={money} onCancel={() => setShowRefund(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setShowReceipt(true)}>
              <Receipt data-icon="inline-start" />
              Receipt
            </Button>
            {mayRefund ? (
              <Button type="button" variant="outline" onClick={() => setShowRefund(true)}>
                <RotateCcw data-icon="inline-start" />
                Refund
              </Button>
            ) : (
              refundEligible && (
                <span title={REFUND_NEEDS_PAYMENT}>
                  <Button type="button" variant="outline" disabled aria-describedby="order-refund-unpaid">
                    <RotateCcw data-icon="inline-start" />
                    Refund
                  </Button>
                  <span id="order-refund-unpaid" className="sr-only">
                    {REFUND_NEEDS_PAYMENT}
                  </span>
                </span>
              )
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
          {/* Where it's up to, what it came to, how it was paid. */}
          <section aria-label="Summary" className={CARD}>
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3.5">
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-3xl font-semibold tracking-headline tabular-nums',
                    refundedFull ? 'text-muted-foreground line-through decoration-exception/50' : 'text-heading',
                  )}
                >
                  {money(data.totalAmount)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
                  <span className={cn('inline-flex items-center gap-1 font-medium', TONE_INK[payment.tone])}>
                    {data.paymentMethod === 'cash' ? (
                      <Banknote size={14} aria-hidden="true" />
                    ) : (
                      <CreditCard size={14} aria-hidden="true" />
                    )}
                    {payment.state
                      ? `${payment.method} · ${payment.state}`
                      : payment.tone === 'success'
                        ? `Paid · ${payment.method}`
                        : payment.method}
                  </span>
                  {refunded > 0 && !refundedFull && <span className="font-medium text-exception">· {money(refunded)} refunded</span>}
                  <span aria-hidden="true">·</span>
                  <span>
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                </p>
              </div>
              <div className="shrink-0">
                <StatusPill status={data.status} />
              </div>
            </div>
            <OrderProgress
              status={data.status}
              history={data.statusHistory ?? []}
              reason={
                data.voidReason
                  ? `${optionLabel(VOID_REASON_OPTIONS, data.voidReason)}${data.voidNotes ? ` — ${data.voidNotes}` : ''}`
                  : null
              }
            />
          </section>

          {/* Taken by hand, or a website order awaiting a transfer, and still to be paid — gone once it is. */}
          {paymentDue && <PaymentDueCard orderId={data.id} amountDue={Number(data.totalAmount)} defaultMethod={data.paymentMethod} />}

          {/* Who it's for and how it reaches them — Square puts the customer first, with a way to reach them. */}
          <section aria-labelledby="order-customer" className={CARD}>
            {/* Sized like the DetailRows under it: a 36px square tile, name over contact. */}
            <div className="flex items-center gap-3 px-4 py-3">
              {customerName ? (
                <Avatar name={customerName} email={email} size="md" />
              ) : (
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground"
                  aria-hidden="true"
                >
                  <User size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 id="order-customer" className="truncate text-sm font-semibold text-heading">
                  {customerName ?? (editableDelivery ? 'No customer yet' : 'Walk-in')}
                </h3>
                {phone || email ? (
                  <p className="flex min-w-0 flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {phone && (
                      <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                        <Phone size={12} aria-hidden="true" />
                        {phone}
                      </a>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="inline-flex min-w-0 items-center gap-1 truncate hover:text-foreground hover:underline"
                      >
                        <Mail size={12} aria-hidden="true" />
                        <span className="truncate">{email}</span>
                      </a>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {data.customerId
                      ? 'No phone or email on file'
                      : editableDelivery
                        ? 'Add who it’s for — needed to deliver it'
                        : 'No customer attached'}
                  </p>
                )}
              </div>
              {data.customerId && (
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/customers/${data.customerId}`}>
                    Profile
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              )}
              {editableDelivery && (
                <Button size="sm" variant="outline" onClick={() => setEditingDelivery(true)}>
                  {data.customerId ? 'Edit' : 'Add'}
                </Button>
              )}
            </div>
            {(data.fulfilmentType || data.collectionTime || data.shippingAddress) && (
              <dl className="border-t border-border">
                {data.fulfilmentType && FULFILMENT_LABEL[data.fulfilmentType] && (
                  <DetailRow
                    icon={
                      data.fulfilmentType === 'eat_in'
                        ? UtensilsCrossed
                        : data.fulfilmentType === 'takeaway' || data.fulfilmentType === 'collection'
                          ? ShoppingBag
                          : Truck
                    }
                    label="Order type"
                    value={
                      sendsOut
                        ? [FULFILMENT_LABEL[data.fulfilmentType], data.deliveryMethod, deliveryFee > 0 ? money(deliveryFee) : 'Free']
                            .filter(Boolean)
                            .join(' · ')
                        : FULFILMENT_LABEL[data.fulfilmentType]
                    }
                  />
                )}
                {data.collectionTime && (
                  <DetailRow icon={Clock} tone="info" label="Collect at" value={formatDateTime(data.collectionTime)} />
                )}
                {sendsOut && (
                  <DetailRow
                    icon={MapPin}
                    label="Send to"
                    value={data.shippingAddress ? shippingAddressLines(data.shippingAddress).join(', ') : 'No address yet'}
                    tone={data.shippingAddress ? 'info' : 'warning'}
                    copy={data.shippingAddress ? shippingAddressLines(data.shippingAddress).join(', ') : undefined}
                  />
                )}
                {sendsOut && deliveryPhone && (
                  <DetailRow
                    icon={Phone}
                    label="Contact number"
                    value={
                      <a href={`tel:${deliveryPhone}`} className="hover:underline">
                        {deliveryPhone}
                      </a>
                    }
                    copy={deliveryPhone}
                  />
                )}
              </dl>
            )}
          </section>

          {/* What was ordered, what it came to, and how the money moved. */}
          <section aria-labelledby="order-items">
            <h3 id="order-items" className={SECTION_HEADING}>
              Items
            </h3>
            <div className={CARD}>
              <ul>
                {data.items.map((item) => {
                  const refundedLine = item.refundStatus && item.refundStatus !== 'none';
                  const extras = (item.modifiers ?? []).map((modifier) =>
                    Number(modifier.priceAdjust) !== 0 ? `${modifier.name} +${money(modifier.priceAdjust)}` : modifier.name,
                  );
                  return (
                    <li key={item.id} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
                      <span
                        className={cn(
                          'w-7 shrink-0 text-sm font-semibold tabular-nums',
                          refundedLine ? 'text-exception' : 'text-muted-foreground',
                        )}
                      >
                        {item.quantity}×
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-medium',
                            item.refundStatus === 'refunded' ? 'text-muted-foreground line-through' : 'text-foreground',
                          )}
                        >
                          <RecordLink href={hrefs.menuItem(item.menuItemId)}>{item.name}</RecordLink>
                          {item.variantName && <span className="font-normal text-muted-foreground"> · {item.variantName}</span>}
                        </span>
                        {extras.length > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{extras.join(' · ')}</span>}
                        {item.notes && <span className="mt-0.5 block text-xs italic text-muted-foreground">“{item.notes}”</span>}
                        {(item.quantity > 1 || refundedLine) && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.quantity > 1 && `${money(item.unitPrice)} each`}
                            {item.quantity > 1 && refundedLine && ' · '}
                            {refundedLine && (
                              <span className="font-medium text-exception">
                                {item.refundStatus === 'refunded' ? 'Refunded' : 'Part refunded'}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">{money(item.subtotal)}</span>
                    </li>
                  );
                })}
              </ul>
              {/* Totals: the lines that adjust it muted, the figure that matters in ink. */}
              <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
                {(discount !== 0 || deliveryFee > 0) && <TotalRow label="Subtotal" value={money(itemsTotal)} />}
                {discount !== 0 && <TotalRow label="Discount" value={`− ${money(discount)}`} tone="momentum" />}
                {deliveryFee > 0 && (
                  <TotalRow label={data.fulfilmentType === 'shipping' ? 'Shipping' : 'Delivery'} value={money(deliveryFee)} />
                )}
                <TotalRow label="Total" value={money(data.totalAmount)} strong />
              </dl>
              {/* The money: what was taken and how, what went back, what was kept. Refund detail is in Activity. */}
              {!paymentDue && (
                <dl className="space-y-1.5 border-t border-border bg-band/30 px-4 py-3 text-sm">
                  <TotalRow
                    label={
                      payment.tone === 'success' || payment.state === 'Refunded'
                        ? [payment.method, paymentSourceLabel(data.paymentProvider, data.paymentReference)].filter(Boolean).join(' · ')
                        : payment.state
                          ? `${payment.method} · ${payment.state}`
                          : payment.method
                    }
                    value={payment.tone === 'success' || payment.state === 'Refunded' ? money(data.totalAmount) : '—'}
                  />
                  {refunded > 0 && (
                    <>
                      <TotalRow label="Refunded" value={`− ${money(refunded)}`} tone="exception" />
                      <TotalRow label="Net" value={money(refundable)} strong />
                    </>
                  )}
                </dl>
              )}
            </div>
          </section>

          {/* The order's note: added or changed whenever there's something worth keeping. */}
          <ExtensionSlot surface="order.detail" recordKey={data.id} total={data.totalAmount}
            formattedTotal={money(data.totalAmount)} />
          <OrderNote key={data.notes ?? ''} orderId={data.id} notes={data.notes} canEdit={canNote} />

          <FoldSection
            id="order-activity"
            title="Activity"
            summary={
              summary ? (
                <span className="inline-flex items-center gap-1">
                  <Timer size={12} aria-hidden="true" />
                  {summary}
                </span>
              ) : (
                `${activity.length} ${activity.length === 1 ? 'event' : 'events'}`
              )
            }
          >
            {activity.length === 0 ? (
              <p className="rounded-lg border border-dashed border-edge px-4 py-5 text-center text-sm text-muted-foreground">
                No history recorded.
              </p>
            ) : (
              <ol className={CARD}>
                {activity.map((event, index) => (
                  <ActivityItem
                    key={
                      event.kind === 'status'
                        ? `s-${event.entry.id}`
                        : event.kind === 'refund'
                          ? `r-${event.refund.id}`
                          : `p-${event.payment.id}`
                    }
                    event={event}
                    last={index === activity.length - 1}
                    staffName={staffName}
                    money={money}
                  />
                ))}
              </ol>
            )}
          </FoldSection>

          {/* Reference details — the header already says the channel and when. */}
          <FoldSection
            id="order-details"
            title="Details"
            summary={`Taken by ${staffName(data.createdBy) ?? (data.createdBy ? 'a former team member' : 'self-service')}`}
          >
            <dl className={CARD}>
              <DetailRow
                icon={User}
                label="Taken by"
                value={
                  staffName(data.createdBy) ? (
                    <RecordLink href={hrefs.staff(data.createdBy)}>{staffName(data.createdBy)}</RecordLink>
                  ) : data.createdBy ? (
                    'A former team member'
                  ) : (
                    'Self-service'
                  )
                }
              />
              <DetailRow icon={MapPin} tone="info" label="Location" value={locationName(data.locationId) ?? 'Unknown location'} />
              {/* From the business's own website: its number for the order. */}
              {data.externalReference && (
                <DetailRow icon={Globe} tone="info" label="Website order" value={data.externalReference} copy={data.externalReference} />
              )}
              <DetailRow
                icon={Hash}
                tone="info"
                label="Order ID"
                value={<span className="font-mono text-xs break-all">{data.id}</span>}
                copy={data.id}
              />
            </dl>
          </FoldSection>
        </div>
      )}

      {showReceipt && <ReceiptModal orderId={data.id} onClose={() => setShowReceipt(false)} />}
      {editingDelivery && <OrderDeliveryEditor order={data} onClose={() => setEditingDelivery(false)} />}
      {voiding && <VoidModal order={data} onClose={() => setVoiding(false)} />}
      {deleting && <DeleteOrderModal order={data} onClose={() => setDeleting(false)} onDeleted={onClose} />}
      {showEmail && data.customerId && (
        <SendEmailModal
          customerId={data.customerId}
          orderId={data.id}
          recipientName={customerName || `Customer for order ${orderCode(data.id)}`}
          onClose={() => setShowEmail(false)}
        />
      )}
    </Drawer>
  );
}

/**
 * A drawer section that starts folded: the heading is the toggle, with a
 * one-line summary on the right so the folded section still says something.
 * For what's looked up now and then (history, references), not every time.
 */
function FoldSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby={id}>
      <h3 className={cn(open && 'mb-2')}>
        <button
          type="button"
          id={id}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
          className="flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-left text-sm font-semibold text-heading transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ChevronRight
            size={14}
            className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
            aria-hidden="true"
          />
          {title}
          {summary && <span className="ml-auto min-w-0 truncate pl-3 text-xs font-medium text-muted-foreground">{summary}</span>}
        </button>
      </h3>
      {open && <div id={`${id}-body`}>{children}</div>}
    </section>
  );
}

/** One line of the totals: muted label, the amount on the right; `strong` for the figure that matters. */
function TotalRow({
  label,
  value,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'momentum' | 'exception';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn('min-w-0 truncate', strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'shrink-0 tabular-nums',
          strong ? 'text-base font-semibold text-foreground' : 'text-foreground',
          tone === 'momentum' && 'text-momentum',
          tone === 'exception' && 'text-exception',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

const ACTIVITY_TIME = () => workspaceFormatter({ hour: '2-digit', minute: '2-digit' });
const ACTIVITY_DAY = () => workspaceFormatter({ day: 'numeric', month: 'short' });

/**
 * One step in the order's life, sized like the rows around it: a 36px tinted
 * square tile on a line that joins the steps, what happened with the time on
 * the right, and underneath who did it and how long after the step before. A
 * refund adds why, where the money went, the lines and the note — plain text
 * under the row, not a card inside the card.
 */
function ActivityItem({
  event,
  last,
  staffName,
  money,
}: {
  event: ActivityEvent<
    NonNullable<OrderDetail['statusHistory']>[number],
    NonNullable<OrderDetail['refunds']>[number],
    NonNullable<OrderDetail['payments']>[number]
  >;
  last: boolean;
  staffName: (userId: string | null | undefined) => string | null;
  money: (amount: string | number | null | undefined) => string;
}) {
  const refund = event.kind === 'refund' ? event.refund : null;
  const payment = event.kind === 'payment' ? event.payment : null;
  const failed = payment?.status === 'failed';
  const meta = event.kind === 'status' ? STATUS_META[event.entry.status] : null;
  const Icon = meta ? meta.icon : payment ? (payment.provider === 'cash' ? Banknote : CreditCard) : RotateCcw;
  const tint = meta ? meta.tint : payment && !failed ? 'bg-momentum/8 text-momentum' : 'bg-exception/8 text-exception';
  const actorId =
    event.kind === 'status'
      ? event.entry.changedBy
      : event.kind === 'refund'
        ? event.refund.createdBy
        : (event.payment.confirmedBy ?? event.payment.createdBy);
  const actor = staffName(actorId);
  const hrefs = useRecordHrefs();
  const title = refund
    ? `${refund.kind === 'full' ? 'Refunded in full' : 'Refund issued'} · ${money(refund.amount)}`
    : payment
      ? `${failed ? 'Payment failed' : 'Payment received'} · ${money(payment.amount)}`
      : STATUS_EVENT[event.kind === 'status' ? event.entry.status : 'done'];
  // A payment's method is the useful second line; who took it follows.
  const method = payment ? paymentSummary({ paymentMethod: payment.provider, paymentStatus: 'paid' }).method : null;
  const at = new Date(event.at);
  const sameDayAsNow = workspaceDateKey(at) === workspaceDateKey();
  const who = actor ?? (event.kind === 'status' && event.entry.status === 'pending' ? 'Self-service' : payment ? null : 'Automatically');
  const after = event.gapMs !== null && event.gapMs >= 1000 ? `${formatGap(event.gapMs)} later` : null;

  return (
    <li className="relative flex gap-3 px-4 py-3">
      {/* The line down to the next step's tile: from under this tile (12px padding + 36px) into the next row's top padding. */}
      {!last && <span className="absolute top-12 -bottom-3 left-[2.125rem] w-px -translate-x-1/2 bg-border" aria-hidden="true" />}
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tint)}>
        <Icon size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn('text-sm font-medium', refund || failed ? 'text-exception' : 'text-foreground')}>{title}</p>
          <time dateTime={event.at} title={formatDateTime(event.at)} className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {sameDayAsNow ? ACTIVITY_TIME().format(at) : `${ACTIVITY_DAY().format(at)}, ${ACTIVITY_TIME().format(at)}`}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">
          {[
            method,
            // A named team member opens their staff record.
            who && actor ? <RecordLink href={hrefs.staff(actorId)}>{who}</RecordLink> : who,
            after,
          ]
            .filter(Boolean)
            .map((part, index) => (
              <span key={index}>
                {index > 0 && ' · '}
                {part}
              </span>
            ))}
        </p>
        {refund && (
          <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <p>
              <span className="text-foreground">{optionLabel(REFUND_REASON_OPTIONS, refund.reason)}</span>
              {' · '}
              {refund.processingMode === 'stripe'
                ? 'back to the card'
                : refund.processingMode === 'cash_manual'
                  ? 'cash handed back'
                  : 'recorded'}
            </p>
            {refund.lines && refund.lines.length > 0 && (
              <p>{refund.lines.map((line) => `${line.quantity}× ${line.name} ${money(line.amount)}`).join(' · ')}</p>
            )}
            {refund.notes && <p className="italic">“{refund.notes}”</p>}
          </div>
        )}
      </div>
    </li>
  );
}

const PROGRESS: OrderDetail['status'][] = ['pending', 'preparing', 'ready', 'done'];
// Square's fulfilment steps, in DUMA's words: placed, preparing, ready, completed.
const PROGRESS_LABEL: Record<string, string> = { pending: 'Placed', preparing: 'Preparing', ready: 'Ready', done: 'Completed' };

/**
 * Where the order is, as a four-step tracker — placed, preparing, ready,
 * completed — each a square tile on a line with the time it was reached.
 * Steps behind are checked off in green, the current one is filled in its
 * status colour, the ones ahead are greyed. A cancelled or expired order has no
 * track to be on; it says so instead, with when.
 */
function OrderProgress({
  status,
  history,
  reason,
}: {
  status: OrderDetail['status'];
  history: NonNullable<OrderDetail['statusHistory']>;
  /** Why it was cancelled — kept up here, not in the folded Details. */
  reason?: string | null;
}) {
  if (status === 'cancelled' || status === 'expired') {
    const meta = STATUS_META[status];
    const at = history.find((entry) => entry.status === status)?.createdAt;
    return (
      <div className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.tint)}>
          <meta.icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{status === 'cancelled' ? 'Order cancelled' : 'Expired before it was paid'}</p>
          {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
        </div>
        {at && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ACTIVITY_TIME().format(new Date(at))}</span>}
      </div>
    );
  }
  const reached = PROGRESS.indexOf(status);
  return (
    <ol className="flex border-t border-border px-2 pt-3.5 pb-3" aria-label="Progress">
      {PROGRESS.map((step, index) => {
        const passed = index < reached;
        const current = index === reached;
        const at = history.find((entry) => entry.status === step)?.createdAt;
        // The finished order's last step is a tick too: nothing is left to happen.
        const Icon = passed || (current && step === 'done') ? Check : STATUS_META[step].icon;
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
            {/* The line from the step before, through the gap between tiles. */}
            {index > 0 && (
              <span
                className={cn(
                  'absolute top-4 right-[calc(50%+1.25rem)] left-[calc(-50%+1.25rem)] h-px',
                  index <= reached ? 'bg-momentum/50' : 'bg-border',
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-md',
                current
                  ? cn(STATUS_META[step].dot, 'text-white')
                  : passed
                    ? 'bg-momentum/10 text-momentum'
                    : 'bg-band text-muted-foreground/60',
              )}
            >
              <Icon size={15} strokeWidth={current || passed ? 2.25 : 2} aria-hidden="true" />
            </span>
            <span
              className={cn(
                'mt-1.5 text-xs',
                current ? 'font-semibold text-heading' : passed ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {PROGRESS_LABEL[step]}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{at ? ACTIVITY_TIME().format(new Date(at)) : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One reference detail as a row, sized like a `ListRow`: a 36px tinted icon
 * tile with the label over the value, so the two lines fill the tile's height.
 * `copy` adds a copy button on the right, for values staff paste elsewhere.
 */

function DetailRow({
  icon: Icon,
  label,
  value,
  tone = 'primary',
  copy,
}: {
  icon: IconComponent;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  copy?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_TINT[tone])}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn('text-sm font-medium', tone === 'exception' ? 'text-exception' : 'text-foreground')}>{value}</dd>
      </div>
      {copy && (
        <CopyButton
          iconOnly
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          label={`Copy ${label.toLowerCase()}`}
          copiedLabel="Copied"
          onCopy={async () => {
            const copied = await copyText(copy);
            if (!copied) toast('error', `Copy failed — select the ${label.toLowerCase()} instead.`);
            return copied;
          }}
        />
      )}
    </div>
  );
}

// ── Receipt ──────────────────────────────────────────────────────────────────

function ReceiptModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Print the receipt in place (a customer asking for a VAT receipt at the counter);
  // a browser that won't print a PDF frame gets it in a tab to print from there.
  const print = () => {
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      if (url) window.open(url, '_blank', 'noopener');
    }
  };

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
          <Button asChild variant="outline" size="lg" className="flex-1" disabled={!url}>
            <a href={url ?? undefined} download={`receipt-${orderId.slice(0, 8)}.pdf`} aria-disabled={!url}>
              <Download data-icon="inline-start" />
              Download PDF
            </a>
          </Button>
          <Button size="lg" className="flex-1" disabled={!url} onClick={print}>
            <Printer data-icon="inline-start" />
            Print
          </Button>
        </div>
      }
    >
      <div className="h-[65vh] overflow-hidden rounded-lg border border-border bg-band/40">
        {error ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-exception">{error}</div>
        ) : url ? (
          <iframe ref={frameRef} src={url} title="Receipt" className="h-full w-full" />
        ) : (
          <LoadingState label="Loading the receipt" className="h-full" />
        )}
      </div>
    </Modal>
  );
}
