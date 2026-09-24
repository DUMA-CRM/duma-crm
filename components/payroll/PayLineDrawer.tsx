'use client';

import { useQuery } from '@tanstack/react-query';

import { AlertTriangle, CircleAlert, Clock } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';

import { getEmployeeHours } from '@/lib/modules/people/client';
import type { PayrollPeriod, PayrollPreviewLine } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { explainPay, reconciles } from '@/lib/utils/payroll-explain';

import { formatDate, formatRange, hours, money } from './shared';

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * How one person's gross pay was arrived at.
 *
 * The preview gives a figure and no account of itself, which is the wrong way
 * round for money someone is about to be paid. This reads the same timesheet
 * the API computed from and walks the arithmetic back: what was clocked, what
 * of it is payable, and where the rest went.
 */
export function PayLineDrawer({
  line,
  period,
  from,
  to,
  onClose,
}: {
  line: PayrollPreviewLine;
  period: PayrollPeriod;
  from: string;
  to: string;
  onClose: () => void;
}) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-hours', line.userId, from, to),
    queryFn: () => getEmployeeHours(line.userId, from, to),
  });

  const explanation = explainPay(line, period, data?.shifts ?? []);
  const balances = reconciles(line);

  return (
    <Drawer title={line.name} description={`${line.jobTitle} · ${formatRange(from, to)}`} onClose={onClose}>
      <div className="space-y-5">
        {/* The sum itself, stated once, before any of the detail. */}
        <section className="rounded-md border border-rule bg-card p-4">
          {explanation.basis === 'salaried' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Salaried — annual pay divided by {explanation.salaryDivisor}, one {period === 'weekly' ? 'week' : 'month'} of it.
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{money(line.grossPay)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Hours are recorded for attendance and do not change this figure.</p>
            </>
          ) : explanation.basis === 'missing-rate' ? (
            <div className="flex gap-3">
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">No hourly rate on this record</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hours(explanation.payableHours)} are payable, but there is no rate to apply. This is not £0.00 owed — it is a record
                  nobody can be paid from. Add a rate on the employee&rsquo;s record before finalising.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-lg tabular-nums">
                <span className="font-semibold">{hours(explanation.payableHours)}</span>
                <span className="text-muted-foreground">×</span>
                <span className="font-semibold">{money(line.hourlyRate)}</span>
                <span className="text-muted-foreground">=</span>
                <span className="text-2xl font-semibold">{money(line.grossPay)}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Payable hours at the recorded rate, before tax and National Insurance.</p>
              {!balances && (
                <p className="mt-3 flex gap-2 rounded-sm border border-exception/40 bg-card p-2.5 text-xs text-muted-foreground">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
                  <span>
                    This does not come to the gross the server returned. Treat the server&rsquo;s figure as correct and report the
                    difference — do not finalise on the strength of this panel.
                  </span>
                </p>
              )}
            </>
          )}
        </section>

        {/* Where the clocked time went. */}
        <section className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-rule">
          <Figure label="Clocked" value={hours(line.rawHours)} />
          <Figure label="Payable" value={hours(explanation.payableHours)} />
          <Figure label="Unpaid" value={hours(explanation.unpaidHours)} tone={explanation.unpaidHours > 0 ? 'measured' : undefined} />
        </section>

        {explanation.unpaidHours > 0 && (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {explanation.breakHours > 0 && (
              <li>
                <span className="font-semibold text-foreground">{hours(explanation.breakHours)}</span> deducted as unpaid breaks, on shifts
                long enough to trigger one.
              </li>
            )}
            {explanation.overtimeHours > 0 && (
              <li>
                <span className="font-semibold text-foreground">{hours(explanation.overtimeHours)}</span> clocked beyond the rostered slot.
                Time past the roster is not paid automatically.
              </li>
            )}
          </ul>
        )}

        {explanation.unrosteredShifts > 0 && (
          <p className="flex gap-2 rounded-md border border-measured/40 bg-card p-3 text-sm text-muted-foreground" role="note">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">
                {explanation.unrosteredShifts} {explanation.unrosteredShifts === 1 ? 'shift was' : 'shifts were'} worked with no rostered
                slot
              </span>{' '}
              — payable time is capped at the roster, and with no roster the cap is nothing, so those shifts pay <strong>£0.00</strong>.
              Roster them retrospectively if the work was authorised.
            </span>
          </p>
        )}

        {/* Shift by shift. */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Shifts in this period</h3>
          {isError ? (
            <div className="rounded-md border border-rule bg-card">
              <ErrorState
                icon={Clock}
                title="The timesheet couldn’t be loaded"
                description="The totals above still describe this line; only the shift-by-shift detail is missing."
                onRetry={() => void refetch()}
                className="py-8"
              />
            </div>
          ) : isPending ? (
            <div className="h-24 animate-pulse rounded-md bg-band" aria-hidden="true" />
          ) : explanation.shifts.length === 0 ? (
            <p className="rounded-md border border-rule bg-card p-4 text-sm text-muted-foreground">No shifts clocked in this period.</p>
          ) : (
            <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
              {explanation.shifts.map(({ shift, overtimeHours, breakHours, unrostered }) => (
                <li key={shift.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(shift.clockedIn)}
                      <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                        {time(shift.clockedIn)}–{time(shift.clockedOut)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shift.locationName ?? 'Unknown location'}
                      {breakHours > 0 && ` · ${hours(breakHours)} break`}
                      {overtimeHours > 0 && ` · ${hours(overtimeHours)} beyond the roster`}
                    </p>
                  </div>
                  {unrostered && <Badge variant="warning">Unrostered</Badge>}
                  <p className="shrink-0 text-right font-mono text-sm tabular-nums">
                    <span className="font-semibold">{hours(shift.paidHours)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">of {hours(shift.rawHours)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'measured' }) {
  return (
    <div className="bg-card p-3 text-center">
      <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${tone === 'measured' ? 'text-measured' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}
