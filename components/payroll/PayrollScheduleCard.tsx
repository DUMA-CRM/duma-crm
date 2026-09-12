'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getPayrollSchedule, savePayrollSchedule } from '@/lib/api/payroll.service';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';

/** ISO weekday order: 1 = Monday, matching the API and the rota. */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * When payroll snapshots itself.
 *
 * Its own card rather than a section of Trading & payments: a pay day has
 * nothing to do with currency, VAT or a receipt footer, and burying it under
 * them made it look like a tax setting.
 *
 * It sits with payroll, not in Settings. The record is still a column on
 * `trading_settings`, but it is reached through `/payroll/settings`, which is
 * gated on the payroll capabilities rather than on `settings:write` — so
 * configuring when payroll runs needs no authority over currency, VAT or the
 * legal name, and `hr_manager` can do it.
 */
export function PayrollScheduleCard() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['payroll-schedule'], queryFn: getPayrollSchedule });

  const [autoFinalise, setAutoFinalise] = useState<boolean>();
  const [period, setPeriod] = useState<'weekly' | 'monthly'>();
  const [payDay, setPayDay] = useState<string>();
  const [payWeekday, setPayWeekday] = useState<string>();

  const activePeriod = period ?? settings?.payrollPeriod ?? 'monthly';
  const activeAuto = autoFinalise ?? settings?.payrollAutoFinalise ?? false;

  const save = useMutation({
    mutationFn: () =>
      savePayrollSchedule({
        payrollAutoFinalise: activeAuto,
        payrollPeriod: activePeriod,
        payrollPayDayOfMonth: Number(payDay ?? settings!.payrollPayDayOfMonth),
        payrollPayWeekday: Number(payWeekday ?? settings!.payrollPayWeekday),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payroll-schedule'] });
      toast('success', 'Payroll schedule saved.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The payroll schedule wasn’t saved. Try again.'),
  });

  return (
    <section className="rounded-sm border border-rule bg-card p-5 shadow-sm">
      <h2 className="font-semibold">Payroll schedule</h2>
      <p className="mt-1 text-sm text-muted-foreground">Snapshot the period that has just ended, without anyone pressing anything.</p>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={activeAuto} onChange={(event) => setAutoFinalise(event.target.checked)} />
        <span>
          <span className="font-medium text-foreground">Finalise automatically on pay day</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            Off by default. A run is only ever <strong>finalised</strong> — nobody sees a payslip until someone enters the tax and National
            Insurance and issues it, because DUMA does not calculate them.
          </span>
        </span>
      </label>

      <div className="mt-4 space-y-3">
        <Select
          value={activePeriod}
          onValueChange={(value) => setPeriod(value as 'weekly' | 'monthly')}
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'weekly', label: 'Weekly' },
          ]}
          ariaLabel="Payroll cadence"
        />

        {activePeriod === 'monthly' ? (
          <Select
            value={String(payDay ?? settings?.payrollPayDayOfMonth ?? 1)}
            onValueChange={setPayDay}
            options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1} of the month` }))}
            ariaLabel="Pay day of the month"
          />
        ) : (
          <Select
            value={String(payWeekday ?? settings?.payrollPayWeekday ?? 1)}
            onValueChange={setPayWeekday}
            options={WEEKDAYS.map((label, index) => ({ value: String(index + 1), label }))}
            ariaLabel="Pay weekday"
          />
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Pay day comes <strong>after</strong> the period closes, so every hour in the run has been worked: on day 20 monthly, the run
          covers the whole of the previous month. A day past the end of a short month runs on its last day instead of being skipped.
        </p>

        {settings?.payrollLastAutoPeriodEnd && (
          <p className="text-xs text-muted-foreground">
            Last automatic run covered the period ending {formatDate(settings.payrollLastAutoPeriodEnd)}.
          </p>
        )}

        <Button onClick={() => save.mutate()} disabled={!settings || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save schedule'}
        </Button>
      </div>
    </section>
  );
}
