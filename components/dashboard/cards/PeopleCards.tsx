'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';

import { requestType, subjectName } from '@/components/compliance/privacyCopy';
import { Flag, ModuleReading, NeedRows, Parts } from '@/components/dashboard/ModuleCards';
import { Widget, WidgetDot } from '@/components/dashboard/widget/Widget';
import { CATEGORY_META } from '@/components/helpdesk/shared';
import { CalendarDays, ChevronRight, CircleHelp, ShieldCheck } from '@/components/icons';
import { RecordLink, useRecordHrefs } from '@/components/shared/RecordLink';
import { TONE_FILL, type Tone } from '@/components/shared/tone';

import { hasCapability } from '@/lib/auth/capabilities';
import { leaveQueue, openTickets, privacyQueue } from '@/lib/dashboard/people-cards';
import { getPrivacyRequests } from '@/lib/modules/compliance/client';
import {
  type HelpdeskTicket,
  type LeaveRequest,
  getEntitlements,
  getManagedLeaveRequests,
  getManagedTickets,
} from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts } from '@/lib/modules/workforce/client';
import { plural } from '@/lib/utils/format';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatCalendarDate, formatInstant, workspaceDateKey, zonedToInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* The people cards: time off to decide, the helpdesk and privacy requests.
 * Each reads its screen's own query — same key, same cache — so a decision
 * made there clears the row here, and each row's name opens that person's
 * record when the viewer may see it. */

// ── A row with a person in it ────────────────────────────────────────────────

interface PersonRow {
  key: string;
  /** Where the row's work is done. */
  href: string;
  /** What the row's link says to a screen reader. */
  label: string;
  tone: Tone;
  toneLabel: string;
  title: ReactNode;
  detail?: ReactNode;
  value: ReactNode;
}

/**
 * WidgetRow's shape, with room for a record link inside it: the row's own link
 * is stretched behind the content rather than wrapping it, so a person's name
 * can be its own link to their record without nesting one anchor in another.
 */
function PersonRows({ rows, capacity, detailed, moreHref }: { rows: PersonRow[]; capacity: number; detailed: boolean; moreHref: string }) {
  const fits = rows.length > capacity ? Math.max(1, capacity - 1) : rows.length;
  const hidden = rows.length - fits;
  return (
    <div className="min-w-0">
      <ul>
        {rows.slice(0, fits).map((row) => (
          <li
            key={row.key}
            className="relative -mx-2 flex min-h-8 items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-card/80"
          >
            <Link
              href={row.href}
              aria-label={row.label}
              className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            />
            <WidgetDot className={TONE_FILL[row.tone]} label={row.toneLabel} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-[18px] text-heading">{row.title}</span>
              {detailed && row.detail && <span className="block truncate text-[11px] leading-4 text-muted-foreground">{row.detail}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-normal text-muted-foreground tabular-nums">{row.value}</span>
            <ChevronRight size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Link href={moreHref} className="pt-0.5 text-[11px] text-muted-foreground hover:text-heading">
          and {hidden} more
        </Link>
      )}
    </div>
  );
}

/** A name that opens its record above the row's own link. */
const Name = ({ href, children }: { href: string | null; children: ReactNode }) => (
  <RecordLink href={href} className="relative z-10">
    {children}
  </RecordLink>
);

const ink = (tone: Tone | null | undefined, text: ReactNode) => (tone ? <Flag tone={tone}>{text}</Flag> : text);

// ── Time off ─────────────────────────────────────────────────────────────────

const REQUESTS = '/staff/requests';

export function TimeOffCard() {
  const capabilities = useAuthStore((state) => state.capabilities);
  // As the HR inbox: balances need hr.leave:read, clashes with the rota need scheduling:read.
  const canSeeBalances = hasCapability(capabilities, 'hr.leave:read');
  const canSeeRota = hasCapability(capabilities, 'scheduling:read');
  const [now] = useState(() => new Date());

  // The inbox's own keys: deciding there invalidates `leave-managed` and the card follows.
  const pending = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', 'pending'),
    queryFn: () => getManagedLeaveRequests('pending'),
  });
  const approved = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', 'approved'),
    queryFn: () => getManagedLeaveRequests('approved'),
  });
  const entitlements = useQuery({
    queryKey: moduleQueryKeys.people.key('entitlements', now.getFullYear()),
    queryFn: () => getEntitlements(),
    enabled: canSeeBalances,
    meta: { silentError: true },
  });
  // One rota read spanning every waiting request, as the inbox makes it.
  const dateSpan = useMemo(() => {
    const rows = (pending.data ?? []).filter((request) => request.status === 'pending');
    if (rows.length === 0) return null;
    const starts = rows.map((row) => row.startDate.slice(0, 10)).sort();
    const ends = rows.map((row) => row.endDate.slice(0, 10)).sort();
    const from = zonedToInstant(starts[0], '00:00') ?? new Date(`${starts[0]}T00:00:00`);
    const lastMinute = zonedToInstant(ends[ends.length - 1], '23:59');
    const to = lastMinute ? new Date(lastMinute.getTime() + 59_000) : new Date(`${ends[ends.length - 1]}T23:59:59`);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [pending.data]);
  const shifts = useQuery({
    queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', 'leave-review', dateSpan?.from, dateSpan?.to),
    queryFn: () => getScheduledShifts({ from: dateSpan!.from, to: dateSpan!.to }),
    enabled: canSeeRota && !!dateSpan,
    meta: { silentError: true },
  });

  // A failed clash check is not a clear one: until both are read, only the allowance and the wait can flag.
  const checking = !approved.isSuccess || (canSeeRota && !!dateSpan && !shifts.isSuccess);
  const queue = useMemo(
    () =>
      leaveQueue(
        pending.data ?? [],
        { approved: approved.data ?? [], shifts: shifts.data ?? [], entitlements: entitlements.data ?? null },
        now,
        checking,
      ),
    [pending.data, approved.data, shifts.data, entitlements.data, now, checking],
  );

  return (
    <Widget
      title="Time off to decide"
      icon={CalendarDays}
      tint="team"
      surface="plain"
      href={REQUESTS}
      hrefLabel="Open time off requests"
      loading={pending.isPending}
      error={pending.isError}
      onRetry={() => void pending.refetch()}
      empty={pending.data && queue.rows.length === 0 ? { title: 'Nobody is waiting' } : undefined}
    >
      {queue.rows.length > 0 && <TimeOffReading queue={queue} startingSoon={startingSoon(queue.rows, now)} />}
    </Widget>
  );
}

/** Waiting requests whose leave starts within a week, today included, on the workspace's calendar. */
function startingSoon(rows: { request: LeaveRequest }[], now: Date) {
  const today = workspaceDateKey(now);
  const weekOut = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  return rows.filter(({ request }) => request.startDate.slice(0, 10) >= today && request.startDate.slice(0, 10) < weekOut).length;
}

const DATE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

/**
 * The waiting requests as the figure, the queue as one split by urgency, then
 * each request by name — the one that needs a decision most first, with the
 * one thing the HR inbox would say about it.
 */
function TimeOffReading({ queue, startingSoon }: { queue: ReturnType<typeof leaveQueue<LeaveRequest>>; startingSoon: number }) {
  const hrefs = useRecordHrefs();
  const { rows, counts, days } = queue;
  const share = (value: number) => value / Math.max(rows.length, 1);
  const urgent = counts.exception > 0 && (
    <Flag key="urgent" tone="exception">
      {counts.exception} urgent
    </Flag>
  );
  const check = counts.warning > 0 && (
    <Flag key="check" tone="warning">
      {counts.warning} to check
    </Flag>
  );

  return (
    <ModuleReading
      value={rows.length.toLocaleString('en-GB')}
      unit="waiting"
      noun={['request', 'requests']}
      caption={`waiting · ${plural(days, 'day')} asked for`}
      status={<Parts>{[urgent, check, startingSoon > 0 && `${startingSoon} start this week`]}</Parts>}
      slimStatus={urgent || check || (startingSoon > 0 ? `${startingSoon} start this week` : 'Nothing pressing')}
      segments={[
        {
          key: 'urgent',
          label: 'Urgent',
          value: counts.exception,
          share: share(counts.exception),
          fill: 'bg-exception',
          legend: counts.exception,
        },
        {
          key: 'check',
          label: 'To check',
          value: counts.warning,
          share: share(counts.warning),
          fill: 'bg-measured',
          legend: counts.warning,
        },
        { key: 'clear', label: 'Clear', value: counts.calm, share: share(counts.calm), fill: 'bg-momentum', legend: counts.calm },
      ]}
      listTitle="To decide"
      list={(capacity, detailed) => (
        <PersonRows
          capacity={capacity}
          detailed={detailed}
          moreHref={REQUESTS}
          rows={rows.map(({ request, flag }) => {
            const name = request.employee?.name || request.employee?.email || 'Employee';
            const sameDay = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);
            const dates = sameDay
              ? formatCalendarDate(request.startDate, DATE)
              : `${formatCalendarDate(request.startDate, DATE)} – ${formatCalendarDate(request.endDate, DATE)}`;
            return {
              key: request.id,
              href: REQUESTS,
              label: `${name}, ${dates}: ${flag.label}`,
              tone: flag.urgency === 'calm' ? 'success' : flag.urgency,
              toneLabel: flag.urgency === 'exception' ? 'Urgent' : flag.urgency === 'warning' ? 'To check' : 'Clear',
              title: <Name href={hrefs.staff(request.userId)}>{name}</Name>,
              detail: `${dates} · ${plural(Number(request.totalDays), 'day')} · ${request.leaveType.name}`,
              value: ink(flag.tone, flag.label),
            };
          })}
        />
      )}
    />
  );
}

// ── Helpdesk ─────────────────────────────────────────────────────────────────

const HELPDESK = '/staff/helpdesk';

export function HelpdeskCard() {
  const [now] = useState(() => Date.now());
  // The Staff workspace's open-tickets key, shared with its tab badge and the overview.
  const tickets = useQuery({
    queryKey: moduleQueryKeys.support.key('helpdesk-managed', 'open', '', ''),
    queryFn: () => getManagedTickets({ status: 'open' }),
  });
  const queue = useMemo(() => openTickets(tickets.data ?? [], now), [tickets.data, now]);

  return (
    <Widget
      title="Helpdesk"
      icon={CircleHelp}
      tint="team"
      surface="plain"
      href={HELPDESK}
      hrefLabel="Open the helpdesk"
      loading={tickets.isPending}
      error={tickets.isError}
      onRetry={() => void tickets.refetch()}
      empty={tickets.data && queue.rows.length === 0 ? { title: 'No open requests' } : undefined}
    >
      {queue.rows.length > 0 && <HelpdeskReading queue={queue} now={now} />}
    </Widget>
  );
}

/** Open tickets as the figure, split by urgency, then each by its subject, the longest waiting first. */
function HelpdeskReading({ queue, now }: { queue: ReturnType<typeof openTickets<HelpdeskTicket>>; now: number }) {
  const hrefs = useRecordHrefs();
  const { rows, counts, oldestDays } = queue;
  const share = (value: number) => value / Math.max(rows.length, 1);
  const urgent = counts.exception > 0 && (
    <Flag key="urgent" tone="exception">
      {counts.exception} urgent
    </Flag>
  );
  const waited = oldestDays > 0 ? `Oldest ${plural(oldestDays, 'day')}` : 'All from today';

  return (
    <ModuleReading
      value={rows.length.toLocaleString('en-GB')}
      unit="open"
      noun={['request', 'requests']}
      caption={`open · ${waited.toLowerCase()}`}
      status={<Parts>{[urgent, counts.warning > 0 && `${counts.warning} high or going stale`, waited]}</Parts>}
      slimStatus={urgent || waited}
      segments={[
        {
          key: 'urgent',
          label: 'Urgent',
          value: counts.exception,
          share: share(counts.exception),
          fill: 'bg-exception',
          legend: counts.exception,
        },
        {
          key: 'high',
          label: 'High or stale',
          value: counts.warning,
          share: share(counts.warning),
          fill: 'bg-measured',
          legend: counts.warning,
        },
        { key: 'normal', label: 'Normal', value: counts.calm, share: share(counts.calm), fill: 'bg-reference', legend: counts.calm },
      ]}
      listTitle="Waiting longest"
      list={(capacity, detailed) => (
        <PersonRows
          capacity={capacity}
          detailed={detailed}
          moreHref={HELPDESK}
          rows={rows.map(({ ticket, urgency, stale }) => {
            const who = ticket.employee?.name;
            return {
              key: ticket.id,
              href: `${HELPDESK}?ticket=${ticket.id}`,
              label: `${ticket.subject}${who ? `, from ${who}` : ''}`,
              tone: urgency === 'calm' ? 'info' : urgency,
              toneLabel:
                ticket.priority === 'urgent' ? 'Urgent' : ticket.priority === 'high' ? 'High priority' : stale ? 'Going stale' : 'Open',
              title: ticket.subject,
              detail: (
                <>
                  {who ? <Name href={hrefs.staff(ticket.employee?.id ?? ticket.createdBy)}>{who}</Name> : 'Someone'}
                  {` · ${CATEGORY_META[ticket.category]?.label ?? 'Other'}`}
                </>
              ),
              value: ink(urgency === 'calm' ? null : urgency, relativeTime(ticket.createdAt, now)),
            };
          })}
        />
      )}
    />
  );
}

// ── Privacy requests ─────────────────────────────────────────────────────────

const COMPLIANCE = '/compliance';

export function PrivacyRequestsCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [now] = useState(() => Date.now());
  // The Compliance queue's key — tenant, no customer, no employee — so working a request there clears it here.
  const requests = useQuery({
    queryKey: moduleQueryKeys.compliance.key('privacy-requests', tenantId ?? undefined, undefined, undefined),
    queryFn: () => getPrivacyRequests({ tenantId: tenantId ?? undefined }),
    enabled: Boolean(tenantId),
  });
  const queue = useMemo(() => privacyQueue(requests.data ?? [], now), [requests.data, now]);

  return (
    <Widget
      title="Privacy requests"
      icon={ShieldCheck}
      tint="brand"
      surface="plain"
      href={COMPLIANCE}
      hrefLabel="Open privacy requests"
      loading={Boolean(tenantId) && requests.isPending}
      error={requests.isError}
      onRetry={() => void requests.refetch()}
      empty={
        !tenantId
          ? { title: 'Choose a workspace' }
          : requests.data && queue.rows.length === 0
            ? { title: 'Nothing waiting', detail: 'Each request must be answered within a month.' }
            : undefined
      }
    >
      {queue.rows.length > 0 && <PrivacyReading queue={queue} />}
    </Widget>
  );
}

const DEADLINE_TONE = { overdue: 'exception', today: 'exception', soon: 'warning', calm: null, done: null } as const;

/**
 * Open requests as the figure, split by their statutory deadline — overdue,
 * due within a week, on time — then each by the person it is about, the
 * soonest due first.
 */
function PrivacyReading({ queue }: { queue: ReturnType<typeof privacyQueue<Awaited<ReturnType<typeof getPrivacyRequests>>[number]>> }) {
  const hrefs = useRecordHrefs();
  const { rows, counts } = queue;
  const share = (value: number) => value / Math.max(rows.length, 1);
  const overdue = counts.overdue > 0 && (
    <Flag key="overdue" tone="exception">
      {counts.overdue} overdue
    </Flag>
  );
  const soon = counts.soon > 0 && (
    <Flag key="soon" tone="warning">
      {counts.soon} due this week
    </Flag>
  );

  return (
    <ModuleReading
      value={rows.length.toLocaleString('en-GB')}
      unit="open"
      noun={['request', 'requests']}
      caption="open · answer within a month"
      status={overdue || soon ? <Parts>{[overdue, soon]}</Parts> : 'Nothing due this week'}
      slimStatus={overdue || soon || 'Nothing due this week'}
      segments={[
        {
          key: 'overdue',
          label: 'Overdue',
          value: counts.overdue,
          share: share(counts.overdue),
          fill: 'bg-exception',
          legend: counts.overdue,
        },
        { key: 'soon', label: 'Due this week', value: counts.soon, share: share(counts.soon), fill: 'bg-measured', legend: counts.soon },
        { key: 'calm', label: 'On time', value: counts.calm, share: share(counts.calm), fill: 'bg-momentum', legend: counts.calm },
      ]}
      listTitle="Due soonest"
      list={(capacity, detailed) => {
        if (rows.length === 0) return <NeedRows items={[]} clear="Nothing waiting" capacity={1} detailed={false} />;
        return (
          <PersonRows
            capacity={capacity}
            detailed={detailed}
            moreHref={COMPLIANCE}
            rows={rows.map(({ request, deadline }) => {
              const name = subjectName(request) ?? 'No name on file';
              const href = request.subjectType === 'customer' ? hrefs.customer(request.customerId) : hrefs.staff(request.employeeUserId);
              const tone = DEADLINE_TONE[deadline.tone];
              return {
                key: request.id,
                href: COMPLIANCE,
                label: `${requestType(request.type).label} for ${name}: ${deadline.label}`,
                tone: tone ?? 'primary',
                toneLabel: deadline.label,
                title: <Name href={href}>{name}</Name>,
                detail: `${requestType(request.type).label} · due ${formatInstant(request.dueAt, { day: 'numeric', month: 'short' })}`,
                value: ink(tone, deadline.label),
              };
            })}
          />
        );
      }}
    />
  );
}
