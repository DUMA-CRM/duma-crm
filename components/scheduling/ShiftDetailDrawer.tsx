'use client';

import { CalendarClock, CheckCircle2, Clock, Coffee, FileText, MapPin } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';

import type { ScheduledShift, Shift } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import {
  type RotaChange,
  formatDuration,
  paidMinutes,
  plannedMinutes,
  shiftProgress,
  shiftState,
  unpaidBreak,
  workedMinutes,
} from '@/lib/utils/my-rota';
import { formatInstant } from '@/lib/utils/workspace-time';

import type { BreakRule } from './WeekSchedule';

const fmtTime = (value: Date | string) => formatInstant(value, { hour: '2-digit', minute: '2-digit' });
const fmtDate = (value: Date | string) => formatInstant(value, { weekday: 'long', day: 'numeric', month: 'long' });

const PILL = 'rounded-sm px-1.5 py-0.5 text-micro font-semibold';

export type ShiftDetail = { kind: 'shift'; shift: ScheduledShift; worked: Shift[] } | { kind: 'unplanned'; run: Shift[] };

/**
 * Everything about one shift on your rota, laid out as the audit inspector is:
 * the shift's own tile and time as the header, then titled sections of
 * label/value rows — the plan, any note from your manager, and what the clock
 * recorded against it. An unplanned stretch opens the same drawer, with only
 * the clock's side to tell.
 */
export function ShiftDetailDrawer({
  detail,
  now,
  breakRule,
  change,
  hourlyRate,
  money,
  onClose,
}: {
  detail: ShiftDetail;
  now: number;
  breakRule?: BreakRule;
  change?: RotaChange;
  /** Only for hourly pay; the estimate is hidden otherwise. */
  hourlyRate: number | null;
  money: (amount: number) => string;
  onClose: () => void;
}) {
  if (detail.kind === 'unplanned') {
    const { run } = detail;
    const first = run[0];
    const last = run.at(-1)!;
    return (
      <Drawer
        title={`Unplanned · ${formatDuration(workedMinutes(run, now))}`}
        description={fmtDate(first.clockedIn)}
        leading={<Tile className="bg-momentum/10 text-momentum" />}
        onClose={onClose}
        footer={<CloseButton onClose={onClose} />}
      >
        <div className="space-y-6">
          <section>
            <SectionTitle>On the clock</SectionTitle>
            <ClockList entries={run} now={now} />
          </section>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This time isn’t on your published rota ({fmtTime(first.clockedIn)}–{last.clockedOut ? fmtTime(last.clockedOut) : 'now'}). Pay
            follows the rota, so check with your manager that it was agreed.
          </p>
        </div>
      </Drawer>
    );
  }

  const { shift, worked } = detail;
  const state = shiftState(shift, now);
  const planned = plannedMinutes(shift);
  const gap = unpaidBreak(planned, breakRule);
  const breakFrom = gap ? new Date(new Date(shift.startsAt).getTime() + gap.from * 60_000) : null;
  const breakTo = gap ? new Date(new Date(shift.startsAt).getTime() + gap.to * 60_000) : null;
  const paid = paidMinutes(shift, breakRule);
  const clocked = workedMinutes(worked, now);
  const progress = shiftProgress(shift, now);
  const missed = state === 'done' && worked.length === 0;
  const difference = state === 'done' && worked.length > 0 ? clocked - planned : 0;

  return (
    <Drawer
      title={`${fmtTime(shift.startsAt)}–${fmtTime(shift.endsAt)}`}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatePill state={state} missed={missed} />
          {change && <span className={cn(PILL, 'bg-reference/10 text-reference')}>{change === 'new' ? 'New' : 'Changed'}</span>}
          {fmtDate(shift.startsAt)}
        </span>
      }
      leading={<Tile className={state === 'now' ? 'bg-primary/10 text-primary' : 'bg-primary/8 text-primary'} />}
      onClose={onClose}
      footer={<CloseButton onClose={onClose} />}
    >
      <div className="space-y-6">
        {state === 'now' && progress !== null && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-primary">On now · {Math.round(progress * 100)}%</span>
              <span className="tabular-nums text-muted-foreground">{formatDuration((1 - progress) * planned)} left</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-band">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        <section>
          <SectionTitle>The shift</SectionTitle>
          <Panel>
            <Row label="When">
              <span className="font-mono font-semibold tabular-nums">
                {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
              </span>
              <span className="text-muted-foreground">· {formatDuration(planned)}</span>
            </Row>
            <Row label="Where">
              <MapPin size={13} className="self-center text-muted-foreground" aria-hidden="true" />
              {shift.location?.name ?? 'Location not listed'}
            </Row>
            {shift.role && <Row label="As">{shift.role}</Row>}
            <Row label="Break">
              {breakFrom && breakTo && gap ? (
                <>
                  <Coffee size={13} className="self-center text-stock" aria-hidden="true" />
                  {formatDuration(gap.to - gap.from)} unpaid
                  <span className="font-mono tabular-nums text-muted-foreground">
                    · {fmtTime(breakFrom)}–{fmtTime(breakTo)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">None on a shift this long</span>
              )}
            </Row>
            <Row label="Paid time">{formatDuration(paid)}</Row>
            {hourlyRate !== null && (
              <Row label="Est. pay">
                <span className="font-semibold tabular-nums">{money((paid / 60) * hourlyRate)}</span>
                <span className="text-xs text-muted-foreground">before deductions</span>
              </Row>
            )}
          </Panel>
        </section>

        {shift.notes && (
          <section>
            <SectionTitle>Note from your manager</SectionTitle>
            <p className="flex items-start gap-2.5 rounded-lg border border-rule/60 bg-field px-3.5 py-3 text-sm leading-relaxed text-foreground">
              <FileText size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="whitespace-pre-wrap">{shift.notes}</span>
            </p>
          </section>
        )}

        <section>
          <SectionTitle>On the clock</SectionTitle>
          {worked.length > 0 ? (
            <>
              <ClockList entries={worked} now={now} />
              {state === 'done' && (
                <p
                  className={cn(
                    'mt-2 flex items-center gap-1.5 px-1 text-xs',
                    Math.abs(difference) < 5 ? 'text-momentum' : difference > 0 ? 'text-measured' : 'text-muted-foreground',
                  )}
                >
                  <CheckCircle2 size={13} aria-hidden="true" />
                  {Math.abs(difference) < 5
                    ? `Worked ${formatDuration(clocked)} — as planned`
                    : difference > 0
                      ? `Worked ${formatDuration(clocked)} — ${formatDuration(difference)} past the plan, which pay doesn’t cover`
                      : `Worked ${formatDuration(clocked)} — ${formatDuration(-difference)} short of the plan`}
                </p>
              )}
            </>
          ) : missed ? (
            <p className="rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3 text-sm text-foreground">
              <span className="font-semibold text-exception">Not clocked.</span> If you worked this shift, tell your manager so your hours
              can be added.
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
              {state === 'now'
                ? 'You’re not clocked in for this shift yet.'
                : 'Nothing yet — you can clock in from an hour before the start.'}
            </p>
          )}
        </section>
      </div>
    </Drawer>
  );
}

function StatePill({ state, missed }: { state: ReturnType<typeof shiftState>; missed: boolean }) {
  if (missed) return <span className={cn(PILL, 'bg-exception/8 text-exception')}>Not clocked</span>;
  if (state === 'now') return <span className={cn(PILL, 'bg-primary/10 text-primary')}>On now</span>;
  if (state === 'done') return <span className={cn(PILL, 'bg-momentum/8 text-momentum')}>Done</span>;
  return <span className={cn(PILL, 'bg-band text-muted-foreground')}>Upcoming</span>;
}

/** Each clock-in as a row: in, out, how long, and where if it wasn't the planned till. */
function ClockList({ entries, now }: { entries: Shift[]; now: number }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-momentum/10 text-momentum">
            <Clock size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">
              {fmtTime(entry.clockedIn)}–{entry.clockedOut ? fmtTime(entry.clockedOut) : 'now'}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {entry.location?.name ?? 'Clock-in'}
              {!entry.clockedOut && ' · still on the clock'}
            </span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatDuration(workedMinutes([entry], now))}</span>
        </li>
      ))}
    </ul>
  );
}

function Tile({ className }: { className: string }) {
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', className)}>
      <CalendarClock size={18} aria-hidden="true" />
    </span>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="outline" size="lg" className="w-full" onClick={onClose}>
      Close
    </Button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <dl className="overflow-hidden rounded-lg border border-rule/60 bg-field">{children}</dl>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}
