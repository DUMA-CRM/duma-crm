'use client';

import { useState, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { type VatContext, computeCosting } from '@/lib/menu/costing';
import { priceForTargetMargin } from '@/lib/utils/margin-calculator';
import { type ReorderInputs, calculateReorder } from '@/lib/utils/reorder-planner';

const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parse(value: string, max = 1_000_000) {
  const amount = Number(value);
  return value.trim() && Number.isFinite(amount) && amount >= 0 && amount <= max ? amount : NaN;
}

function NumberField({ label, value, onChange, step = '1', max = 1_000_000, min = 0 }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  max?: number;
  min?: number;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <Input type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} min={min} max={max}
        step={step} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CalculatorLayout({ fields, children }: { fields: ReactNode; children: ReactNode }) {
  return (
    <div className="grid max-w-4xl items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">{fields}</div>
      <section aria-label="Results" aria-live="polite" className="space-y-3 rounded-lg border border-border bg-card p-5">
        {children}
      </section>
    </div>
  );
}

export function MarketplaceMarginCalculator() {
  const [cost, setCost] = useState('3');
  const [sellingPrice, setSellingPrice] = useState('10');
  const [taxRate, setTaxRate] = useState('0');
  const [includesTax, setIncludesTax] = useState(false);
  const [target, setTarget] = useState('70');
  const cogs = parse(cost);
  const price = parse(sellingPrice);
  const tax = parse(taxRate, 100);
  const targetPct = parse(target, 99);
  const ctx: VatContext = { vatRegistered: tax > 0, defaultVatRate: tax, pricesIncludeTax: includesTax };
  const costing = [cogs, price, tax].every(Number.isFinite) ? computeCosting({ price, cogs, ctx }) : null;
  const requiredPrice = [cogs, targetPct, tax].every(Number.isFinite) ? priceForTargetMargin({ cogs, targetPct, ctx }) : null;

  return (
    <CalculatorLayout fields={(
      <>
        <p className="text-sm text-muted-foreground">Enter all amounts in the same currency. Use your product cost before tax.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="Product cost" value={cost} onChange={setCost} step="0.01" />
          <NumberField label="Selling price" value={sellingPrice} onChange={setSellingPrice} step="0.01" />
          <NumberField label="Tax rate (%)" value={taxRate} onChange={setTaxRate} step="0.1" max={100} />
          <NumberField label="Target gross margin (%)" value={target} onChange={setTarget} step="0.1" max={99} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includesTax} onChange={(event) => setIncludesTax(event.target.checked)} />
          Selling price includes tax
        </label>
      </>
    )}>
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Gross margin</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{costing && costing.netRevenue > 0 ? `${number.format(costing.marginPct)}%` : '—'}</p>
      </div>
      <dl className="space-y-2 border-t border-border pt-3 text-sm">
        <div className="flex justify-between gap-3"><dt>Revenue excluding tax</dt><dd>{costing ? money.format(costing.netRevenue) : '—'}</dd></div>
        <div className="flex justify-between gap-3"><dt>Gross profit per sale</dt><dd>{costing ? money.format(costing.margin) : '—'}</dd></div>
        <div className="flex justify-between gap-3 font-medium"><dt>Price at target margin</dt><dd>{requiredPrice === null ? '—' : money.format(requiredPrice)}</dd></div>
      </dl>
      {requiredPrice !== null && <p className="text-xs text-muted-foreground">{includesTax ? 'Target price includes tax.' : 'Target price excludes tax.'}</p>}
    </CalculatorLayout>
  );
}

const stockFields = [
  { key: 'onHand', label: 'Units currently on hand' },
  { key: 'incoming', label: 'Units already due by delivery' },
  { key: 'dailyUsage', label: 'Average units used per day', step: '0.001' },
  { key: 'leadDays', label: 'Days until delivery' },
  { key: 'coverDays', label: 'Days to cover after delivery' },
  { key: 'packSize', label: 'Units per supplier pack', min: 1 },
] as const;

export function StockReorderPlanner() {
  const [values, setValues] = useState<Record<keyof ReorderInputs, string>>({
    onHand: '18', incoming: '0', dailyUsage: '6', leadDays: '3', coverDays: '3', packSize: '12',
  });

  const result = calculateReorder({
    onHand: parse(values.onHand), incoming: parse(values.incoming), dailyUsage: parse(values.dailyUsage),
    leadDays: parse(values.leadDays), coverDays: parse(values.coverDays), packSize: parse(values.packSize),
  });

  return (
    <CalculatorLayout fields={(
      <>
        <p className="text-sm text-muted-foreground">Plan one item at a time. Use the same unit for stock, usage, and supplier packs.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {stockFields.map(({ key, label, ...options }) => (
            <NumberField key={key} label={label} value={values[key]} {...options}
              onChange={(value) => setValues((current) => ({ ...current, [key]: value }))} />
          ))}
        </div>
      </>
    )}>
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Suggested order</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{result ? `${number.format(result.units)} units` : '—'}</p>
        {result && <p className="mt-1 text-sm text-muted-foreground">{number.format(result.packs)} supplier {result.packs === 1 ? 'pack' : 'packs'}</p>}
      </div>
      {result ? (
        <>
          <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between gap-3"><dt>Total stock needed</dt><dd>{number.format(result.target)} units</dd></div>
            <div className="flex justify-between gap-3"><dt>Coverage from stock on hand</dt><dd>{result.daysOnHand === null ? 'No usage' : `${number.format(result.daysOnHand)} days`}</dd></div>
          </dl>
          {result.mayRunOut && <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">Current stock may run out before delivery. Check when your incoming units will arrive.</p>}
        </>
      ) : <p className="text-sm text-muted-foreground">Enter whole counts and days, a pack size of at least one, and up to three decimal places for daily usage.</p>}
    </CalculatorLayout>
  );
}
