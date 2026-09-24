'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  User,
  X,
} from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type PublicMenuItem,
  type PublicModifierOption,
  type QrCustomerVerification,
  createPublicQrOrder,
  getPublicQrMenu,
  getPublicQrOrder,
  requestQrCustomerCode,
  verifyQrCustomerCode,
} from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';

interface CartLine {
  key: string;
  item: PublicMenuItem;
  selected: PublicModifierOption[];
  quantity: number;
}

type Stage = 'menu' | 'checkout' | 'tracking';

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const formatMoney = (value: string | number) => money.format(Number(value));

function lineUnitTotal(line: CartLine) {
  return Number(line.item.price) + line.selected.reduce((total, option) => total + Number(option.priceAdjust), 0);
}

function ItemImage({ item, className }: { item: PublicMenuItem; className?: string }) {
  return item.imageUrl ? (
    // Menu imagery is supplied by each business and can use arbitrary hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.imageUrl} alt="" className={cn('object-cover', className)} />
  ) : (
    <div className={cn('flex items-center justify-center bg-band text-muted-foreground', className)}>
      <Store size={22} aria-hidden="true" />
    </div>
  );
}

function OrderDocket({
  cart,
  onQuantity,
  onCheckout,
  minimum,
  canCheckout,
  readOnly = false,
}: {
  cart: CartLine[];
  onQuantity: (key: string, delta: number) => void;
  onCheckout: () => void;
  minimum: number;
  canCheckout: boolean;
  readOnly?: boolean;
}) {
  const total = cart.reduce((sum, line) => sum + lineUnitTotal(line) * line.quantity, 0);
  const minimumRemaining = Math.max(0, minimum - total);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-rule/55 px-4 py-3">
        <h2 className="font-semibold">Your order</h2>
        <span className="font-mono text-sm font-semibold">{formatMoney(total)}</span>
      </div>
      <div className="max-h-[46dvh] flex-1 divide-y divide-rule/45 overflow-y-auto lg:max-h-none">
        {cart.length ? (
          cart.map((line) => (
            <div key={line.key} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{line.item.name}</p>
                  {line.selected.length > 0 && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {line.selected.map((option) => option.label).join(', ')}
                    </p>
                  )}
                </div>
                <p className="font-mono text-sm font-semibold">{formatMoney(lineUnitTotal(line) * line.quantity)}</p>
              </div>
              {!readOnly && (
                <div className="mt-2 flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onQuantity(line.key, -1)}
                    aria-label={`Remove one ${line.item.name}`}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-mono text-sm" aria-label={`Quantity ${line.quantity}`}>
                    {line.quantity}
                  </span>
                  <Button variant="outline" size="icon-sm" onClick={() => onQuantity(line.key, 1)} aria-label={`Add one ${line.item.name}`}>
                    <Plus />
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
            <ShoppingBag size={24} className="text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Your basket is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">Choose something from the menu to begin.</p>
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="border-t border-rule/55 p-4">
          {minimumRemaining > 0 && cart.length > 0 && (
            <p className="mb-2 text-xs text-warning">Add {formatMoney(minimumRemaining)} more to reach the minimum order.</p>
          )}
          <Button size="touch" className="w-full" disabled={!cart.length || minimumRemaining > 0 || !canCheckout} onClick={onCheckout}>
            Review collection details <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

function ItemCustomiser({
  item,
  onClose,
  onAdd,
}: {
  item: PublicMenuItem;
  onClose: () => void;
  onAdd: (selected: PublicModifierOption[]) => void;
}) {
  const defaults = Object.fromEntries(
    item.modifierGroups.map((group) => {
      const options = group.options.filter((option) => option.isDefault);
      return [group.id, (group.maxSelections === null ? options : options.slice(0, group.maxSelections)).map((option) => option.id)];
    }),
  );
  const [choices, setChoices] = useState<Record<string, string[]>>(defaults);
  const selected = item.modifierGroups.flatMap((group) => group.options.filter((option) => (choices[group.id] ?? []).includes(option.id)));
  const total = Number(item.price) + selected.reduce((sum, option) => sum + Number(option.priceAdjust), 0);
  const valid = item.modifierGroups.every((group) => {
    const count = choices[group.id]?.length ?? 0;
    return count >= group.minSelections && (group.maxSelections === null || count <= group.maxSelections);
  });

  const toggle = (groupId: string, optionId: string, maximum: number | null) => {
    const current = choices[groupId] ?? [];
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : maximum === 1
        ? [optionId]
        : maximum !== null && current.length >= maximum
          ? current
          : [...current, optionId];
    setChoices({ ...choices, [groupId]: next });
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-xl bg-card shadow-xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="relative h-48 shrink-0 sm:h-56">
            <ItemImage item={item} className="h-full w-full" />
            <Button
              variant="outline"
              size="icon-touch"
              className="absolute right-3 top-3 bg-card/95"
              onClick={onClose}
              aria-label="Close item"
            >
              <X />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-2xl font-semibold tracking-tight">{item.name}</Dialog.Title>
                {item.description && (
                  <Dialog.Description className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </Dialog.Description>
                )}
              </div>
              <p className="shrink-0 font-mono font-semibold">{formatMoney(item.price)}</p>
            </div>
            <div className="mt-7 space-y-7">
              {item.modifierGroups.map((group) => {
                const count = choices[group.id]?.length ?? 0;
                const rule =
                  group.minSelections === 0
                    ? group.maxSelections === null
                      ? 'Optional · choose any'
                      : `Optional · choose up to ${group.maxSelections}`
                    : group.maxSelections === group.minSelections
                      ? `Choose ${group.minSelections}`
                      : group.maxSelections === null
                        ? `Choose at least ${group.minSelections}`
                        : `Choose at least ${group.minSelections}, up to ${group.maxSelections}`;
                const requirementId = `modifier-requirement-${group.id}`;
                return (
                  <fieldset key={group.id} aria-describedby={requirementId} aria-invalid={count < group.minSelections}>
                    <legend className="flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
                      <span>{group.name}</span>
                      <span
                        id={requirementId}
                        className={cn('text-xs', count < group.minSelections ? 'text-warning' : 'text-muted-foreground')}
                      >
                        {rule}
                      </span>
                    </legend>
                    <div className="mt-2 divide-y divide-rule/45 border-y border-rule/55">
                      {group.options.map((option) => {
                        const active = (choices[group.id] ?? []).includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(group.id, option.id, group.maxSelections)}
                            className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <span
                              className={cn(
                                'flex size-5 shrink-0 items-center justify-center border',
                                group.maxSelections === 1 ? 'rounded-full' : 'rounded-sm',
                                active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-field',
                              )}
                            >
                              {active && <Check size={13} />}
                            </span>
                            <span className="flex-1 text-sm font-medium">{option.label}</span>
                            {Number(option.priceAdjust) !== 0 && (
                              <span className="font-mono text-xs text-muted-foreground">+{formatMoney(option.priceAdjust)}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
          <div className="border-t border-rule/55 bg-card p-4 sm:p-5">
            <Button
              size="touch"
              className="w-full"
              disabled={!valid}
              aria-describedby={!valid ? 'customiser-error' : undefined}
              onClick={() => onAdd(selected)}
            >
              Add to order · {formatMoney(total)}
            </Button>
            {!valid && (
              <p id="customiser-error" className="mt-2 text-center text-xs text-warning">
                Complete each highlighted choice group before adding this item.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function QrOrderExperience({
  token,
  initialTrackingToken,
  paymentCancelled = false,
}: {
  token: string;
  initialTrackingToken: string | null;
  paymentCancelled?: boolean;
}) {
  const menu = useQuery({
    queryKey: moduleQueryKeys.ordering.key('public-qr-menu', token),
    queryFn: () => getPublicQrMenu(token),
    retry: false,
  });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<PublicMenuItem | null>(null);
  const [basketOpen, setBasketOpen] = useState(false);
  const [stage, setStage] = useState<Stage>(initialTrackingToken ? 'tracking' : 'menu');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [collectionTime, setCollectionTime] = useState('asap');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [trackingToken, setTrackingToken] = useState<string | null>(initialTrackingToken);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const orderKey = useRef(crypto.randomUUID());
  const [email, setEmail] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verification, setVerification] = useState<QrCustomerVerification | null>(null);
  const [identityError, setIdentityError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');

  const trackedOrder = useQuery({
    queryKey: moduleQueryKeys.ordering.key('public-qr-order', token, trackingToken),
    queryFn: () => getPublicQrOrder(token, trackingToken!),
    enabled: Boolean(trackingToken),
    refetchInterval: (query) => {
      const order = query.state.data;
      const paymentFinished = order && ['expired', 'failed', 'cancelled', 'refunded'].includes(order.paymentStatus);
      const collectionFinished = order && ['done', 'cancelled'].includes(order.status);
      return paymentFinished || collectionFinished ? false : 3_000;
    },
    retry: 1,
  });

  useEffect(() => {
    if (stage !== 'tracking') return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [stage]);

  const requestCode = useMutation({
    mutationFn: () => requestQrCustomerCode(token, email),
    onSuccess: (result) => {
      setChallengeToken(result.challengeToken);
      setIdentityError('');
    },
    onError: (error) => setIdentityError(error.message || 'The code could not be sent.'),
  });
  const verifyCode = useMutation({
    mutationFn: () => verifyQrCustomerCode(token, challengeToken!, code),
    onSuccess: (result) => {
      setVerification(result);
      setIdentityError('');
    },
    onError: (error) => setIdentityError(error.message || 'The code could not be verified.'),
  });
  const submitOrder = useMutation({
    mutationFn: () =>
      createPublicQrOrder(token, {
        idempotencyKey: orderKey.current,
        customerName: customerName.trim(),
        collectionTime,
        paymentMethod,
        ...(verification?.linked ? { customerLinkToken: verification.customerLinkToken } : {}),
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          quantity: line.quantity,
          modifiers: line.selected.map((option) => ({ modifierId: option.id })),
        })),
      }),
    onSuccess: (order) => {
      setTrackingToken(order.trackingToken);
      setCheckoutError('');
      const orderUrl = `/order/${encodeURIComponent(token)}?order=${encodeURIComponent(order.trackingToken)}`;
      window.history.replaceState(null, '', orderUrl);
      if (paymentMethod === 'card' && order.checkoutUrl) {
        window.location.assign(order.checkoutUrl);
        return;
      }
      setStage('tracking');
    },
    onError: (error) =>
      setCheckoutError(error instanceof Error ? error.message : 'This order could not be created. Review the details and try again.'),
  });

  if (menu.isPending)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="animate-spin" />
        <span className="sr-only">Loading menu</span>
      </div>
    );
  if (menu.isError || !menu.data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-5">
        <div className="max-w-md text-center">
          <Logo size={48} className="mx-auto" />
          <h1 className="mt-5 text-2xl font-semibold">This menu is not available</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The link may have changed, or ordering has not been enabled for this location. Ask a member of staff for the latest QR code.
          </p>
        </div>
      </main>
    );
  }

  const data = menu.data;
  const total = cart.reduce((sum, line) => sum + lineUnitTotal(line) * line.quantity, 0);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const minimum = Number(data.ordering.minimumOrderAmount);
  const groupedSlots = Object.entries(Object.groupBy(data.ordering.slots, (slot) => slot.dateLabel));
  const detailsComplete =
    cart.length > 0 &&
    total >= minimum &&
    data.ordering.canCheckout &&
    customerName.trim().length >= 2 &&
    (collectionTime === 'asap' || Boolean(collectionTime)) &&
    (paymentMethod === 'card' ? data.ordering.cardEnabled : data.ordering.cashEnabled && collectionTime === 'asap');

  const addItem = (item: PublicMenuItem, selected: PublicModifierOption[]) => {
    const key = `${item.id}:${selected
      .map((option) => option.id)
      .sort()
      .join(',')}`;
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      return existing
        ? current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line))
        : [...current, { key, item, selected, quantity: 1 }];
    });
    setSelectedItem(null);
  };
  const chooseItem = (item: PublicMenuItem) => (item.modifierGroups.length ? setSelectedItem(item) : addItem(item, []));
  const changeQuantity = (key: string, delta: number) =>
    setCart((current) =>
      current.map((line) => (line.key === key ? { ...line, quantity: line.quantity + delta } : line)).filter((line) => line.quantity > 0),
    );

  if (stage === 'tracking') {
    const order = trackedOrder.data;
    const secondsRemaining = order?.expiresAt ? Math.max(0, Math.ceil((new Date(order.expiresAt).getTime() - clockNow) / 1_000)) : 0;
    const waitingForPayment = order?.paymentStatus === 'awaiting_payment';
    const waitingForCash = order?.paymentStatus === 'awaiting_cash_approval';
    const accepted = order?.paymentStatus === 'paid';
    const awaitingKitchenRelease = Boolean(
      accepted && order?.status === 'pending' && order.kitchenReleaseAt && new Date(order.kitchenReleaseAt).getTime() > clockNow,
    );
    const title = waitingForCash
      ? 'Pay at the counter'
      : waitingForPayment
        ? 'Complete your card payment'
        : accepted
          ? awaitingKitchenRelease
            ? 'Your collection is scheduled'
            : order.status === 'pending'
              ? 'Your order is with the kitchen'
              : order.status === 'preparing'
                ? 'Your order is being prepared'
                : order.status === 'ready'
                  ? 'Ready to collect'
                  : order.status === 'done'
                    ? 'Collected'
                    : 'Order cancelled'
          : order?.paymentStatus === 'expired'
            ? 'This order expired'
            : order?.paymentStatus === 'refunded'
              ? 'Payment refunded'
              : order?.paymentStatus === 'cancelled'
                ? 'Order cancelled'
                : 'Payment was not completed';
    return (
      <main className="min-h-dvh bg-background">
        <header className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
            <Logo size={38} variant="onDark" />
            <div>
              <p className="font-semibold">{data.brand.name}</p>
              <p className="text-xs text-sidebar-foreground/70">{data.location.name}</p>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          {trackedOrder.isPending ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="animate-spin" />
              <span className="sr-only">Loading order</span>
            </div>
          ) : trackedOrder.isError || !order ? (
            <div className="rounded-lg bg-card p-6 shadow-md">
              <h1 className="text-2xl font-semibold">We could not find this order</h1>
              <p className="mt-2 text-sm text-muted-foreground">Check the link or ask a member of staff for help.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg bg-card shadow-lg">
              <div
                aria-live="polite"
                className={cn('p-6 sm:p-8', accepted ? 'bg-success/6' : waitingForCash || waitingForPayment ? 'bg-warning/6' : 'bg-band')}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Order #{order.orderNumber} · {order.customerName}
                    </p>
                  </div>
                  {accepted && <CheckCircle2 size={34} className="shrink-0 text-success" aria-hidden="true" />}
                </div>
                {(waitingForCash || waitingForPayment) && (
                  <div className="mt-5 flex items-center justify-between border-t border-current/15 pt-4">
                    <span className="text-sm font-semibold">Time remaining</span>
                    <span className="font-mono text-xl font-semibold" aria-live="polite">
                      {Math.floor(secondsRemaining / 60)}:{String(secondsRemaining % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-6 sm:p-8">
                {paymentCancelled && waitingForPayment && (
                  <p role="status" className="mb-4 rounded-md border border-warning/35 bg-warning/6 p-3 text-sm text-foreground">
                    Card payment was cancelled. Your order is still reserved, so you can reopen checkout before the timer ends.
                  </p>
                )}
                {waitingForCash && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Show this screen at the counter and pay in cash. A staff member must approve it before it enters the kitchen queue.
                  </p>
                )}
                {waitingForPayment && (
                  <div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Your order is reserved for ten minutes and enters the kitchen only after Stripe confirms payment.
                    </p>
                    {order.checkoutUrl && (
                      <Button size="touch" className="mt-4 w-full sm:w-auto" onClick={() => window.location.assign(order.checkoutUrl!)}>
                        <CreditCard />
                        Open secure Stripe checkout
                      </Button>
                    )}
                  </div>
                )}
                {accepted && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {awaitingKitchenRelease
                      ? `Payment is confirmed. The order will join the kitchen queue at ${new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: data.location.timeZone }).format(new Date(order.kitchenReleaseAt!))}.`
                      : order.status === 'ready'
                        ? `Collect from ${data.location.name}. Give the team the name ${order.customerName}.`
                        : order.status === 'done'
                          ? 'The collection has been completed.'
                          : 'This page updates automatically as your order moves through the kitchen.'}
                  </p>
                )}
                {['expired', 'failed', 'cancelled', 'refunded'].includes(order.paymentStatus) && (
                  <div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {order.paymentStatus === 'refunded'
                        ? 'Your payment has been returned to the original card.'
                        : 'No active charge remains on this order. If a late card payment completed after expiry, it is refunded automatically.'}
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        orderKey.current = crypto.randomUUID();
                        setTrackingToken(null);
                        setStage('checkout');
                        window.history.replaceState(null, '', `/order/${encodeURIComponent(token)}`);
                      }}
                    >
                      Start a new order
                    </Button>
                  </div>
                )}
                <div className="mt-7 divide-y divide-rule/45 border-y border-rule/55">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {item.quantity}× {item.name}
                        </p>
                        {item.modifiers.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">{item.modifiers.map((modifier) => modifier.name).join(', ')}</p>
                        )}
                      </div>
                      <span className="font-mono text-sm font-semibold">{formatMoney(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="font-mono text-lg font-semibold">{formatMoney(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (stage === 'checkout') {
    return (
      <main className="min-h-dvh bg-background">
        <header className="border-b border-rule/55 bg-card">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
            <Button variant="ghost" size="icon-touch" onClick={() => setStage('menu')} aria-label="Back to menu">
              <ArrowLeft />
            </Button>
            <Logo size={36} />
            <div>
              <p className="font-semibold">{data.brand.name}</p>
              <p className="text-xs text-muted-foreground">{data.location.name}</p>
            </div>
          </div>
        </header>
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-10">
          <div className="space-y-8">
            <section>
              <h1 className="text-3xl font-semibold tracking-tight">Collection details</h1>
              <p className="mt-2 text-sm text-muted-foreground">Tell the team who to call and when you plan to collect.</p>
            </section>
            <section className="space-y-4 border-y border-rule/55 py-6">
              <Input
                label="Name for collection"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                leftIcon={<User />}
                required
                maxLength={100}
                placeholder="Your name"
              />
              <div>
                <p id="collection-time-label" className="text-label uppercase text-muted-foreground">
                  Collection time
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="collection-time-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={collectionTime === 'asap'}
                    onClick={() => setCollectionTime('asap')}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-md border px-4 text-left',
                      collectionTime === 'asap' ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-card',
                    )}
                  >
                    <Clock />
                    <span>
                      <span className="block text-sm font-semibold">As soon as possible</span>
                      <span className={cn('text-xs', collectionTime === 'asap' ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                        Prepared after payment approval
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={collectionTime !== 'asap'}
                    onClick={() => {
                      setCollectionTime(data.ordering.slots[0]?.value ?? 'asap');
                      setPaymentMethod('card');
                    }}
                    disabled={!data.ordering.slots.length || !data.ordering.cardEnabled}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-md border px-4 text-left disabled:opacity-45',
                      collectionTime !== 'asap' ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-card',
                    )}
                  >
                    <Calendar />
                    <span>
                      <span className="block text-sm font-semibold">Schedule collection</span>
                      <span className={cn('text-xs', collectionTime !== 'asap' ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                        Card payment only
                      </span>
                    </span>
                  </button>
                </div>
              </div>
              {collectionTime !== 'asap' && (
                <div>
                  <label htmlFor="collection-slot" className="text-label uppercase text-muted-foreground">
                    Choose a time
                  </label>
                  <select
                    id="collection-slot"
                    value={collectionTime}
                    onChange={(event) => setCollectionTime(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-md border border-input bg-field px-3 text-base outline-none focus:outline-2 focus:outline-ring"
                  >
                    {groupedSlots.map(([dateLabel, slots]) => (
                      <optgroup key={dateLabel} label={dateLabel}>
                        {slots?.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
            </section>
            <section>
              <h2 id="payment-method-label" className="text-lg font-semibold">
                Payment
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your basket is reserved for ten minutes while payment is completed or approved.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="payment-method-label">
                {data.ordering.cardEnabled && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === 'card'}
                    onClick={() => setPaymentMethod('card')}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-md border px-4 text-left',
                      paymentMethod === 'card' ? 'border-primary bg-band' : 'border-rule bg-card',
                    )}
                  >
                    <CreditCard />
                    <span>
                      <span className="block text-sm font-semibold">Pay securely with Stripe</span>
                      <span className="text-xs text-muted-foreground">Online card checkout</span>
                    </span>
                  </button>
                )}
                {data.ordering.cashEnabled && (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={paymentMethod === 'cash'}
                    disabled={collectionTime !== 'asap'}
                    onClick={() => setPaymentMethod('cash')}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-md border px-4 text-left disabled:opacity-45',
                      paymentMethod === 'cash' ? 'border-primary bg-band' : 'border-rule bg-card',
                    )}
                  >
                    <Banknote />
                    <span>
                      <span className="block text-sm font-semibold">Cash at the counter</span>
                      <span className="text-xs text-muted-foreground">Staff approve after payment</span>
                    </span>
                  </button>
                )}
              </div>
            </section>
            <section className="border-t border-rule/55 pt-6">
              <h2 className="text-lg font-semibold">Earn loyalty points</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional. Verify your email to link this order to an existing customer profile.
              </p>
              {verification ? (
                <div className="mt-4 flex items-start gap-3 rounded-md bg-success/6 p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 text-success" />
                  <div>
                    <p className="font-semibold">
                      {verification.linked ? `Linked to ${verification.customer.firstName}` : 'Email verified'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {verification.linked
                        ? `${verification.customer.pointsBalance} points currently available. This order can earn more.`
                        : 'No existing loyalty profile was found. You can still continue as a guest.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setChallengeToken(null);
                        setVerification(null);
                      }}
                      leftIcon={<Mail />}
                      placeholder="you@example.com"
                      aria-label="Email for loyalty linking"
                      aria-describedby={identityError ? 'loyalty-verification-error' : undefined}
                      aria-invalid={Boolean(identityError)}
                    />
                    <Button variant="outline" size="touch" disabled={!email || requestCode.isPending} onClick={() => requestCode.mutate()}>
                      {requestCode.isPending && <Loader2 className="animate-spin" />}
                      <span>{requestCode.isPending ? 'Sending code' : 'Send code'}</span>
                    </Button>
                  </div>
                  {challengeToken && (
                    <div className="flex gap-2">
                      <Input
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        aria-label="Email verification code"
                        aria-describedby={identityError ? 'loyalty-verification-error' : undefined}
                        aria-invalid={Boolean(identityError)}
                      />
                      <Button size="touch" disabled={code.length !== 6 || verifyCode.isPending} onClick={() => verifyCode.mutate()}>
                        {verifyCode.isPending && <Loader2 className="animate-spin" />}
                        <span>{verifyCode.isPending ? 'Verifying' : 'Verify'}</span>
                      </Button>
                    </div>
                  )}
                  {identityError && (
                    <p id="loyalty-verification-error" role="alert" className="text-xs text-exception">
                      {identityError}
                    </p>
                  )}
                </div>
              )}
            </section>
            {checkoutError && (
              <p id="checkout-error" role="alert" className="rounded-md bg-exception/6 p-3 text-sm text-exception">
                {checkoutError}
              </p>
            )}
            <Button
              size="touch"
              className="w-full sm:w-auto"
              disabled={!detailsComplete || submitOrder.isPending}
              aria-describedby={checkoutError ? 'checkout-error' : undefined}
              onClick={() => submitOrder.mutate()}
            >
              {submitOrder.isPending ? <Loader2 className="animate-spin" /> : paymentMethod === 'card' ? <CreditCard /> : <Banknote />}
              <span>
                {submitOrder.isPending
                  ? 'Creating order…'
                  : paymentMethod === 'card'
                    ? `Continue to Stripe · ${formatMoney(total)}`
                    : `Place cash order · ${formatMoney(total)}`}
              </span>
            </Button>
          </div>
          <aside className="h-fit overflow-hidden rounded-lg bg-card shadow-md lg:sticky lg:top-6">
            <OrderDocket
              cart={cart}
              onQuantity={changeQuantity}
              onCheckout={() => undefined}
              minimum={minimum}
              canCheckout={false}
              readOnly
            />
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background pb-24 lg:pb-0">
      <div
        hidden
        dangerouslySetInnerHTML={{
          __html:
            '<!-- QR ORDERING SURFACE — THESIS: a calm counter handoff where the menu stays spacious and the live order docket never disappears; refuses the generic delivery-app tile wall. OWN-WORLD: DUMA oat, porcelain and forest with attached category rails and ledger rows. STORY: scan, browse, customise, review, identify, choose collection, pay or receive counter approval, then track the kitchen handoff. FIRST VIEWPORT: location masthead, service status, category rail and the first menu shelf beside a persistent docket. FORM: counter handoff, grounded candidate 4; seed key 727490b6. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->',
        }}
      />
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Logo size={40} variant="onDark" />
              <div>
                <p className="text-lg font-semibold leading-tight">{data.brand.name}</p>
                <p className="mt-0.5 text-xs text-sidebar-foreground/70">Order for collection</p>
              </div>
            </div>
            <span
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-semibold',
                data.ordering.canCheckout
                  ? 'border-sidebar-primary/35 text-sidebar-primary'
                  : 'border-sidebar-border text-sidebar-foreground/75',
              )}
            >
              {data.ordering.paused ? 'Orders paused' : data.ordering.isOpenNow ? 'Taking orders' : 'Browse only'}
            </span>
          </div>
          <div className={cn('mt-8 grid items-end gap-6', data.content.coverImageUrl && 'md:grid-cols-[minmax(0,1fr)_20rem]')}>
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {data.content.welcomeMessage || `Order ahead from ${data.location.name}`}
              </h1>
              <p className="mt-3 flex items-start gap-2 text-sm text-sidebar-foreground/72">
                <MapPin className="mt-0.5 shrink-0" />
                {data.location.address}
              </p>
              {data.content.collectionInstructions && (
                <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-sidebar-foreground/72">
                  {data.content.collectionInstructions}
                </p>
              )}
            </div>
            {data.content.coverImageUrl && (
              // This business-managed URL is not known at build time.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.content.coverImageUrl} alt="" className="h-36 w-full rounded-lg object-cover md:h-44" />
            )}
          </div>
        </div>
      </header>
      {!data.ordering.canCheckout && (
        <div className="border-b border-warning/30 bg-warning/6">
          <p className="mx-auto max-w-6xl px-4 py-3 text-sm text-warning sm:px-6">
            {data.ordering.paused
              ? 'This location has paused new orders. You can still browse the menu.'
              : !data.ordering.cardEnabled && !data.ordering.cashEnabled
                ? 'Online ordering is being configured. You can still browse the menu.'
                : 'The location is currently closed. You can browse now and order during opening hours.'}
          </p>
        </div>
      )}
      <div className="sticky top-0 z-20 border-b border-rule/55 bg-background/95">
        <nav className="mx-auto flex max-w-6xl overflow-x-auto px-4 py-2 sm:px-6" aria-label="Menu categories">
          <div className="flex min-w-max overflow-hidden rounded-lg border border-rule bg-card">
            {data.categories.map((category) => {
              const current = (activeCategory ?? data.categories[0]?.id) === category.id;
              return (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  aria-current={current ? 'location' : undefined}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'shrink-0 border-r border-rule px-3 py-2 text-sm font-semibold outline-none last:border-r-0 hover:bg-band focus-visible:outline-2 focus-visible:outline-ring',
                    current ? 'bg-band text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {category.name}
                </a>
              );
            })}
          </div>
        </nav>
      </div>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:py-10">
        <div className="min-w-0 space-y-12">
          {data.categories.map((category) => (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-16">
              <div className="mb-4">
                <h2 className="text-2xl font-semibold tracking-tight">{category.name}</h2>
                {category.description && <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">{category.description}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[...category.items]
                  .sort((a, b) => Number(b.featured) - Number(a.featured))
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => chooseItem(item)}
                      className="group flex min-h-36 overflow-hidden rounded-lg bg-card text-left shadow-sm outline-none transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <div className="min-w-0 flex-1 p-4">
                        {item.featured && (
                          <span className="mb-2 inline-flex rounded-sm border border-measured/40 px-1.5 py-0.5 text-label font-semibold uppercase text-measured">
                            Featured
                          </span>
                        )}
                        <h3 className="font-semibold">{item.name}</h3>
                        {item.description && (
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                        )}
                        <div className="mt-4 flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{formatMoney(item.price)}</span>
                          {item.modifierGroups.length > 0 && <span className="text-xs text-muted-foreground">Customisable</span>}
                        </div>
                      </div>
                      <ItemImage item={item} className="h-full w-28 shrink-0 sm:w-32" />
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="hidden h-[calc(100dvh-7rem)] overflow-hidden rounded-lg bg-card shadow-md lg:sticky lg:top-20 lg:block">
          <OrderDocket
            cart={cart}
            onQuantity={changeQuantity}
            onCheckout={() => setStage('checkout')}
            minimum={minimum}
            canCheckout={data.ordering.canCheckout}
          />
        </aside>
      </div>
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule/55 bg-card p-3 shadow-lg lg:hidden">
          <Button size="touch" className="w-full justify-between" onClick={() => setBasketOpen(true)}>
            <span className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground text-xs text-primary">
                {itemCount}
              </span>
              View order
            </span>
            <span>{formatMoney(total)}</span>
          </Button>
        </div>
      )}
      <Dialog.Root open={basketOpen} onOpenChange={setBasketOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/35 lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] w-full overflow-hidden rounded-t-xl bg-card shadow-xl outline-none lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-rule/55 px-3 py-2">
              <Dialog.Title className="pl-1 font-semibold">Your order</Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon-touch" aria-label="Close basket">
                  <X />
                </Button>
              </Dialog.Close>
            </div>
            <OrderDocket
              cart={cart}
              onQuantity={changeQuantity}
              minimum={minimum}
              canCheckout={data.ordering.canCheckout}
              onCheckout={() => {
                setBasketOpen(false);
                setStage('checkout');
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {selectedItem && (
        <ItemCustomiser
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAdd={(selected) => addItem(selectedItem, selected)}
        />
      )}
    </main>
  );
}
