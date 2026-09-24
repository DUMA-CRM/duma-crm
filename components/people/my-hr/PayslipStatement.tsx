import { AlertTriangle, Download } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { Payslip } from '@/lib/modules/people/client';
import type { AttendanceDay } from '@/lib/modules/people/client';
import { formatDate } from '@/lib/utils/date';
import { payPeriodHours, payslipDeductions, payslipReconciles } from '@/lib/utils/my-hr';

/**
 * An itemised pay statement, as ERA 1996 s.8 requires one to look: gross at the
 * top, every deduction named and shown separately beneath it, net stated last.
 *
 * Rendered from the payslip's own figures rather than from a PDF, because
 * `documentUrl` is optional and a row that links nowhere is not a statement.
 * Where pay varies with hours worked, s.9 also requires the hours — those come
 * from the employee's own attendance record for the same period.
 */

const money = (value: string | number | null | undefined, currency = 'GBP') => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number.isFinite(n) ? n : 0);
};

export function PayslipStatement({
  payslip,
  attendance = [],
  showHours = false,
}: {
  payslip: Payslip;
  attendance?: AttendanceDay[];
  /** True for hourly and zero-hours staff — the ERA s.9 hours breakdown. */
  showHours?: boolean;
}) {
  const deductions = payslipDeductions(payslip);
  const totalDeductions = deductions.reduce((sum, line) => sum + line.amount, 0);
  const hours = showHours ? payPeriodHours(attendance, payslip.payPeriodStart, payslip.payPeriodEnd) : 0;
  const reconciles = payslipReconciles(payslip);

  return (
    <div className="rounded-md border border-rule bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule px-4 py-3 md:px-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {formatDate(payslip.payPeriodStart)} – {formatDate(payslip.payPeriodEnd)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {payslip.finalisedAt ? `Issued ${formatDate(payslip.finalisedAt)}` : 'Not yet issued'}
          </p>
        </div>
        {payslip.documentUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={payslip.documentUrl} target="_blank" rel="noreferrer" className="gap-1.5">
              <Download size={14} aria-hidden="true" /> PDF
            </a>
          </Button>
        )}
      </div>

      <dl className="divide-y divide-rule text-sm">
        <Line label="Gross pay" value={money(payslip.grossPay, payslip.currency)} strong />
        {showHours && (
          <Line
            label="Hours worked this period"
            value={hours > 0 ? `${hours}h` : 'Not recorded'}
            muted={hours === 0}
            note={hours > 0 ? 'From your attendance record' : 'No attendance was recorded for these dates'}
          />
        )}

        {deductions.length > 0 && (
          <div className="px-4 pt-3 pb-1 md:px-5">
            <p className="text-micro font-bold uppercase tracking-micro text-muted-foreground">Deductions</p>
          </div>
        )}
        {deductions.map((line) => (
          <Line key={line.label} label={line.label} value={`− ${money(line.amount, payslip.currency)}`} indent />
        ))}
        {deductions.length > 0 && <Line label="Total deductions" value={`− ${money(totalDeductions, payslip.currency)}`} />}

        <Line label="Take-home pay" value={money(payslip.netPay, payslip.currency)} strong emphasis />
      </dl>

      {!reconciles && (
        <p className="flex items-start gap-2 border-t border-rule bg-warning/6 px-4 py-3 text-sm text-warning md:px-5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Gross pay less the deductions shown does not match your take-home pay. Raise a payroll request so this can be checked.
          </span>
        </p>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  note,
  strong = false,
  emphasis = false,
  indent = false,
  muted = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  emphasis?: boolean;
  indent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-6 px-4 py-2.5 md:px-5 ${indent ? 'pl-7 md:pl-8' : ''}`}>
      <dt className={strong ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </dt>
      <dd
        className={`font-mono tabular-nums ${muted ? 'text-muted-foreground' : emphasis ? 'text-base font-semibold text-foreground' : strong ? 'font-medium text-foreground' : 'text-foreground'}`}
      >
        {value}
      </dd>
    </div>
  );
}
