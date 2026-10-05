'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Loader2, Plus, Trash2 } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { type PayItem, type PayItemKind, type PayrollRunLine, setPayrollLineDeductions } from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { presetLinesFor } from '@/lib/payroll/countries';
import { cn } from '@/lib/utils/cn';
import { expectedNet, itemTotals, netMismatch } from '@/lib/utils/payroll-totals';
import { toast } from '@/stores/toastStore';

import { useMoney } from './usePayroll';

const KIND_OPTIONS: { value: PayItemKind; label: string }[] = [
  { value: 'tax', label: 'Tax' },
  { value: 'social', label: 'Social / insurance' },
  { value: 'pension', label: 'Pension' },
  { value: 'other', label: 'Other' },
];

const AMOUNT = /^-?\d{0,10}(\.\d{0,2})?$/;

/**
 * One person's payslip figures, typed in from whatever computes them. Lines are
 * named freely — the country preset only offers the usual names — and each is
 * paid by the employee (comes off their pay) or the employer (a cost on top).
 * Net pay is worked out from the lines and can be overwritten: it is what was
 * actually paid, and the screen says if the two stop agreeing.
 */
export function LineEditor({
  runId,
  line,
  country,
  editable,
  onClose,
}: {
  runId: string;
  line: PayrollRunLine;
  country: string | null;
  editable: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const money = useMoney();
  const presets = presetLinesFor(country);
  const firstTime = line.netPay === null && line.items.length === 0;
  // First time in, start from the country's usual employee lines with blank amounts.
  const [items, setItems] = useState<PayItem[]>(() =>
    firstTime
      ? presets
          .filter((preset) => preset.paidBy === 'employee')
          .slice(0, 3)
          .map((preset) => ({ ...preset, amount: '' }))
      : line.items,
  );
  const clean = items.filter((item) => item.label.trim() && item.amount !== '' && item.amount !== '-');
  const suggested = expectedNet(line.grossPay, clean);
  const [netOverride, setNetOverride] = useState<string | null>(
    line.netPay !== null && line.netPay !== expectedNet(line.grossPay, line.items) ? line.netPay : null,
  );
  const net = netOverride ?? suggested;
  const mismatch = netOverride !== null ? netMismatch(line.grossPay, clean, netOverride) : null;
  const totals = itemTotals(clean);
  const incomplete = items.some((item) => item.label.trim() && (item.amount === '' || item.amount === '-'));
  const unused = presets.filter((preset) => !items.some((item) => item.label === preset.label));

  const save = useMutation({
    mutationFn: () =>
      setPayrollLineDeductions(runId, line.id, {
        items: clean.map((item) => ({ ...item, label: item.label.trim(), amount: Number(item.amount).toFixed(2) })),
        netPay: Number(net).toFixed(2),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payroll-runs') });
      toast('success', `${line.employeeName ?? 'Payslip'} saved.`);
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The figures weren’t saved. Try again.'),
  });

  const update = (index: number, patch: Partial<PayItem>) =>
    setItems((current) => current.map((item, at) => (at === index ? { ...item, ...patch } : item)));

  return (
    <Drawer
      title={line.employeeName ?? 'Payslip'}
      description={`Gross ${money(line.grossPay)} · ${Number(line.paidHours)} paid hours`}
      onClose={onClose}
      footer={
        editable ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Net pay</p>
              <p className="text-lg font-semibold text-foreground">{money(net)}</p>
            </div>
            <Button variant="outline" size="lg" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button size="lg" onClick={() => save.mutate()} disabled={save.isPending || incomplete || !/^-?\d+(\.\d{1,2})?$/.test(net)}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save payslip
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">Deductions and contributions</h3>
            <span className="text-xs text-muted-foreground">Your accountant’s figures</span>
          </div>

          <ul className="mt-2.5 space-y-2">
            {items.map((item, index) => (
              <li key={index} className="rounded-lg border border-rule/60 bg-field p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={item.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    placeholder="Name, e.g. Income tax"
                    aria-label="Line name"
                    maxLength={120}
                    disabled={!editable}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring disabled:opacity-60"
                  />
                  <input
                    value={item.amount}
                    onChange={(event) => AMOUNT.test(event.target.value) && update(index, { amount: event.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`${item.label || 'Line'} amount`}
                    disabled={!editable}
                    className="h-9 w-28 rounded-md border border-input bg-background px-3 text-right text-sm font-semibold text-foreground outline-none focus-visible:border-ring disabled:opacity-60"
                  />
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${item.label || 'line'}`}
                      onClick={() => setItems((current) => current.filter((_, at) => at !== index))}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    options={[
                      { value: 'employee', label: 'From their pay' },
                      { value: 'employer', label: 'Employer pays' },
                    ]}
                    value={item.paidBy}
                    onChange={(paidBy) => editable && update(index, { paidBy })}
                    ariaLabel="Who pays this line"
                  />
                  <Select
                    value={item.kind}
                    onValueChange={(kind) => update(index, { kind: kind as PayItemKind })}
                    options={KIND_OPTIONS}
                    ariaLabel="Kind of line"
                    className="w-44"
                    disabled={!editable}
                  />
                </div>
              </li>
            ))}
            {items.length === 0 && (
              <li className="rounded-lg border border-dashed border-rule/70 px-4 py-5 text-center text-sm text-muted-foreground">
                No deductions — net pay will equal gross.
              </li>
            )}
          </ul>

          {editable && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {unused.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setItems((current) => [...current, { ...preset, amount: '' }])}
                  className="flex h-8 items-center gap-1 rounded-md border border-rule/60 bg-field px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-band/60"
                >
                  <Plus size={12} aria-hidden="true" /> {preset.label}
                  {preset.paidBy === 'employer' && <span className="text-muted-foreground">· employer</span>}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setItems((current) => [...current, { label: '', kind: 'other', paidBy: 'employee', amount: '' }])}
                className="flex h-8 items-center gap-1 rounded-md border border-dashed border-rule/70 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Plus size={12} aria-hidden="true" /> Another line
              </button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-rule/60 bg-field">
          <dl className="divide-y divide-rule/45">
            <Row label="Gross pay" value={money(line.grossPay)} />
            <Row label="Taken from their pay" value={`− ${money(totals.employee)}`} />
            <Row
              label="Net pay"
              value={
                editable ? (
                  <input
                    value={net}
                    onChange={(event) => AMOUNT.test(event.target.value) && setNetOverride(event.target.value)}
                    inputMode="decimal"
                    aria-label="Net pay"
                    className="h-8 w-32 rounded-md border border-input bg-background px-2.5 text-right text-sm font-semibold text-foreground outline-none focus-visible:border-ring"
                  />
                ) : (
                  money(line.netPay)
                )
              }
              strong
            />
            <Row label="Employer pays on top" value={money(totals.employer)} muted />
          </dl>
          {netOverride !== null && editable && (
            <button
              type="button"
              className="w-full border-t border-rule/45 px-4 py-2 text-left text-xs font-semibold text-primary"
              onClick={() => setNetOverride(null)}
            >
              Use the worked-out net ({money(suggested)})
            </button>
          )}
        </section>

        {mismatch && (
          <p className="flex items-start gap-2 rounded-lg bg-measured/10 px-3.5 py-3 text-sm text-measured" role="status">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            Net pay is {money(Math.abs(Number(mismatch)))} {Number(mismatch) > 0 ? 'more' : 'less'} than gross less the lines above. That
            can be right — say, a bonus or salary sacrifice — but check it against the payslip you were given.
          </p>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <dt className={cn('text-sm', muted ? 'text-muted-foreground' : 'text-foreground', strong && 'font-semibold')}>{label}</dt>
      <dd className={cn('text-sm', strong ? 'font-semibold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground')}>
        {value}
      </dd>
    </div>
  );
}
