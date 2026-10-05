'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { AlertTriangle, ArrowLeft, Banknote, Check, ChevronLeft, ChevronRight, CloudUpload, CreditCard, Loader2, Printer, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { PaymentMethod } from '@/lib/modules/payments/client';
import { cn } from '@/lib/utils/cn';
import { type KeypadKey, applyKey, cartItemTotal, changeDue, entryToMinor, formatPrice, minorToEntry, quickCash } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

export type CheckoutStep = 'method' | 'cash' | 'verify' | 'done';

interface Props {
  step: CheckoutStep;
  total: number;
  currency?: string;
  /** The ticket as it was charged — the summary on the left. */
  lines: CartItem[];
  customerName?: string;
  loyaltyReward?: { label: string; discountCents: number };
  methods: PaymentMethod[];
  busy: boolean;
  error: string | null;
  paymentLabel?: string;
  paymentProvider?: PaymentMethod['provider'];
  /** The sale is saved on this device, not yet on the server. */
  queued: boolean;
  offline: boolean;
  /** Change to hand back, on the done screen. */
  change: number;
  canPrint: boolean;
  onSelectMethod: (method: PaymentMethod) => void;
  onTender: (tendered: number) => void;
  onBack: () => void;
  onPaymentOutcome: (outcome: 'succeeded' | 'failed' | 'cancelled') => void;
  onPrint: () => void;
  onNewSale: () => void;
  onCancel: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function CheckoutFlow(props: Props) {
  const { step, total, currency = 'GBP', lines, customerName, busy, error, onCancel, onBack } = props;
  const reduceMotion = useReducedMotion();
  const amount = formatPrice(total, currency);
  const title = { method: 'Take payment', cash: 'Cash', verify: props.paymentLabel ?? 'Card', done: 'Done' }[step];
  // Hidden until asked for — the amount due is what the cashier needs to see.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  // Escape backs out of the method screen only — mid-payment it would abandon a card attempt.
  useEffect(() => {
    if (step !== 'method' || busy) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel, step]);

  return (
    // A large sheet over the dimmed till rather than a page of its own: the
    // ticket stays in view behind it. Tapping the backdrop does nothing — a
    // stray tap mid-payment must not abandon it. Full screen on a phone.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 backdrop-blur-[2px] md:p-6">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Checkout"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="flex h-full w-full flex-col overflow-hidden bg-background md:h-[min(46rem,100%)] md:max-w-5xl md:rounded-2xl md:border md:border-rule/60 md:shadow-2xl"
      >
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-rule/60 bg-card px-3 md:px-5">
        {step === 'done' ? (
          <span className="w-28" />
        ) : step === 'method' ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="h-12 w-28 justify-start gap-2 px-3 text-base">
            <X size={20} aria-hidden="true" /> Cancel
          </Button>
        ) : (
          <Button variant="ghost" onClick={onBack} disabled={busy} className="h-12 w-28 justify-start gap-2 px-3 text-base">
            <ArrowLeft size={20} aria-hidden="true" /> Back
          </Button>
        )}
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p data-figure className="w-28 text-right text-lg font-semibold tabular-nums text-foreground">{step === 'done' ? '' : amount}</p>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {step !== 'done' && (
          <motion.aside
            id="checkout-order-summary"
            aria-label="Order summary"
            aria-hidden={!summaryOpen}
            initial={false}
            animate={{ width: summaryOpen ? '20rem' : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE }}
            className={cn('shrink-0 overflow-hidden bg-card', summaryOpen && 'border-r border-rule/60')}
          >
            <div className="flex h-full w-80 flex-col">
            {customerName && <p className="shrink-0 border-b border-rule/60 px-5 py-3 text-sm text-muted-foreground">For <span className="font-medium text-foreground">{customerName}</span></p>}
            <ul className="min-h-0 flex-1 divide-y divide-rule/45 overflow-y-auto">
              {lines.map((line) => (
                <li key={line.cartId} className="flex items-start gap-3 px-5 py-3 text-sm">
                  <span data-figure className="w-6 shrink-0 font-semibold tabular-nums">{line.quantity}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{line.item.name}</span>
                    {line.selected.length > 0 && <span className="block text-muted-foreground">{line.selected.map((o) => o.label).join(' · ')}</span>}
                    {line.note && <span className="block italic text-muted-foreground">{line.note}</span>}
                  </span>
                  <span data-figure className="shrink-0 font-medium tabular-nums">{formatPrice(cartItemTotal(line), currency)}</span>
                </li>
              ))}
            </ul>
            {props.loyaltyReward && (
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-rule/60 px-5 py-3 text-sm text-primary">
                <span className="truncate">{props.loyaltyReward.label}</span>
                <span data-figure className="shrink-0 font-semibold tabular-nums">−{formatPrice(props.loyaltyReward.discountCents, currency)}</span>
              </div>
            )}
            <div className="flex shrink-0 items-baseline justify-between border-t border-rule/60 px-5 py-4">
              <span className="text-base font-medium text-muted-foreground">Total</span>
              <span data-figure className="text-2xl font-semibold tabular-nums">{amount}</span>
            </div>
            </div>
          </motion.aside>
        )}

        {step !== 'done' && (
          // The order is there when it's wanted and out of the way when it isn't:
          // a tab on the left edge slides it in.
          <button
            type="button"
            onClick={() => setSummaryOpen((open) => !open)}
            aria-expanded={summaryOpen}
            aria-controls="checkout-order-summary"
            aria-label={summaryOpen ? 'Hide the order' : `Show the order, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
            className="z-10 -ml-px flex h-20 w-10 shrink-0 touch-manipulation flex-col items-center justify-center gap-1 self-center rounded-r-xl border border-l-0 border-rule/60 bg-card text-muted-foreground transition-colors active:bg-band"
          >
            {summaryOpen ? <ChevronLeft size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
            {!summaryOpen && <span className="text-xs font-semibold tabular-nums">{itemCount}</span>}
          </button>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-5 py-6 md:px-8"
            >
              {error && (
                <p role="alert" className="mb-6 flex gap-2.5 rounded-lg border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-foreground">
                  <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />
                  {error}
                </p>
              )}
              {step === 'method' && <MethodStep {...props} amount={amount} />}
              {step === 'cash' && <CashStep {...props} />}
              {step === 'verify' && <VerifyStep {...props} amount={amount} />}
              {step === 'done' && <DoneStep {...props} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      </motion.div>
    </div>
  );
}

function MethodStep({ methods, busy, offline, onSelectMethod, amount }: Props & { amount: string }) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <>
      <p className="text-center text-sm font-medium text-muted-foreground">Amount due</p>
      <p data-figure className="mt-1 text-center text-5xl font-semibold tabular-nums tracking-tight text-foreground">{amount}</p>
      {offline && (
        <p className="mx-auto mt-4 flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1.5 text-sm font-medium text-warning">
          <CloudUpload size={15} aria-hidden="true" /> Offline — cash and manual terminal sales save on this till
        </p>
      )}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const cash = method.provider === 'cash';
          const unavailable = offline && !(cash || method.provider === 'manual_terminal');
          const spinning = busy && chosen === method.id;
          return (
            <button
              key={method.id}
              type="button"
              disabled={busy || unavailable}
              onClick={() => {
                setChosen(method.id);
                onSelectMethod(method);
              }}
              className={cn(
                'flex min-h-28 touch-manipulation flex-col items-start justify-between gap-3 rounded-xl border p-5 text-left transition-[transform,border-color] duration-100 active:scale-[0.98] disabled:opacity-45',
                cash ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 bg-card text-foreground',
              )}
            >
              <span className={cn('flex size-11 items-center justify-center rounded-lg', cash ? 'bg-primary-foreground/15' : 'bg-band')}>
                {spinning ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : cash ? <Banknote size={22} aria-hidden="true" /> : <CreditCard size={22} aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-lg font-semibold">{method.displayName}</span>
                <span className={cn('block text-sm', cash ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {unavailable ? 'Needs a connection' : cash ? 'Count it in, give change' : method.provider === 'manual_terminal' ? 'Key it into the card machine' : 'Sent to the reader'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back'];

function CashStep({ total, currency = 'GBP', busy, onTender }: Props) {
  const [entry, setEntry] = useState('');
  const tendered = entry ? entryToMinor(entry) : total;
  const { change, short } = changeDue(tendered, total);
  const suggestions = quickCash(total, currency);

  // A hardware keyboard or a USB numpad works too.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy) return;
      if (/^\d$/.test(event.key)) setEntry((current) => applyKey(current, event.key as KeypadKey));
      else if (event.key === 'Backspace') setEntry((current) => applyKey(current, 'back'));
      else if (event.key === 'Escape') setEntry('');
      else if (event.key === 'Enter' && short === 0) onTender(tendered);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onTender, short, tendered]);

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Cash received</p>
          <p data-figure aria-live="polite" className={cn('mt-1 text-5xl font-semibold tabular-nums tracking-tight', entry ? 'text-foreground' : 'text-muted-foreground/50')}>
            {formatPrice(tendered, currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-muted-foreground">{short > 0 ? 'Still due' : 'Change'}</p>
          <p data-figure className={cn('mt-1 text-3xl font-semibold tabular-nums', short > 0 ? 'text-exception' : change > 0 ? 'text-success' : 'text-muted-foreground')}>
            {formatPrice(short > 0 ? short : change, currency)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        {suggestions.map((value, index) => (
          <Button
            key={value}
            variant={entryToMinor(entry) === value || (!entry && index === 0) ? 'default' : 'outline'}
            onClick={() => setEntry(minorToEntry(value))}
            disabled={busy}
            className="h-14 flex-col gap-0 text-base font-semibold tabular-nums"
          >
            {index === 0 ? <><span className="text-xs font-medium opacity-80">Exact</span>{formatPrice(value, currency)}</> : formatPrice(value, currency)}
          </Button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Keypad">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => setEntry((current) => applyKey(current, key))}
            onContextMenu={(event) => {
              // Long-press on the back key clears.
              if (key !== 'back') return;
              event.preventDefault();
              setEntry('');
            }}
            aria-label={key === 'back' ? 'Delete last digit' : key}
            className="flex h-16 touch-manipulation select-none items-center justify-center rounded-xl border border-rule/60 bg-card text-2xl font-medium tabular-nums text-foreground transition-[transform,background-color] duration-75 active:scale-[0.97] active:bg-band disabled:opacity-50"
          >
            {key === 'back' ? <ArrowLeft size={24} aria-hidden="true" /> : key}
          </button>
        ))}
      </div>

      <Button onClick={() => onTender(tendered)} disabled={busy || short > 0} className="mt-5 h-16 w-full justify-between px-5 text-lg">
        {busy ? (
          <span className="flex items-center gap-2"><Loader2 className="animate-spin" aria-hidden="true" /> Recording the sale…</span>
        ) : (
          <>
            <span>{short > 0 ? `${formatPrice(short, currency)} short` : 'Take cash'}</span>
            {short === 0 && <span data-figure className="tabular-nums">{change > 0 ? `Change ${formatPrice(change, currency)}` : 'No change'}</span>}
          </>
        )}
      </Button>
    </>
  );
}

function VerifyStep({ paymentLabel, queued, offline, busy, onPaymentOutcome, amount }: Props & { amount: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="text-center">
      <motion.span
        className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary/8 text-primary"
        animate={reduceMotion ? undefined : { scale: [1, 1.05, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        <CreditCard size={36} />
      </motion.span>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">
        Take <span data-figure className="tabular-nums">{amount}</span> on {paymentLabel ?? 'the terminal'}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
        Wait for the machine to say <span className="font-medium text-foreground">approved</span>. Never confirm a declined, cancelled or uncertain payment.
        {(offline || queued) && ' The sale saves on this till and sends when the connection returns.'}
      </p>
      <div className="mt-10 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => onPaymentOutcome('failed')} disabled={busy} className="h-16 gap-2 text-lg text-destructive hover:text-destructive">
          <X size={20} aria-hidden="true" /> Declined
        </Button>
        <Button onClick={() => onPaymentOutcome('succeeded')} disabled={busy} className="h-16 gap-2 text-lg">
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check size={20} aria-hidden="true" />} Approved
        </Button>
      </div>
      <Button variant="ghost" onClick={() => onPaymentOutcome('cancelled')} disabled={busy} className="mt-4 h-12 text-base text-muted-foreground">
        Use another method
      </Button>
    </div>
  );
}

function DoneStep({ total, currency = 'GBP', queued, change, canPrint, onPrint, onNewSale }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="text-center">
      <motion.span
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        className={cn('mx-auto flex size-20 items-center justify-center rounded-full', queued ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}
        aria-hidden="true"
      >
        {queued ? <CloudUpload size={38} /> : <Check size={40} strokeWidth={2.5} />}
      </motion.span>

      {change > 0 ? (
        <>
          <p className="mt-6 text-base font-medium text-muted-foreground">Change to give</p>
          <p data-figure className="mt-1 text-7xl font-semibold tabular-nums tracking-tight text-foreground">{formatPrice(change, currency)}</p>
          <p className="mt-3 text-base text-muted-foreground">
            {formatPrice(total, currency)} paid · {queued ? 'saved on this till' : 'payment complete'}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{queued ? 'Saved on this till' : 'Payment complete'}</h2>
          <p data-figure className="mt-2 text-base tabular-nums text-muted-foreground">{formatPrice(total, currency)} paid</p>
        </>
      )}
      {queued && <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">It sends automatically when the connection returns. The receipt is available once it has.</p>}

      <div className="mt-10 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Button variant="outline" onClick={onPrint} disabled={!canPrint} className="h-16 gap-2 px-6 text-base">
          <Printer size={20} aria-hidden="true" /> Print receipt
        </Button>
        <Button onClick={onNewSale} autoFocus className="h-16 text-lg">
          New sale
        </Button>
      </div>
    </div>
  );
}
