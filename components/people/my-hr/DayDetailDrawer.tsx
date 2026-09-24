'use client';
import { useQuery } from '@tanstack/react-query';

import { CalendarCheck, CalendarDays, Clock, Equal, FileText, Sun, UserRound } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { AttendanceDay } from '@/lib/modules/people/client';
import { getMyLeaveRequests } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { getMyShifts } from '@/lib/modules/workforce/client';

import { fmt } from './shared';

/**
 * Everything known about one day, joined from the three places it lives: the
 * rota said one thing, the clock recorded another, and leave may explain the
 * gap. The attendance calendar only holds totals, so the detail is fetched
 * here — reusing the cache keys the rota and the workspace already fill.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const hrs = (hours: number) => `${Math.round(hours * 10) / 10}h`;
const toHours = (minutes: number) => (Number(minutes) || 0) / 60;
const duration = (from: string, to: string) => hrs((new Date(to).getTime() - new Date(from).getTime()) / 3600000);

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' | 'reference' }> = {
  full: { label: 'Worked', variant: 'success' },
  partial: { label: 'Short', variant: 'warning' },
  missed: { label: 'Missed', variant: 'destructive' },
  leave: { label: 'Leave', variant: 'reference' },
  scheduled: { label: 'Rostered', variant: 'muted' },
  no_shift: { label: 'No shift', variant: 'muted' },
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
      description={planned > 0 || worked > 0 ? `${hrs(worked)} worked of ${hrs(planned)} rostered` : undefined}
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
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={status.variant}>{status.label}</Badge>
          {comparable && variance !== 0 && (
            <span className={`font-mono text-sm tabular-nums ${variance < 0 ? 'text-warning' : 'text-muted-foreground'}`}>
              {variance > 0 ? '+' : '−'}
              {hrs(Math.abs(variance))} against your roster
            </span>
          )}
        </div>

        <Section title="Rostered">
          {rostered.length === 0 ? (
            <Empty>No shift was rostered for this day.</Empty>
          ) : (
            <InfoGroup className="border-0 bg-transparent px-0 py-0">
              {rostered.map((shift) => (
                <InfoRow
                  key={shift.id}
                  icon={Clock}
                  label={shift.role ? `Shift · ${shift.role}` : 'Shift'}
                  value={`${time(shift.startsAt)} – ${time(shift.endsAt)}`}
                  hint={shift.location?.name ?? undefined}
                />
              ))}
              {rostered[0]?.notes && <InfoRow icon={FileText} label="Note from your manager" value={rostered[0].notes} />}
            </InfoGroup>
          )}
        </Section>

        <Section title="What was recorded">
          {clocked.length === 0 ? (
            <Empty>
              {day.status === 'missed'
                ? 'No clock-in was recorded. If you did work this day, query it below.'
                : day.status === 'scheduled'
                  ? 'This shift has not happened yet.'
                  : 'Nothing was clocked on this day.'}
            </Empty>
          ) : (
            <ClockTimeline shifts={clocked} />
          )}
        </Section>

        {(leave || day.leaveName) && (
          <Section title="Leave">
            <InfoGroup className="border-0 bg-transparent px-0 py-0">
              <InfoRow icon={Sun} label="Type" value={leave?.leaveType.name ?? day.leaveName ?? undefined} />
              {leave && (
                <>
                  <InfoRow
                    icon={CalendarDays}
                    label="Booked"
                    value={`${fmt(leave.startDate)} – ${fmt(leave.endDate)}`}
                    hint={`${leave.totalDays} days`}
                  />
                  <InfoRow icon={CalendarCheck} label="Approval" value={leave.status} />
                  {leave.notes && <InfoRow icon={FileText} label="Your note" value={leave.notes} />}
                  {leave.reviewNotes && <InfoRow icon={UserRound} label="HR note" value={leave.reviewNotes} />}
                </>
              )}
            </InfoGroup>
          </Section>
        )}

        {planned > 0 && (
          <Section title="Hours">
            <InfoGroup className="border-0 bg-transparent px-0 py-0">
              <InfoRow icon={CalendarCheck} label="Rostered" value={hrs(planned)} />
              <InfoRow icon={Clock} label="Worked" value={hrs(worked)} />
              <InfoRow
                icon={Equal}
                label="Difference"
                value={variance === 0 ? 'Matches your roster' : `${variance > 0 ? '+' : '−'}${hrs(Math.abs(variance))}`}
              />
            </InfoGroup>
          </Section>
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
              className={`absolute -left-[1.3125rem] top-3 size-2 rounded-full ring-2 ring-card ${
                event.kind === 'gap' ? 'bg-band ring-card' : event.kind === 'in' ? 'bg-momentum' : 'bg-muted-foreground'
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
