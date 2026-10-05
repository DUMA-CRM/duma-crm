'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Globe, Loader2 } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { PAYROLL_PERIODS, type PayrollPeriod, type PayrollSchedule, savePayrollSchedule } from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { GENERIC_LINES, PAYROLL_COUNTRIES, countryByCode } from '@/lib/payroll/countries';
import { PERIOD_LABEL } from '@/lib/utils/payroll-periods';
import { toast } from '@/stores/toastStore';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Where payroll runs, how often, and whether it finalises on its own. The
 * country only suggests deduction line names; the currency is shown from Trading
 * & tax and changed there, because it prices the whole business, not just pay.
 */
export function PayrollSettingsDrawer({ settings, onClose }: { settings: PayrollSchedule; onClose: () => void }) {
  const qc = useQueryClient();
  const [country, setCountry] = useState(settings.payrollCountry ?? '');
  const [period, setPeriod] = useState<PayrollPeriod>(settings.payrollPeriod);
  const [payDay, setPayDay] = useState(settings.payrollPayDayOfMonth);
  const [weekday, setWeekday] = useState(settings.payrollPayWeekday);
  const [auto, setAuto] = useState(settings.payrollAutoFinalise);
  const preset = countryByCode(country);

  const save = useMutation({
    mutationFn: () =>
      savePayrollSchedule({
        payrollCountry: country || null,
        payrollPeriod: period,
        payrollPayDayOfMonth: payDay,
        payrollPayWeekday: weekday,
        payrollAutoFinalise: auto,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payroll-schedule') });
      toast('success', 'Payroll settings saved.');
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The settings weren’t saved. Try again.'),
  });

  return (
    <Drawer
      title="Payroll settings"
      description="Where you run payroll and how often."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        <section>
          <h3 className="text-sm font-semibold text-foreground">Country</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suggests the names of the lines on each payslip. Nothing is calculated from it.
          </p>
          <Select
            value={country}
            onValueChange={setCountry}
            options={[
              { value: '', label: 'Somewhere else — generic names' },
              ...PAYROLL_COUNTRIES.map((item) => ({ value: item.code, label: item.name })),
            ]}
            ariaLabel="Payroll country"
            icon={<Globe />}
            className="mt-2.5 w-full"
          />
          <div className="mt-2.5 rounded-lg bg-band/60 px-3.5 py-3">
            <p className="text-xs font-semibold text-foreground">Suggested lines</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {(preset?.lines ?? GENERIC_LINES)
                .map((line) => `${line.label}${line.paidBy === 'employer' ? ' (employer)' : ''}`)
                .join(' · ')}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Amounts in <span className="font-semibold text-foreground">{settings.currency}</span>
            {preset && preset.currency !== settings.currency && ` — ${preset.name} usually pays in ${preset.currency}`}.{' '}
            <Link href="/settings/trading" className="font-semibold text-foreground underline underline-offset-2">
              Change in Trading & tax
            </Link>
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">Pay period</h3>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {PAYROLL_PERIODS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
                className={
                  period === value
                    ? 'rounded-lg border border-primary bg-primary/5 px-3.5 py-3 text-left text-sm font-semibold text-foreground'
                    : 'rounded-lg border border-rule/60 bg-field px-3.5 py-3 text-left text-sm font-medium text-foreground hover:bg-band/40'
                }
              >
                {PERIOD_LABEL[value].name}
                {preset?.commonPeriod === value && (
                  <span className="block text-xs font-normal text-muted-foreground">Common in {preset.name}</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground">Pay day</h3>
          {period === 'monthly' ? (
            <Select
              value={String(payDay)}
              onValueChange={(value) => setPayDay(Number(value))}
              options={Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `Day ${index + 1} of the month` }))}
              ariaLabel="Pay day of the month"
              className="mt-2.5 w-full"
            />
          ) : period === 'semi_monthly' ? (
            <p className="mt-1 text-sm text-muted-foreground">
              The 16th (for the 1st–15th) and the 1st (for the rest of the month before).
            </p>
          ) : (
            <Select
              value={String(weekday)}
              onValueChange={(value) => setWeekday(Number(value))}
              options={WEEKDAYS.map((label, index) => ({
                value: String(index + 1),
                label: `Every ${period === 'fortnightly' ? 'other ' : ''}${label}`,
              }))}
              ariaLabel="Pay weekday"
              className="mt-2.5 w-full"
            />
          )}
        </section>

        <section className="flex items-start gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Finalise automatically on pay day</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              Freezes the period’s hours and gross pay. Payslips are never sent automatically — someone still enters each person’s
              deductions first.
            </span>
          </span>
          <Switch label="Finalise automatically" checked={auto} onChange={setAuto} />
        </section>
      </div>
    </Drawer>
  );
}
