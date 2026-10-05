'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calculator,
  CheckCircle2,
  CloudUpload,
  Coins,
  CreditCard,
  EyeOff,
  History,
  Loader2,
  Lock,
  Minus,
  Play,
  Plus,
  Receipt,
  Wallet,
} from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { type CashUp, closeCashUp, getCashUpExpectation, getCashUps, openCashUp } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type Counts,
  EXPLAIN_FROM_MINOR,
  balanceOf,
  countMinor,
  denominationsFor,
  needsExplanation,
  parseMinor,
  toMinor,
} from '@/lib/utils/cash-count';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * Cashing up, at the till — where Toast, Lightspeed and Square all keep it:
 * the person closing is standing at the drawer. A status button in the till's
 * header and a nudge when the day isn't open lead to one drawer that opens the
 * day with a float, and closes it in four steps — check, count the cash, read
 * the card terminal, review — with the count taken blind and a note required
 * when it doesn't balance.
 *
 * The blind count is a habit, not a control: the expectation endpoint is
 * readable by anyone with `cashups:read`. The API is what records the close.
 */

const DATE = (key: string, style: 'short' | 'long' = 'short') =>
  new Date(`${key.slice(0, 10)}T12:00:00`).toLocaleDateString(
    'en-GB',
    style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' },
  );
const TIME = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Today where the site is, not where the browser is — a trading day belongs to the site. */
export function tradingDateIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const invalidateCashUps = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('cashups') });
  void qc.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('cash-ups-report') });
};

// ── The day's state ──────────────────────────────────────────────────────────

export type CashUpStatus = 'hidden' | 'loading' | 'not-open' | 'open' | 'stale' | 'closed';

/** Where the site's trading day stands: not opened, open, left open from an earlier day, or closed for today. */
export function useCashUpDay(locationId: string | null | undefined, timezone: string) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'cashups:write');
  const rows = useQuery({
    queryKey: moduleQueryKeys.payments.key('cashups', locationId),
    queryFn: () => getCashUps(locationId!),
    enabled: !!locationId && canWrite,
  });
  const today = tradingDateIn(timezone);
  const open = rows.data?.find((row) => row.status === 'open') ?? null;
  const closedToday = rows.data?.find((row) => row.status === 'closed' && row.tradingDate.slice(0, 10) === today) ?? null;
  const status: CashUpStatus =
    !locationId || !canWrite
      ? 'hidden'
      : rows.isPending || rows.isError
        ? 'loading'
        : open
          ? open.tradingDate.slice(0, 10) < today
            ? 'stale'
            : 'open'
          : closedToday
            ? 'closed'
            : 'not-open';
  return { rows, open, closedToday, today, status };
}

const STATUS_LOOK: Record<Exclude<CashUpStatus, 'hidden'>, { label: string; dot: string }> = {
  loading: { label: 'Cash up', dot: 'bg-muted-foreground/40' },
  'not-open': { label: 'Open the day', dot: 'bg-warning' },
  open: { label: 'Cash up', dot: 'bg-momentum' },
  stale: { label: 'Close yesterday', dot: 'bg-exception' },
  closed: { label: 'Day closed', dot: 'bg-muted-foreground/50' },
};

/** The till header's way in: what state the day is in, at a glance. */
export function CashUpButton({ status, onOpen }: { status: CashUpStatus; onOpen: () => void }) {
  if (status === 'hidden') return null;
  const look = STATUS_LOOK[status];
  return (
    <Button variant="outline" className="h-9 gap-2" onClick={onOpen} aria-haspopup="dialog">
      <span className={cn('size-2 rounded-full', look.dot)} aria-hidden="true" />
      <Calculator size={15} className="text-muted-foreground" aria-hidden="true" />
      {look.label}
    </Button>
  );
}

/** A line at the top of the till when the day needs a manager: not opened yet, or left open from before. */
export function CashUpNudge({ status, open, onOpen }: { status: CashUpStatus; open: CashUp | null; onOpen: () => void }) {
  if (status !== 'not-open' && status !== 'stale') return null;
  const stale = status === 'stale';
  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
        stale ? 'border-exception/30 bg-exception/5' : 'border-warning/35 bg-warning/8',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          stale ? 'bg-exception/10 text-exception' : 'bg-warning/15 text-warning',
        )}
        aria-hidden="true"
      >
        {stale ? <AlertTriangle size={17} /> : <Wallet size={17} />}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold text-foreground">
          {stale && open ? `${DATE(open.tradingDate, 'long')} was never closed` : 'The day isn’t open yet'}
        </span>
        <span className="block text-muted-foreground">
          {stale ? 'Count the drawer and close it before opening today.' : 'Count the float into the drawer to start the day.'}
        </span>
      </span>
      <Button onClick={onOpen} className="h-10 gap-1.5 px-4">
        {stale ? 'Close it now' : 'Open the day'}
        <ArrowRight size={15} aria-hidden="true" />
      </Button>
    </div>
  );
}

// ── The drawer ───────────────────────────────────────────────────────────────

interface DrawerProps {
  locationId: string;
  locationName: string;
  timezone: string;
  currency: string;
  /** Tickets parked on this till — their sales aren't taken yet. */
  heldCount: number;
  /** Sales saved offline and not yet sent — missing from what the till expects. */
  queuedCount: number;
  onClose: () => void;
}

export function CashUpDrawer(props: DrawerProps) {
  const { locationId, timezone, onClose } = props;
  const { rows, open, closedToday, today } = useCashUpDay(locationId, timezone);
  // The day just closed here — kept so the summary stays up after the list refetches.
  const [closed, setClosed] = useState<CashUp | null>(null);

  const description = `${props.locationName} · ${DATE(open?.tradingDate ?? today, 'long')}`;

  if (closed || (closedToday && !open)) {
    return <ClosedSummary day={(closed ?? closedToday)!} description={description} justNow={!!closed} onClose={onClose} />;
  }
  if (rows.isError) {
    return (
      <Drawer title="Cash up" description={props.locationName} onClose={onClose}>
        <ErrorState title="The day’s cash-up couldn’t be loaded" onRetry={() => void rows.refetch()} />
      </Drawer>
    );
  }
  if (rows.isPending) {
    return (
      <Drawer title="Cash up" description={props.locationName} onClose={onClose}>
        <div className="space-y-3" aria-label="Loading">
          <div className="h-20 animate-pulse rounded-lg bg-band/60" />
          <div className="h-64 animate-pulse rounded-lg bg-band/50" />
        </div>
      </Drawer>
    );
  }
  if (open) return <CloseFlow {...props} day={open} today={today} description={description} onClosed={setClosed} />;
  return <OpenFlow {...props} rows={rows.data ?? []} today={today} description={description} />;
}

// ── Counting ─────────────────────────────────────────────────────────────────

type CountMode = 'coins' | 'total';

interface CountState {
  mode: CountMode;
  counts: Counts;
  typed: string;
}

function useCount(initialTyped = '', initialMode: CountMode = 'coins'): [CountState, (next: Partial<CountState>) => void, number | null] {
  const [state, setState] = useState<CountState>({ mode: initialMode, counts: {}, typed: initialTyped });
  const update = (next: Partial<CountState>) => setState((current) => ({ ...current, ...next }));
  const value = state.mode === 'coins' ? countMinor(state.counts) : parseMinor(state.typed);
  return [state, update, value];
}

/**
 * Count a drawer note by note and coin by coin — the counter Lightspeed and
 * Toast build in and Square's sellers ask for — or type a total. The total
 * leads, large, so the count can be checked against the stack in hand.
 */
function CashCounter({
  currency,
  state,
  onChange,
  value,
  label,
}: {
  currency: string;
  state: CountState;
  onChange: (next: Partial<CountState>) => void;
  value: number | null;
  label: string;
}) {
  const money = useWorkspaceMoney();
  const denominations = denominationsFor(currency);
  const mode = denominations ? state.mode : 'total';
  const set = (denomination: number, quantity: number) =>
    onChange({ counts: { ...state.counts, [denomination]: Math.max(0, Math.min(9999, quantity)) } });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-title tabular-nums text-foreground" aria-live="polite">
            {value === null ? '—' : money(value / 100)}
          </p>
        </div>
        {denominations && (
          <SegmentedControl<CountMode>
            options={[
              { value: 'coins', label: 'Notes & coins' },
              { value: 'total', label: 'Total' },
            ]}
            value={mode}
            onChange={(next) => onChange({ mode: next })}
            ariaLabel="How to count"
          />
        )}
      </div>

      {mode === 'total' || !denominations ? (
        <Input
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          value={state.typed}
          onChange={(event) => onChange({ typed: event.target.value })}
          error={state.typed !== '' && value === null ? 'Enter an amount like 120.50' : undefined}
          leftIcon={<Banknote size={14} />}
          className="h-12 text-lg tabular-nums"
        />
      ) : (
        (['note', 'coin'] as const).map((kind) => {
          const group = denominations.filter((entry) => entry.kind === kind);
          if (group.length === 0) return null;
          const subtotal = countMinor(Object.fromEntries(group.map((entry) => [entry.value, state.counts[entry.value] ?? 0])));
          return (
            <section key={kind} aria-label={kind === 'note' ? 'Notes' : 'Coins'}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <h3 className="text-xs font-semibold text-foreground">{kind === 'note' ? 'Notes' : 'Coins'}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{money(subtotal / 100)}</span>
              </div>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {group.map((entry) => {
                  const quantity = state.counts[entry.value] ?? 0;
                  return (
                    <li key={entry.value} className="flex items-center gap-3 border-b border-rule/45 px-3 py-2 last:border-b-0">
                      <span
                        className={cn(
                          'flex h-8 w-14 shrink-0 items-center justify-center text-sm font-semibold tabular-nums',
                          kind === 'note' ? 'rounded-sm bg-momentum/8 text-momentum' : 'rounded-full bg-band text-foreground',
                        )}
                      >
                        {entry.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <StepButton
                          label={`One fewer ${entry.label}`}
                          disabled={quantity === 0}
                          onClick={() => set(entry.value, quantity - 1)}
                        >
                          <Minus size={14} />
                        </StepButton>
                        <input
                          inputMode="numeric"
                          aria-label={`Number of ${entry.label} ${kind === 'note' ? 'notes' : 'coins'}`}
                          value={quantity === 0 ? '' : String(quantity)}
                          placeholder="0"
                          onFocus={(event) => event.target.select()}
                          onChange={(event) => set(entry.value, Number(event.target.value.replace(/\D/g, '')) || 0)}
                          className="h-10 w-14 rounded-md border border-input bg-field text-center text-base tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured"
                        />
                        <StepButton label={`One more ${entry.label}`} onClick={() => set(entry.value, quantity + 1)}>
                          <Plus size={14} />
                        </StepButton>
                      </div>
                      <span
                        className={cn(
                          'ml-auto text-sm tabular-nums',
                          quantity ? 'font-medium text-foreground' : 'text-muted-foreground/60',
                        )}
                      >
                        {money((entry.value * quantity) / 100)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

// ── Opening ──────────────────────────────────────────────────────────────────

function OpenFlow({
  locationId,
  currency,
  rows,
  today,
  description,
  onClose,
}: DrawerProps & { rows: CashUp[]; today: string; description: string }) {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const last = [...rows].filter((row) => row.status === 'closed').sort((a, b) => b.tradingDate.localeCompare(a.tradingDate))[0];
  // Floats are usually the same every day: start from the last one, typed.
  const usual = last ? toMinor(last.openingFloat) : 10000;
  const [count, setCount, value] = useCount((usual / 100).toFixed(2), 'total');

  const open = useMutation({
    mutationFn: () => openCashUp({ locationId, tradingDate: today, openingFloat: value! / 100 }),
    onSuccess: () => {
      invalidateCashUps(qc);
      toast('success', 'The day is open. Good trading.');
      onClose();
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The day wasn’t opened. Try again.'),
  });

  return (
    <Drawer
      title="Open the day"
      description={description}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={open.isPending}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1 gap-1.5" disabled={value === null || open.isPending} onClick={() => open.mutate()}>
            {open.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {open.isPending ? 'Opening…' : value === null ? 'Open the day' : `Open with ${money(value / 100)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Put the float in the drawer and confirm it here. The till expects this much cash before the first sale.
        </p>
        <CashCounter currency={currency} state={count} onChange={setCount} value={value} label="Opening float" />
        {last && (
          <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <History size={13} aria-hidden="true" />
            Last close {DATE(last.tradingDate)} — float {money(last.openingFloat)},{' '}
            {needsExplanation(toMinor(last.cashVariance), toMinor(last.cardVariance)) ? 'didn’t balance' : 'balanced'}.
          </p>
        )}
      </div>
    </Drawer>
  );
}

// ── Closing ──────────────────────────────────────────────────────────────────

type Step = 'check' | 'cash' | 'card' | 'review';
const STEPS: { id: Step; label: string }[] = [
  { id: 'check', label: 'Check' },
  { id: 'cash', label: 'Count cash' },
  { id: 'card', label: 'Card total' },
  { id: 'review', label: 'Review' },
];

function CloseFlow({
  day,
  today,
  currency,
  heldCount,
  queuedCount,
  description,
  onClose,
  onClosed,
}: DrawerProps & { day: CashUp; today: string; description: string; onClosed: (day: CashUp) => void }) {
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const [step, setStep] = useState<Step>('check');
  const [cash, setCash, cashMinor] = useCount();
  const [card, setCard] = useState('');
  const [note, setNote] = useState('');
  const cardMinor = parseMinor(card);
  const index = STEPS.findIndex((entry) => entry.id === step);
  const stale = day.tradingDate.slice(0, 10) < today;

  // Fetched only at review: the count is taken blind, and the figure is as of now.
  const expectation = useQuery({
    queryKey: moduleQueryKeys.payments.key('cashups', day.locationId, 'expected', day.id),
    queryFn: () => getCashUpExpectation(day.id),
    enabled: step === 'review',
    staleTime: 0,
  });
  const expectedCash = expectation.data ? toMinor(expectation.data.expectedCash) : null;
  const expectedCard = expectation.data ? toMinor(expectation.data.expectedCard) : null;
  const explain =
    expectedCash !== null && expectedCard !== null && cashMinor !== null && cardMinor !== null
      ? needsExplanation(cashMinor - expectedCash, cardMinor - expectedCard)
      : false;

  const close = useMutation({
    mutationFn: () =>
      closeCashUp(day.id, { countedCash: cashMinor! / 100, terminalCardTotal: cardMinor! / 100, notes: note.trim() || undefined }),
    onSuccess: (row) => {
      invalidateCashUps(qc);
      onClosed(row);
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The day wasn’t closed. Check the figures and try again.'),
  });

  const canContinue = step === 'check' || (step === 'cash' && cashMinor !== null) || (step === 'card' && cardMinor !== null);
  const canClose = !!expectation.data && cashMinor !== null && cardMinor !== null && (!explain || note.trim() !== '') && !close.isPending;

  return (
    <Drawer
      title={stale ? 'Close an earlier day' : 'Close the day'}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 gap-1.5"
            onClick={() => (index === 0 ? onClose() : setStep(STEPS[index - 1].id))}
            disabled={close.isPending}
          >
            {index > 0 && <ArrowLeft size={15} aria-hidden="true" />}
            {index === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step === 'review' ? (
            <Button size="lg" className="flex-1 gap-1.5" disabled={!canClose} onClick={() => close.mutate()}>
              {close.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
              {close.isPending ? 'Closing…' : 'Close the day'}
            </Button>
          ) : (
            <Button size="lg" className="flex-1 gap-1.5" disabled={!canContinue} onClick={() => setStep(STEPS[index + 1].id)}>
              {step === 'check' && queuedCount > 0 ? 'Count anyway' : 'Continue'}
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          )}
        </div>
      }
    >
      <ol className="mb-5 grid grid-cols-4 gap-1.5" aria-label="Steps">
        {STEPS.map((entry, position) => (
          <li key={entry.id} aria-current={entry.id === step ? 'step' : undefined}>
            <span className={cn('block h-1 rounded-full', position <= index ? 'bg-primary' : 'bg-band')} />
            <span
              className={cn(
                'mt-1.5 block truncate text-xs',
                entry.id === step
                  ? 'font-semibold text-foreground'
                  : position < index
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/60',
              )}
            >
              {entry.label}
            </span>
          </li>
        ))}
      </ol>

      {step === 'check' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Opened{day.openedAt ? ` at ${TIME(day.openedAt)}` : ''} with a {money(day.openingFloat)} float. Before you count:
          </p>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {stale && (
              <CheckRow
                tone="exception"
                icon={AlertTriangle}
                title={`This is ${DATE(day.tradingDate, 'long')}`}
                detail="It was never closed. Count what’s in the drawer now; today opens once it’s done."
              />
            )}
            <CheckRow
              tone={queuedCount > 0 ? 'exception' : 'ok'}
              icon={queuedCount > 0 ? CloudUpload : CheckCircle2}
              title={
                queuedCount > 0
                  ? `${queuedCount} ${queuedCount === 1 ? 'sale hasn’t' : 'sales haven’t'} reached the server`
                  : 'Every sale has been sent'
              }
              detail={
                queuedCount > 0
                  ? 'They’re missing from what the till expects, so the count will look over. Wait for them to send.'
                  : 'What the till expects includes everything taken here.'
              }
            />
            <CheckRow
              tone={heldCount > 0 ? 'warning' : 'ok'}
              icon={heldCount > 0 ? Receipt : CheckCircle2}
              title={heldCount > 0 ? `${heldCount} ${heldCount === 1 ? 'ticket is' : 'tickets are'} still held` : 'No held tickets'}
              detail={
                heldCount > 0
                  ? 'Take payment or discard them — a held ticket isn’t a sale yet.'
                  : 'Nothing is waiting to be paid on this till.'
              }
            />
            <CheckRow
              tone="info"
              icon={EyeOff}
              title="You’ll count first"
              detail="What the till expects is shown after you’ve counted, so the count stays honest."
            />
          </ul>
        </div>
      )}

      {step === 'cash' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Count everything in the drawer, float included.</p>
          <CashCounter currency={currency} state={cash} onChange={setCash} value={cashMinor} label="Cash in the drawer" />
        </div>
      )}

      {step === 'card' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Run the end-of-day report on the card terminal and enter its total. No terminal? Enter 0.
          </p>
          <Input
            label="Card terminal total"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={card}
            onChange={(event) => setCard(event.target.value)}
            error={card !== '' && cardMinor === null ? 'Enter an amount like 842.10' : undefined}
            hint="The total on the terminal’s end-of-day (Z) print"
            leftIcon={<CreditCard size={14} />}
            className="h-12 text-lg tabular-nums"
          />
        </div>
      )}

      {step === 'review' &&
        (expectation.isError ? (
          <ErrorState title="What the till expects couldn’t be loaded" onRetry={() => void expectation.refetch()} />
        ) : expectation.isPending || expectedCash === null || expectedCard === null ? (
          <div className="space-y-3" aria-label="Loading">
            <div className="h-28 animate-pulse rounded-lg bg-band/60" />
            <div className="h-40 animate-pulse rounded-lg bg-band/50" />
          </div>
        ) : (
          <div className="space-y-5">
            <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              <ReconRow icon={Banknote} label="Cash" counted={cashMinor ?? 0} expected={expectedCash} onEdit={() => setStep('cash')} />
              <ReconRow icon={CreditCard} label="Card" counted={cardMinor ?? 0} expected={expectedCard} onEdit={() => setStep('card')} />
            </ul>

            <Breakdown tenders={expectation.data.tenderSummary} openingFloat={expectation.data.openingFloat} />

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">
                {explain ? 'What happened?' : 'Note'}{' '}
                <span className="font-normal text-muted-foreground">
                  {explain ? `— needed when it’s out by ${money(EXPLAIN_FROM_MINOR / 100)} or more` : '(optional)'}
                </span>
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                placeholder={explain ? 'e.g. £5 paid out for milk, receipt in the drawer' : 'Anything the next shift should know'}
                className="min-h-24 w-full rounded-md border border-input bg-field p-3 text-sm leading-relaxed text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured"
              />
            </label>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Closing records these figures for {DATE(day.tradingDate, 'long')}. A closed day can’t be reopened.
            </p>
          </div>
        ))}
    </Drawer>
  );
}

const CHECK_TONE = {
  ok: 'bg-momentum/10 text-momentum',
  warning: 'bg-warning/12 text-warning',
  exception: 'bg-exception/8 text-exception',
  info: 'bg-band text-muted-foreground',
} as const;

function CheckRow({
  tone,
  icon: Icon,
  title,
  detail,
}: {
  tone: keyof typeof CHECK_TONE;
  icon: typeof CheckCircle2;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', CHECK_TONE[tone])} aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}

const BALANCE_LOOK = {
  balanced: { pill: 'bg-momentum/10 text-momentum', tile: 'bg-momentum/10 text-momentum' },
  over: { pill: 'bg-measured/10 text-measured', tile: 'bg-measured/10 text-measured' },
  short: { pill: 'bg-exception/8 text-exception', tile: 'bg-exception/8 text-exception' },
} as const;

function BalancePill({ difference }: { difference: number }) {
  const money = useWorkspaceMoney();
  const { balance } = balanceOf(difference, 0);
  return (
    <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums', BALANCE_LOOK[balance].pill)}>
      {balance === 'balanced' ? 'Balanced' : `${balance === 'over' ? 'Over' : 'Short'} ${money(Math.abs(difference) / 100)}`}
    </span>
  );
}

function ReconRow({
  icon: Icon,
  label,
  counted,
  expected,
  onEdit,
}: {
  icon: typeof Banknote;
  label: string;
  counted: number;
  expected: number;
  onEdit: () => void;
}) {
  const money = useWorkspaceMoney();
  const { balance, difference } = balanceOf(counted, expected);
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', BALANCE_LOOK[balance].tile)} aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <BalancePill difference={difference} />
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
          Counted {money(counted / 100)} · expected {money(expected / 100)}
        </span>
      </span>
      <button type="button" onClick={onEdit} className="shrink-0 rounded-sm px-1.5 py-1 text-xs font-semibold text-primary hover:underline">
        Recount
      </button>
    </li>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  cash: 'Cash sales',
  unknown: 'Refunds with no method recorded',
};
const providerLabel = (provider: string) =>
  PROVIDER_LABEL[provider] ?? provider.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());

/** Where the expectation comes from: the float, then each tender net of refunds. */
function Breakdown({ tenders, openingFloat }: { tenders: Record<string, number>; openingFloat: string }) {
  const money = useWorkspaceMoney();
  const lines = Object.entries(tenders).sort(([a], [b]) => (a === 'cash' ? -1 : b === 'cash' ? 1 : a.localeCompare(b)));
  return (
    <section aria-labelledby="cash-up-breakdown">
      <h3 id="cash-up-breakdown" className="mb-1.5 px-1 text-xs font-semibold text-foreground">
        What the till expects
      </h3>
      <dl className="overflow-hidden rounded-lg border border-rule/60 bg-card text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-rule/45 px-3.5 py-2.5">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Wallet size={14} aria-hidden="true" /> Opening float
          </dt>
          <dd className="tabular-nums text-foreground">{money(openingFloat)}</dd>
        </div>
        {lines.length === 0 ? (
          <p className="px-3.5 py-2.5 text-xs text-muted-foreground">No payments taken this day.</p>
        ) : (
          lines.map(([provider, total]) => (
            <div key={provider} className="flex items-center justify-between gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
              <dt className="flex items-center gap-2 text-muted-foreground">
                {provider === 'cash' ? <Coins size={14} aria-hidden="true" /> : <CreditCard size={14} aria-hidden="true" />}
                {providerLabel(provider)}
              </dt>
              <dd className={cn('tabular-nums', total < 0 ? 'text-exception' : 'text-foreground')}>{money(total)}</dd>
            </div>
          ))
        )}
      </dl>
    </section>
  );
}

// ── Closed ───────────────────────────────────────────────────────────────────

function ClosedSummary({
  day,
  description,
  justNow,
  onClose,
}: {
  day: CashUp;
  description: string;
  justNow: boolean;
  onClose: () => void;
}) {
  const money = useWorkspaceMoney();
  const cash = toMinor(day.cashVariance);
  const card = toMinor(day.cardVariance);
  const balanced = cash === 0 && card === 0;
  const total = cash + card;

  return (
    <Drawer
      title={justNow ? 'Day closed' : 'Today is closed'}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="lg" className="flex-1 gap-1.5">
            <Link href="/reports/end-of-day">
              <History size={15} aria-hidden="true" />
              History
            </Link>
          </Button>
          <Button size="lg" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center px-4 py-4 text-center">
          <span
            className={cn(
              'flex size-14 items-center justify-center rounded-2xl',
              balanced ? BALANCE_LOOK.balanced.tile : total > 0 ? BALANCE_LOOK.over.tile : BALANCE_LOOK.short.tile,
            )}
            aria-hidden="true"
          >
            {balanced ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
          </span>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {balanced ? 'Balanced to the penny' : `${total > 0 ? 'Over' : 'Short'} by ${money(Math.abs(total) / 100)}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {justNow ? 'Recorded.' : `Closed${day.closedAt ? ` at ${TIME(day.closedAt)}` : ''}.`} The next day opens{' '}
            {justNow ? 'whenever you’re ready' : 'tomorrow'}.
          </p>
        </div>

        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <SummaryRow icon={Banknote} label="Cash" counted={day.countedCash} expected={day.expectedCash} difference={cash} />
          <SummaryRow icon={CreditCard} label="Card" counted={day.terminalCardTotal} expected={day.expectedCard} difference={card} />
        </ul>

        {day.notes && (
          <div className="rounded-lg border border-rule/60 bg-field px-3.5 py-3">
            <p className="text-xs font-semibold text-foreground">Note</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{day.notes}</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  counted,
  expected,
  difference,
}: {
  icon: typeof Banknote;
  label: string;
  counted?: string;
  expected: string;
  difference: number;
}) {
  const money = useWorkspaceMoney();
  const { balance } = balanceOf(difference, 0);
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', BALANCE_LOOK[balance].tile)} aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
          Counted {money(counted)} · expected {money(expected)}
        </span>
      </span>
      <BalancePill difference={difference} />
    </li>
  );
}
