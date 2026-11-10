'use client';

import { useId, useState } from 'react';

import { Banknote, ChevronDown, Coins, Minus, Plus } from '@/components/icons';

import { type Counts, balanceOf, countMinor, denominationsFor, needsExplanation, parseMinor } from '@/lib/utils/cash-count';
import { bankingMinor, expectedCashMinor } from '@/lib/utils/cash-up-calculator';
import { cn } from '@/lib/utils/cn';

/** The currencies cash-count.ts knows the notes and coins of. */
const CURRENCIES = [
  { code: 'GBP', label: '£ Pound sterling', symbol: '£' },
  { code: 'EUR', label: '€ Euro', symbol: '€' },
  { code: 'USD', label: '$ US dollar', symbol: '$' },
  { code: 'UAH', label: '₴ Hryvnia', symbol: '₴' },
] as const;
type Currency = (typeof CURRENCIES)[number]['code'];

/** The glossary's example drawer, in pounds: £412.50 expected, £402.50 counted — £10 short. */
const EXAMPLE_COUNTS: Counts = { 2000: 10, 1000: 8, 500: 10, 200: 10, 100: 25, 50: 20, 20: 40, 10: 50, 5: 40, 2: 50, 1: 150 };
const EXAMPLE_TILL = { float: '150.00', cashSales: '262.50', paidOut: '', cardSales: '1184.20', cardMachine: '1184.20', keepFloat: '' };

const FIELD =
  'h-10 w-full rounded-lg border border-[var(--mkt-line)] bg-white px-3 text-[0.9375rem] text-foreground tabular-nums outline-none placeholder:text-[var(--mkt-ink-3)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-transparent';

/** Minor units as money in the chosen currency: £402.50, €402.50, $402.50. */
const formatter = (currency: Currency) => {
  const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
  return (minor: number) => format.format(minor / 100);
};

type Till = typeof EXAMPLE_TILL;

/**
 * The free cash-up calculator — a client island on /tools/cash-up-calculator.
 * Count the drawer note by note and coin by coin on the left; on the right,
 * what should be there, whether it is over or short, and what to bank. The
 * counting and the over / short come from lib/utils/cash-count.ts, the same
 * arithmetic as DUMA's till cash-up. Nothing typed here leaves the browser.
 */
export function CashUpCalculator() {
  const uid = useId();
  const [counts, setCounts] = useState<Counts>(EXAMPLE_COUNTS);
  const [till, setTill] = useState<Till>(EXAMPLE_TILL);
  const [currency, setCurrency] = useState<Currency>('GBP');

  const DENOMINATIONS = denominationsFor(currency)!;
  const symbol = CURRENCIES.find((c) => c.code === currency)!.symbol;
  const gbp = formatter(currency);
  const signed = (minor: number) => `${minor > 0 ? '+' : minor < 0 ? '−' : ''}${gbp(Math.abs(minor))}`;
  // Keep only the counts the new currency has a note or coin for, so none adds to a total it can't show.
  const changeCurrency = (next: Currency) => {
    const values = new Set(denominationsFor(next)!.map((d) => d.value));
    setCounts((current) => Object.fromEntries(Object.entries(current).filter(([value]) => values.has(Number(value)))));
    setCurrency(next);
  };

  const counted = countMinor(counts);
  const float = parseMinor(till.float);
  const cashSales = parseMinor(till.cashSales);
  const paidOut = parseMinor(till.paidOut) ?? 0;
  const expected =
    float === null || cashSales === null
      ? null
      : expectedCashMinor({ floatMinor: float, cashSalesMinor: cashSales, paidOutMinor: paidOut });
  const cash = expected === null ? null : balanceOf(counted, expected);
  const cardSales = parseMinor(till.cardSales);
  const cardMachine = parseMinor(till.cardMachine);
  const card = cardSales === null || cardMachine === null ? null : balanceOf(cardMachine, cardSales);
  const keepFloat = parseMinor(till.keepFloat) ?? float ?? 0;
  const explain = needsExplanation(...[cash?.difference, card?.difference].filter((d): d is number => d !== undefined));

  // As DUMA's counter does: whole pieces, 0 to 9,999.
  const setCount = (value: number, quantity: number) =>
    setCounts((current) => ({ ...current, [value]: Math.max(0, Math.min(9999, quantity)) }));
  const setTillField = (field: keyof Till) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setTill((current) => ({ ...current, [field]: event.target.value }));
  const clearAll = () => {
    setCounts({});
    setTill({ float: '', cashSales: '', paidOut: '', cardSales: '', cardMachine: '', keepFloat: '' });
  };

  /** One till figure as a row of its panel: the label on the left, the amount typed on the right. */
  const money = (field: keyof Till, label: string, placeholder: string, hint?: string) => (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--mkt-line)] px-3 py-2">
      <label htmlFor={`${uid}-${field}`} className="min-w-0 text-sm text-foreground">
        {label}
        {hint && <span className="block text-xs text-[var(--mkt-ink-3)]">{hint}</span>}
      </label>
      <div className="relative w-32 shrink-0">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-[var(--mkt-ink-3)]" aria-hidden="true">
          {symbol}
        </span>
        <input
          id={`${uid}-${field}`}
          className={cn(FIELD, 'h-9 pl-7 text-right')}
          inputMode="decimal"
          autoComplete="off"
          value={till[field]}
          placeholder={placeholder}
          onChange={setTillField(field)}
        />
      </div>
    </div>
  );

  const row = 'flex items-center justify-between gap-4 px-4 py-2';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ── The drawer, counted as DUMA's till cash-up counts it ── */}
      <form className="mkt-card px-5 py-6 sm:px-7" onSubmit={(event) => event.preventDefault()} aria-label="Cash-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-display">Count the drawer</h2>
          <div className="flex items-center gap-4">
            <button type="button" onClick={clearAll} className="text-sm font-medium text-primary hover:underline">
              Start blank
            </button>
            <div className="relative">
              <select
                aria-label="Currency"
                value={currency}
                onChange={(event) => changeCurrency(event.target.value as Currency)}
                className={cn(FIELD, 'h-9 w-auto appearance-none pr-9 pl-3 text-sm')}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--mkt-ink-3)]"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* The total leads, large, so the count can be checked against the stack in hand. */}
        <div className="mt-4 rounded-xl border border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-4 py-3">
          <p className="text-xs text-[var(--mkt-ink-2)]">In the drawer, float included</p>
          <p className="font-mono text-3xl font-semibold tabular-nums" aria-live="polite">
            {gbp(counted)}
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-4">
          {(['note', 'coin'] as const).map((kind) => {
            const group = DENOMINATIONS.filter((d) => d.kind === kind);
            const subtotal = countMinor(Object.fromEntries(group.map((d) => [d.value, counts[d.value] ?? 0])));
            const GroupIcon = kind === 'note' ? Banknote : Coins;
            return (
              <fieldset key={kind}>
                <legend className="sr-only">{kind === 'note' ? 'Notes' : 'Coins'}</legend>
                <div className="mb-2 flex items-center justify-between gap-3 px-1" aria-hidden="true">
                  <span className="flex items-center gap-2 text-sm font-semibold text-[var(--mkt-heading)]">
                    <GroupIcon className="size-4 text-primary" />
                    {kind === 'note' ? 'Notes' : 'Coins'}
                  </span>
                  <span className="font-mono text-xs text-[var(--mkt-ink-2)] tabular-nums">{gbp(subtotal)}</span>
                </div>
                <ul className="overflow-hidden rounded-xl border border-[var(--mkt-line)] bg-white dark:bg-transparent">
                  {group.map((d) => {
                    const quantity = counts[d.value] ?? 0;
                    const name = `${d.label} ${kind === 'note' ? 'notes' : 'coins'}`;
                    return (
                      <li key={d.value} className="flex items-center gap-2 border-b border-[var(--mkt-line)] px-2.5 py-1.5 last:border-b-0">
                        <span
                          className={cn(
                            'flex h-8 w-12 shrink-0 items-center justify-center text-[13px] font-semibold tabular-nums',
                            kind === 'note'
                              ? 'rounded-md bg-primary/10 text-primary'
                              : 'rounded-full bg-[var(--mkt-ground)] text-foreground',
                          )}
                          aria-hidden="true"
                        >
                          {d.label}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <StepButton
                            label={`One fewer ${d.label}`}
                            disabled={quantity === 0}
                            onClick={() => setCount(d.value, quantity - 1)}
                          >
                            <Minus className="size-3.5" />
                          </StepButton>
                          <input
                            aria-label={`Number of ${name}`}
                            inputMode="numeric"
                            autoComplete="off"
                            value={quantity === 0 ? '' : String(quantity)}
                            placeholder="0"
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => setCount(d.value, Number(event.target.value.replace(/\D/g, '')) || 0)}
                            className="h-9 w-12 rounded-md border border-[var(--mkt-line)] bg-white text-center text-[0.9375rem] tabular-nums outline-none placeholder:text-[var(--mkt-ink-3)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-transparent"
                          />
                          <StepButton label={`One more ${d.label}`} onClick={() => setCount(d.value, quantity + 1)}>
                            <Plus className="size-3.5" />
                          </StepButton>
                        </div>
                        <span
                          className={cn(
                            'ml-auto font-mono text-sm tabular-nums',
                            quantity ? 'font-medium text-foreground' : 'text-[var(--mkt-ink-3)]',
                          )}
                        >
                          {gbp(d.value * quantity)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>

        {/* ── What the till says, grouped as the cash-up reads it ── */}
        <div className="mt-8 grid items-start gap-4 border-t border-[var(--mkt-line)] pt-6 sm:grid-cols-2">
          <TillPanel
            title="Cash on the till"
            hint="From the end-of-day (Z) report"
            footer={{ label: 'Should be there', value: expected === null ? '–' : gbp(expected) }}
          >
            {money('float', 'Opening float', '150.00')}
            {money('cashSales', 'Cash sales', '0.00')}
            {money('paidOut', 'Paid out', '0.00', 'Milk from the shop, a delivery')}
          </TillPanel>
          <div className="grid gap-4">
            <TillPanel
              title="Card"
              hint="Optional"
              footer={{ label: 'Difference', value: card === null ? '–' : card.balance === 'balanced' ? gbp(0) : signed(card.difference) }}
            >
              {money('cardSales', 'Card sales on the till', '0.00')}
              {money('cardMachine', 'Card machine total', '0.00')}
            </TillPanel>
            <TillPanel title="Tomorrow" footer={{ label: 'To the bank', value: gbp(bankingMinor(counted, keepFloat)) }}>
              {money('keepFloat', 'Float to leave', float === null ? '0.00' : (float / 100).toFixed(2))}
            </TillPanel>
          </div>
        </div>
      </form>

      {/* ── The result, as a till slip ── */}
      <section className="mkt-mock overflow-hidden lg:sticky lg:top-24" aria-label="Your cash-up" aria-live="polite">
        <p className="border-b border-[var(--mkt-line)] px-4 py-3 text-[13px] font-semibold">Cash-up</p>
        <dl className="divide-y divide-[var(--mkt-line)] text-[13px]">
          <div className={row}>
            <dt>Opening float</dt>
            <dd className="font-mono tabular-nums">{float === null ? '–' : gbp(float)}</dd>
          </div>
          <div className={row}>
            <dt>+ Cash sales</dt>
            <dd className="font-mono tabular-nums">{cashSales === null ? '–' : gbp(cashSales)}</dd>
          </div>
          {paidOut > 0 && (
            <div className={row}>
              <dt>− Paid out</dt>
              <dd className="font-mono tabular-nums">{gbp(paidOut)}</dd>
            </div>
          )}
          <div className={cn(row, 'text-[var(--mkt-ink-2)]')}>
            <dt>Should be there</dt>
            <dd className="font-mono tabular-nums">{expected === null ? '–' : gbp(expected)}</dd>
          </div>
          <div className={row}>
            <dt>Counted</dt>
            <dd className="font-mono tabular-nums">{gbp(counted)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="font-semibold">
              {cash === null ? 'Difference' : cash.balance === 'balanced' ? 'Balanced' : cash.balance === 'over' ? 'Over' : 'Short'}
            </dt>
            <dd className="text-right">
              {cash === null ? (
                <span className="text-xs text-[var(--mkt-ink-2)]">Enter the float and cash sales</span>
              ) : (
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-base font-semibold tabular-nums',
                    cash.balance === 'balanced'
                      ? 'mkt-mark'
                      : cash.balance === 'short'
                        ? 'bg-measured/15 text-measured'
                        : 'bg-stock/15 text-stock',
                  )}
                >
                  {cash.balance === 'balanced' ? gbp(0) : signed(cash.difference)}
                </span>
              )}
            </dd>
          </div>
          {card && (
            <div className={row}>
              <dt>
                Card machine vs till
                <span className="block text-[11px] text-[var(--mkt-ink-3)]">
                  {card.balance === 'balanced' ? 'They agree' : card.balance === 'over' ? 'Machine took more' : 'Machine took less'}
                </span>
              </dt>
              <dd className="font-mono tabular-nums">{card.balance === 'balanced' ? gbp(0) : signed(card.difference)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 bg-[var(--mkt-ground)] px-4 py-3">
            <dt className="text-[13px]">
              <span className="font-semibold">Take to the bank</span>
              <span className="block text-[11px] text-[var(--mkt-ink-3)]">Leaving {gbp(keepFloat)} as tomorrow’s float</span>
            </dt>
            <dd className="font-mono text-base font-semibold tabular-nums">{gbp(bankingMinor(counted, keepFloat))}</dd>
          </div>
        </dl>
        {explain && (
          <p className="border-t border-[var(--mkt-line)] px-4 py-3 text-xs text-pretty text-[var(--mkt-ink-2)]">
            Out by {gbp(100)} or more. Write down why while the day is fresh — a refund not put through, change given wrong, a payment on
            the wrong machine.
          </p>
        )}
      </section>
    </div>
  );
}

/** − and + beside a count: DUMA's till cash-up StepButton, in the marketing site's colours. */
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
      className="grid size-8 place-items-center rounded-md text-[var(--mkt-ink-2)] transition-colors hover:bg-[var(--mkt-ground)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * A group of till figures, built like the drawer's note and coin lists: a
 * header, the figures as rows, and a footer with what they add
 * up to.
 */
function TillPanel({
  title,
  hint,
  footer,
  children,
}: {
  title: string;
  hint?: string;
  footer: { label: string; value: string };
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="overflow-hidden rounded-xl border border-[var(--mkt-line)] bg-white dark:bg-transparent"
    >
      <div className="flex items-center gap-2.5 border-b border-[var(--mkt-line)] px-3 py-2.5">
        <p id={id} className="text-sm font-semibold text-[var(--mkt-heading)]">
          {title}
        </p>
        {hint && <span className="ml-auto text-xs text-[var(--mkt-ink-3)]">{hint}</span>}
      </div>
      {/* The last figure's own border is the footer's top edge. */}
      <div className="[&>*:last-child]:border-b-0">{children}</div>
      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-3 py-2.5">
        <span className="text-sm text-[var(--mkt-ink-2)]">{footer.label}</span>
        <span className="font-mono text-sm font-semibold tabular-nums">{footer.value}</span>
      </div>
    </div>
  );
}
