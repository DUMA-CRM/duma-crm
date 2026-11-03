'use client';

import { useId, useState } from 'react';

import { ChevronDown, Plus, Trash2 } from '@/components/icons';
import { CostingCard } from '@/components/marketing/mocks';
import { buttonVariants } from '@/components/ui/button';

import { type VatContext, computeCosting } from '@/lib/menu/costing';
import { cn } from '@/lib/utils/cn';
import { fmtGbpExact } from '@/lib/utils/format';
import { foodCostPct, parseAmount, priceForTargetMargin, recipeCost, roundUpPrice } from '@/lib/utils/margin-calculator';

type Line = { id: number; name: string; quantity: string; cost: string };
type VatMode = 'inclusive' | 'exclusive' | 'none';

/** A flat white: 60p of ingredients on £3.20, the example the page works through. */
const EXAMPLE_LINES: Line[] = [
  { id: 1, name: 'Espresso', quantity: '18 g', cost: '0.22' },
  { id: 2, name: 'Milk', quantity: '200 ml', cost: '0.30' },
  { id: 3, name: 'Cup and lid', quantity: '1', cost: '0.08' },
];

/** Suggested menu prices are rounded up to the next 10p. */
const MENU_STEP = 10;

const FIELD =
  'h-10 w-full rounded-lg border border-[var(--mkt-line)] bg-white px-3 text-[0.9375rem] text-foreground tabular-nums outline-none placeholder:text-[var(--mkt-ink-3)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-transparent';
const LABEL = 'mb-1.5 block text-sm font-medium text-[var(--mkt-heading)]';
/** Ingredient rows: name, amount, cost, remove. */
const ROW = 'grid grid-cols-[minmax(0,1fr)_4.75rem_5.25rem_2.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem]';

const pct = (value: number) => `${value.toFixed(1)}%`;

/** A native select drawn like the text fields beside it, with the chevron the browser's own arrow would be. */
function Picker({
  id,
  value,
  onChange,
  disabled,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        className={cn(FIELD, 'appearance-none pr-9 disabled:opacity-50')}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[var(--mkt-ink-3)]"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * The free menu margin calculator — a client island on /tools/margin-calculator.
 * Your dish on the left; on the right the same costed card as the home page's
 * recipe tile, worked out live. Every figure comes from lib/menu/costing.ts,
 * the function the product uses on a recipe, so the tool and DUMA always
 * agree. Nothing typed here leaves the browser.
 */
export function MarginCalculator() {
  const uid = useId();
  const [dish, setDish] = useState('Flat white');
  const [price, setPrice] = useState('3.20');
  const [lines, setLines] = useState<Line[]>(EXAMPLE_LINES);
  const [nextId, setNextId] = useState(EXAMPLE_LINES.length + 1);
  const [vatMode, setVatMode] = useState<VatMode>('inclusive');
  const [vatRate, setVatRate] = useState('20');
  const [target, setTarget] = useState('70');

  const ctx: VatContext = { pricesIncludeTax: vatMode !== 'exclusive', defaultVatRate: 20, vatRegistered: vatMode !== 'none' };
  const cogs = recipeCost(lines);
  const priceValue = parseAmount(price);
  const costing = priceValue === null ? null : computeCosting({ price: priceValue, cogs, itemVatRate: vatRate, ctx });
  const foodCost = costing ? foodCostPct(costing) : null;
  const targetValue = parseAmount(target);
  const targetPrice = targetValue === null ? null : priceForTargetMargin({ cogs, targetPct: targetValue, itemVatRate: vatRate, ctx });
  const costed = lines.flatMap((line) => {
    const cost = parseAmount(line.cost);
    return cost === null ? [] : [{ name: line.name.trim() || 'Ingredient', quantity: line.quantity.trim(), cost }];
  });

  const updateLine = (id: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  const addLine = () => {
    setLines((current) => [...current, { id: nextId, name: '', quantity: '', cost: '' }]);
    setNextId((n) => n + 1);
  };
  const removeLine = (id: number) => setLines((current) => current.filter((line) => line.id !== id));
  const clearAll = () => {
    setDish('');
    setPrice('');
    setLines([{ id: nextId, name: '', quantity: '', cost: '' }]);
    setNextId((n) => n + 1);
  };

  const vatLabel =
    !costing || vatMode === 'none' ? null : `${vatMode === 'inclusive' ? 'VAT in the price' : 'VAT on top'} (${costing.vatRate}%)`;
  const row = 'flex items-center justify-between gap-4 px-4 py-2 text-[var(--mkt-ink-2)]';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ── Your dish ── */}
      <form className="mkt-card px-5 py-6 sm:px-7" onSubmit={(event) => event.preventDefault()} aria-label="Your dish">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-display">Your dish</h2>
          <button type="button" onClick={clearAll} className="text-sm font-medium text-primary hover:underline">
            Start blank
          </button>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
          <div>
            <label htmlFor={`${uid}-dish`} className={LABEL}>
              Dish
            </label>
            <input
              id={`${uid}-dish`}
              className={FIELD}
              autoComplete="off"
              value={dish}
              onChange={(e) => setDish(e.target.value)}
              placeholder="Flat white"
            />
          </div>
          <div>
            <label htmlFor={`${uid}-price`} className={LABEL}>
              Price (£)
            </label>
            <input
              id={`${uid}-price`}
              className={cn(FIELD, 'text-right')}
              inputMode="decimal"
              autoComplete="off"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="3.20"
            />
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className={LABEL}>Ingredients in one portion</legend>
          <ul className="flex flex-col gap-2">
            {lines.map((line, index) => (
              <li key={line.id} className={ROW}>
                <input
                  aria-label={`Ingredient ${index + 1}`}
                  className={FIELD}
                  value={line.name}
                  autoComplete="off"
                  placeholder="Ingredient"
                  onChange={(e) => updateLine(line.id, { name: e.target.value })}
                />
                <input
                  aria-label={`Ingredient ${index + 1}: amount`}
                  className={FIELD}
                  value={line.quantity}
                  autoComplete="off"
                  placeholder="18 g"
                  onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                />
                <input
                  aria-label={`Ingredient ${index + 1}: cost in pounds`}
                  className={cn(FIELD, 'text-right')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={line.cost}
                  placeholder="£0.00"
                  onChange={(e) => updateLine(line.id, { cost: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1}
                  className="grid size-10 place-items-center rounded-lg text-[var(--mkt-ink-3)] hover:bg-[var(--mkt-ground)] hover:text-foreground disabled:opacity-30"
                  aria-label={`Remove ingredient ${index + 1}${line.name ? `, ${line.name}` : ''}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={addLine} className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 gap-1.5')}>
            <Plus className="size-4" aria-hidden="true" />
            Add ingredient
          </button>
        </fieldset>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem]">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor={`${uid}-vat`} className={LABEL}>
              VAT
            </label>
            <Picker id={`${uid}-vat`} value={vatMode} onChange={(value) => setVatMode(value as VatMode)}>
              <option value="inclusive">Included in the price</option>
              <option value="exclusive">Added on top</option>
              <option value="none">Not VAT-registered</option>
            </Picker>
          </div>
          <div>
            <label htmlFor={`${uid}-rate`} className={LABEL}>
              VAT rate
            </label>
            <Picker id={`${uid}-rate`} value={vatRate} disabled={vatMode === 'none'} onChange={setVatRate}>
              <option value="20">20%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </Picker>
          </div>
          <div>
            <label htmlFor={`${uid}-target`} className={LABEL}>
              Target margin
            </label>
            <div className="relative">
              <input
                id={`${uid}-target`}
                className={cn(FIELD, 'pr-8 text-right')}
                inputMode="decimal"
                autoComplete="off"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="70"
              />
              <span
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-[var(--mkt-ink-3)]"
                aria-hidden="true"
              >
                %
              </span>
            </div>
          </div>
        </div>
      </form>

      {/* ── The costed dish, as on the home page ── */}
      <section className="mkt-mock overflow-hidden lg:sticky lg:top-24" aria-label="Your dish, costed" aria-live="polite">
        {costing && priceValue !== null ? (
          <CostingCard name={dish.trim() || 'Your dish'} price={priceValue} ingredients={costed} vatLabel={vatLabel} costing={costing}>
            <div className={row}>
              <dt>Food cost</dt>
              <dd className="font-mono tabular-nums">{foodCost === null ? '–' : pct(foodCost)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 bg-[var(--mkt-ground)] px-4 py-3">
              <dt className="text-[13px]">
                <span className="font-semibold">Charge for {targetValue === null ? 'your target' : `${targetValue}%`}</span>
                {targetPrice !== null && (
                  <span className="block text-[11px] text-[var(--mkt-ink-3)]">{fmtGbpExact(targetPrice)}, rounded up to 10p</span>
                )}
              </dt>
              <dd className="font-mono text-base font-semibold tabular-nums">
                {targetPrice === null ? '–' : fmtGbpExact(roundUpPrice(targetPrice, MENU_STEP))}
              </dd>
            </div>
          </CostingCard>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-[var(--mkt-ink-2)]">Enter a price to see what you keep.</p>
        )}
      </section>
    </div>
  );
}
