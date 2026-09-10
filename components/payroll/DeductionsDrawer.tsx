'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Loader2 } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type PayrollRun, type PayrollRunLine, lineIsComplete, setPayrollLineDeductions } from '@/lib/api/payroll.service';
import { toast } from '@/stores/toastStore';

import { money } from './shared';

/**
 * Where the figures this platform refuses to invent get entered.
 *
 * DUMA does not compute PAYE or National Insurance (UI-ADR-011). Someone
 * copies the real numbers in from whatever runs payroll, one employee at a
 * time, and only then can the run be issued.
 *
 * The net pay is offered as gross minus the deductions entered, but it is not
 * *forced* to that: the payroll system is the authority, and if its net
 * disagrees with our arithmetic the payroll system is right and the difference
 * is worth seeing rather than silently overwriting.
 */

type Form = { taxDeducted: string; nationalInsurance: string; pensionContribution: string; otherDeductions: string; netPay: string };

const blank: Form = { taxDeducted: '', nationalInsurance: '', pensionContribution: '', otherDeductions: '', netPay: '' };

const from = (line: PayrollRunLine): Form => ({
  taxDeducted: line.taxDeducted ?? '',
  nationalInsurance: line.nationalInsurance ?? '',
  pensionContribution: line.pensionContribution ?? '',
  otherDeductions: line.otherDeductions ?? '',
  netPay: line.netPay ?? '',
});

const AMOUNT = /^-?\d{1,10}(\.\d{1,2})?$/;
const num = (value: string) => (AMOUNT.test(value.trim()) ? Number(value.trim()) : 0);

export function DeductionsDrawer({ run, line, onClose }: { run: PayrollRun; line: PayrollRunLine; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() => (lineIsComplete(line) ? from(line) : blank));

  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const gross = Number(line.grossPay);
  const deductions = num(form.taxDeducted) + num(form.nationalInsurance) + num(form.pensionContribution) + num(form.otherDeductions);
  const impliedNet = Math.round((gross - deductions) * 100) / 100;

  const required: (keyof Form)[] = ['taxDeducted', 'nationalInsurance', 'netPay'];
  const invalid = (['taxDeducted', 'nationalInsurance', 'pensionContribution', 'otherDeductions', 'netPay'] as const).filter(
    (key) => form[key].trim() !== '' && !AMOUNT.test(form[key].trim()),
  );
  const missing = required.filter((key) => form[key].trim() === '');
  const canSave = missing.length === 0 && invalid.length === 0;

  // Worth showing, never worth silently correcting.
  const netDisagrees = form.netPay.trim() !== '' && AMOUNT.test(form.netPay.trim()) && Math.abs(num(form.netPay) - impliedNet) >= 0.01;

  const save = useMutation({
    mutationFn: () =>
      setPayrollLineDeductions(run.id, line.id, {
        taxDeducted: form.taxDeducted.trim(),
        nationalInsurance: form.nationalInsurance.trim(),
        pensionContribution: form.pensionContribution.trim() || undefined,
        otherDeductions: form.otherDeductions.trim() || undefined,
        netPay: form.netPay.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast('success', `Deductions recorded for ${line.employeeName ?? 'this employee'}.`);
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The deductions weren’t saved. Try again.'),
  });

  return (
    <Drawer
      title={line.employeeName ?? 'Employee'}
      description={`Gross ${money(line.grossPay)} · ${line.paidHours} paid hours`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending} className="gap-2">
            {save.isPending && <Loader2 size={15} className="animate-spin" />}
            Save deductions
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="rounded-sm border border-rule bg-band/50 p-3 text-xs leading-relaxed text-muted-foreground">
          DUMA does not calculate tax or National Insurance. Copy the figures from the system that ran this payroll — they are what the
          employee&rsquo;s payslip will show.
        </p>

        <Field label="Tax deducted (PAYE)" required value={form.taxDeducted} onChange={set('taxDeducted')} />
        <Field label="National Insurance" required value={form.nationalInsurance} onChange={set('nationalInsurance')} />
        <Field label="Pension contribution" value={form.pensionContribution} onChange={set('pensionContribution')} />
        <Field label="Other deductions" value={form.otherDeductions} onChange={set('otherDeductions')} />

        <div className="rounded-sm border border-rule bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gross minus what you entered</span>
            <span data-figure className="font-semibold tabular-nums">
              {money(impliedNet.toFixed(2))}
            </span>
          </div>
        </div>

        <Field label="Net pay" required value={form.netPay} onChange={set('netPay')} />

        {netDisagrees && (
          <p className="flex gap-2 rounded-sm border border-measured/40 bg-card p-3 text-xs leading-relaxed text-muted-foreground">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
            <span>
              Net pay differs from gross minus the deductions above by {money(Math.abs(num(form.netPay) - impliedNet).toFixed(2))}. That is
              allowed — the payroll system is the authority — but check it is not a typo.
            </span>
          </p>
        )}

        {invalid.length > 0 && (
          <p className="text-xs font-semibold text-destructive">Amounts need at most two decimal places, e.g. 191.40.</p>
        )}
      </div>
    </Drawer>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-micro font-semibold tracking-micro text-muted-foreground uppercase">
        {label}
        {!required && <span className="ml-1 font-normal normal-case">(optional)</span>}
      </span>
      <Input inputMode="decimal" placeholder="0.00" value={value} onChange={onChange} />
    </label>
  );
}
