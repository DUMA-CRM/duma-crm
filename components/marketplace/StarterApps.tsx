'use client';

import { useState, type ReactNode } from 'react';

import { RowWarning } from '@/components/cms/rows';
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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="calculator-inputs" className="min-w-0">
        <h2 id="calculator-inputs" className="mb-2 px-1 text-base font-semibold tracking-title text-heading">Inputs</h2>
        <div className="space-y-4 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">{fields}</div>
      </section>
      <section aria-labelledby="calculator-results" aria-live="polite" className="min-w-0 lg:sticky lg:top-4">
        <h2 id="calculator-results" className="mb-2 px-1 text-base font-semibold tracking-title text-heading">Result</h2>
        <div className="space-y-4 rounded-lg border border-border bg-card px-5 py-4 shadow-sm">{children}</div>
      </section>
    </div>
  );
}

function Headline({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-label font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-metric font-semibold tracking-tight text-heading tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Readout({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <dl className="space-y-2 border-t border-border pt-3 text-sm">
      {rows.map(({ label, value, strong }) => (
        <div key={label} className={`flex justify-between gap-3 ${strong ? 'font-semibold text-heading' : ''}`}>
          <dt className={strong ? undefined : 'text-muted-foreground'}>{label}</dt>
          <dd className="font-mono tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
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
          <input type="checkbox" className="size-4 accent-primary" checked={includesTax} onChange={(event) => setIncludesTax(event.target.checked)} />
          Selling price includes tax
        </label>
      </>
    )}>
      <Headline label="Gross margin" value={costing && costing.netRevenue > 0 ? `${number.format(costing.marginPct)}%` : '—'} />
      <Readout rows={[
        { label: 'Revenue excluding tax', value: costing ? money.format(costing.netRevenue) : '—' },
        { label: 'Gross profit per sale', value: costing ? money.format(costing.margin) : '—' },
        { label: 'Price at target margin', value: requiredPrice === null ? '—' : money.format(requiredPrice), strong: true },
      ]} />
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
      <Headline label="Suggested order" value={result ? `${number.format(result.units)} units` : '—'}
        sub={result ? `${number.format(result.packs)} supplier ${result.packs === 1 ? 'pack' : 'packs'}` : undefined} />
      {result ? (
        <>
          <Readout rows={[
            { label: 'Total stock needed', value: `${number.format(result.target)} units` },
            { label: 'Coverage from stock on hand', value: result.daysOnHand === null ? 'No usage' : `${number.format(result.daysOnHand)} days` },
          ]} />
          {result.mayRunOut && <RowWarning>Current stock may run out before delivery. Check when your incoming units will arrive.</RowWarning>}
        </>
      ) : <p className="text-sm text-muted-foreground">Enter whole counts and days, a pack size of at least one, and up to three decimal places for daily usage.</p>}
    </CalculatorLayout>
  );
}
