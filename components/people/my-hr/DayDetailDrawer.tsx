'use client';
import { useQuery } from '@tanstack/react-query';

import { CalendarCheck } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';

import type { AttendanceDay } from '@/lib/modules/people/client';
import { getMyLeaveRequests } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { getMyShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { formatInstant, workspaceDateKey } from '@/lib/utils/workspace-time';

import { fmt } from './shared';

/**
 * Everything known about one day, joined from the three places it lives: the
 * rota said one thing, the clock recorded another, and leave may explain the
 * gap. The attendance calendar only holds totals, so the detail is fetched
 * here — reusing the cache keys the rota and the workspace already fill.
 */

const localDate = (iso: string) => workspaceDateKey(iso);
const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
const hrs = (hours: number) => `${Math.round(hours * 10) / 10}h`;
const toHours = (minutes: number) => (Number(minutes) || 0) / 60;
const duration = (from: string, to: string) => hrs((new Date(to).getTime() - new Date(from).getTime()) / 3600000);

/** The attendance status as the audit pill and tile tints, so the drawer matches the calendar cell it opened from. */
const STATUS_LABEL: Record<string, { label: string; pill: string; tile: string }> = {
  full: { label: 'Worked', pill: 'bg-momentum/8 text-momentum', tile: 'bg-momentum/10 text-momentum' },
  partial: { label: 'Short', pill: 'bg-measured/10 text-measured', tile: 'bg-measured/10 text-measured' },
  missed: { label: 'Missed', pill: 'bg-exception/8 text-exception', tile: 'bg-exception/8 text-exception' },
  leave: { label: 'Leave', pill: 'bg-reference/8 text-reference', tile: 'bg-reference/8 text-reference' },
  scheduled: { label: 'Rostered', pill: 'bg-band text-muted-foreground', tile: 'bg-band text-muted-foreground' },
  no_shift: { label: 'No shift', pill: 'bg-band text-muted-foreground', tile: 'bg-band text-muted-foreground' },
};

export function DayDetailDrawer({ day, onClose, onQuery }: { day: AttendanceDay; onClose: () => void; onQuery: () => void }) {
  const status = STATUS_LABEL[day.status] ?? STATUS_LABEL.no_shift;
  const worked = toHours(day.workedMinutes);
  const planned = toHours(day.plannedMinutes);
  const variance = Math.round((worked - planned) * 100) / 100;
  const comparable = day.status === 'full' || day.status === 'partial' || day.status === 'missed';

  const { data: rostered = [] } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-scheduled-shifts', day.date, day.date),
    queryFn: () => getMyScheduledShifts({ from: day.date, to: day.date }),
    retry: false,
  });
  // Shared with the rota page's cache; the endpoint returns the whole history,
  // so the day is picked out here rather than round-tripping per date.
  const { data: allShifts = [] } = useQuery({ queryKey: moduleQueryKeys.workforce.key('shifts-my'), queryFn: getMyShifts, retry: false });
  const { data: leaveRequests = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('leave-requests-me'), queryFn: getMyLeaveRequests });

  const clocked = allShifts.filter((shift) => localDate(shift.clockedIn) === day.date);
  const leave = leaveRequests.find(
    (request) => request.status === 'approved' && request.startDate.slice(0, 10) <= day.date && request.endDate.slice(0, 10) >= day.date,
  );

  const dayName = new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Drawer
      title={dayName}
      // The day's figures, said once: status, worked of rostered, and the difference when it matters.
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', status.pill)}>{status.label}</span>
          {(planned > 0 || worked > 0) && (
            <span className="tabular-nums">
              {hrs(worked)} worked of {hrs(planned)} rostered
              {comparable && variance !== 0 && (
                <span className={cn('font-semibold', variance < 0 ? 'text-measured' : 'text-foreground')}>
                  {' '}
                  · {variance > 0 ? '+' : '−'}
                  {hrs(Math.abs(variance))}
                </span>
              )}
            </span>
          )}
        </span>
      }
      leading={
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', status.tile)}>
          <CalendarCheck size={18} aria-hidden="true" />
        </span>
      }
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Something wrong with this day?</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onQuery}>Query this day</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <SectionTitle>Rostered</SectionTitle>
          {rostered.length === 0 ? (
            <Empty>No shift was rostered for this day.</Empty>
          ) : (
            <Panel>
              {rostered.map((shift) => (
                <Row key={shift.id} label={shift.role ? `Shift · ${shift.role}` : 'Shift'}>
                  <span className="font-mono font-semibold tabular-nums">
                    {time(shift.startsAt)}–{time(shift.endsAt)}
                  </span>
                  {shift.location?.name && <span className="text-muted-foreground">· {shift.location.name}</span>}
                </Row>
              ))}
              {rostered[0]?.notes && (
                <Row label="Manager’s note">
                  <span className="whitespace-pre-wrap">{rostered[0].notes}</span>
                </Row>
              )}
            </Panel>
          )}
        </section>

        <section>
          <SectionTitle>What was recorded</SectionTitle>
          {clocked.length === 0 ? (
            <Empty tone={day.status === 'missed' ? 'exception' : 'muted'}>
              {day.status === 'missed'
                ? 'No clock-in was recorded. If you did work this day, query it below.'
                : day.status === 'scheduled'
                  ? 'This shift has not happened yet.'
                  : 'Nothing was clocked on this day.'}
            </Empty>
          ) : (
            <div className="rounded-lg border border-rule/60 bg-field px-4 py-3">
              <ClockTimeline shifts={clocked} />
            </div>
          )}
        </section>

        {(leave || day.leaveName) && (
          <section>
            <SectionTitle>Leave</SectionTitle>
            <Panel>
              <Row label="Type">{leave?.leaveType.name ?? day.leaveName}</Row>
              {leave && (
                <>
                  <Row label="Booked">
                    {fmt(leave.startDate)} – {fmt(leave.endDate)}
                    <span className="text-muted-foreground">· {leave.totalDays} days</span>
                  </Row>
                  <Row label="Approval">
                    <span className="capitalize">{leave.status}</span>
                  </Row>
                  {leave.notes && <Row label="Your note">{leave.notes}</Row>}
                  {leave.reviewNotes && <Row label="HR note">{leave.reviewNotes}</Row>}
                </>
              )}
            </Panel>
          </section>
        )}
      </div>
    </Drawer>
  );
}

/**
 * Clock events as a timeline rather than paired rows.
 *
 * A split shift produces four events, and as label/value rows they read as two
 * unrelated blocks with no sense of sequence. On a rail they read as a day: in,
 * out, back in, out — with the gaps between them visible, which is usually the
 * thing being queried.
 */
function ClockTimeline({
  shifts,
}: {
  shifts: { id: string; clockedIn: string; clockedOut?: string | null; location?: { name: string } | null }[];
}) {
  const ordered = [...shifts].sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  const totalMinutes = ordered.reduce(
    (sum, shift) => sum + (shift.clockedOut ? (new Date(shift.clockedOut).getTime() - new Date(shift.clockedIn).getTime()) / 60000 : 0),
    0,
  );

  // Flatten to events so the gap between one clock-out and the next clock-in is
  // a real entry rather than something the reader has to infer.
  const events: { key: string; kind: 'in' | 'out' | 'gap'; label: string; at?: string; detail?: string }[] = [];
  ordered.forEach((shift, index) => {
    const previous = ordered[index - 1];
    if (previous?.clockedOut) {
      const gap = (new Date(shift.clockedIn).getTime() - new Date(previous.clockedOut).getTime()) / 60000;
      if (gap > 0) events.push({ key: `gap-${shift.id}`, kind: 'gap', label: `${hrs(gap / 60)} break`, at: undefined });
    }
    events.push({
      key: `${shift.id}-in`,
      kind: 'in',
      label: 'Clocked in',
      at: time(shift.clockedIn),
      detail: shift.location?.name ?? undefined,
    });
    events.push({
      key: `${shift.id}-out`,
      kind: 'out',
      label: shift.clockedOut ? 'Clocked out' : 'Still clocked in',
      at: shift.clockedOut ? time(shift.clockedOut) : undefined,
      detail: shift.clockedOut ? `${duration(shift.clockedIn, shift.clockedOut)} on the clock` : undefined,
    });
  });

  return (
    <div>
      <ol className="relative space-y-0 border-l border-rule pl-4">
        {events.map((event) => (
          <li key={event.key} className="relative py-1.5">
            <span
              className={`absolute -left-[1.3125rem] top-3 size-2 rounded-full ring-2 ring-field ${
                event.kind === 'gap' ? 'bg-band ring-field' : event.kind === 'in' ? 'bg-momentum' : 'bg-muted-foreground'
              }`}
              aria-hidden="true"
            />
            {event.kind === 'gap' ? (
              <p className="text-xs text-muted-foreground">{event.label}</p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-sm tabular-nums text-foreground">{event.at ?? '—'}</span>
                <span className="text-sm text-foreground">{event.label}</span>
                {event.detail && <span className="text-xs text-muted-foreground">{event.detail}</span>}
              </div>
            )}
          </li>
        ))}
      </ol>
      {totalMinutes > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{hrs(totalMinutes / 60)}</span> on the clock
          {ordered.length > 1 ? ` across ${ordered.length} shifts` : ''}
        </p>
      )}
    </div>
  );
}

// ── Pieces — the audit inspector's ────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <dl className="overflow-hidden rounded-lg border border-rule/60 bg-field">{children}</dl>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Empty({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'exception' }) {
  return (
    <p
      className={cn(
        'rounded-lg px-3.5 py-3 text-sm',
        tone === 'exception'
          ? 'border border-exception/30 bg-exception/5 text-foreground'
          : 'border border-dashed border-rule/60 text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}
