'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CalendarClock, CalendarRange, Check, CheckCircle2, CircleHelp, Clock3, Loader2, Timer, X } from '@/components/icons';
import { leaveIcon } from '@/components/people/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { DetailRow, Facts } from '@/components/shared/DetailRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { type LeaveRequest, getEntitlements, getManagedLeaveRequests, reviewLeaveRequest } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { type LeaveContext, type LeaveUrgency, leaveContext, leaveFlag, summariseLeaveQueue } from '@/lib/utils/leave-review';
import { daysBetween } from '@/lib/utils/staff-overview';
import { workspaceDateKey, zonedToInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

const STATUSES = ['pending', 'approved', 'declined', 'cancelled'] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  pending: 'Waiting',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/** The row's tile, tinted by the worse of the request's problem and its wait. */
const URGENCY_TILE: Record<LeaveUrgency, Tone> = { calm: 'primary', warning: 'warning', exception: 'exception' };

const CARD = 'rounded-lg border border-border bg-card shadow-sm';

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayOf = (value: string) => {
  const [year, month, date] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, date);
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The leave approval queue: four figures over the waiting requests, then one
 * list — a row per request, its most pressing problem (over allowance, shifts
 * to cover, colleagues off) or its wait on the right in words and colour. A
 * row opens in place with what the decision depends on and Approve/Decline.
 * The status switch shows the history. No optimistic update — an approval
 * spends an entitlement.
 */
export function LeaveInbox({ status, setStatus }: { status: string; setStatus: (value: string) => void }) {
  const qc = useQueryClient();
  const capabilities = useAuthStore((s) => s.capabilities);
  // Balances need the read capability; a reviewer without it still reviews, just without the number.
  const canSeeBalances = hasCapability(capabilities, 'hr.leave:read');
  const canSeeRota = hasCapability(capabilities, 'scheduling:read');
  const [expanded, setExpanded] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', status),
    queryFn: () => getManagedLeaveRequests(status),
  });
  // The tab badge and the overview read this same key.
  const pending = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', 'pending'),
    queryFn: () => getManagedLeaveRequests('pending'),
  });
  const approved = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-managed', 'approved'),
    queryFn: () => getManagedLeaveRequests('approved'),
    enabled: status === 'pending',
  });
  const entitlements = useQuery({
    queryKey: moduleQueryKeys.people.key('entitlements', new Date().getFullYear()),
    queryFn: () => getEntitlements(),
    enabled: canSeeBalances,
    meta: { silentError: true },
  });

  // One rota read spanning every request on screen.
  const rows = useMemo(() => requests.data ?? [], [requests.data]);
  const dateSpan = useMemo(() => {
    if (rows.length === 0) return null;
    const starts = rows.map((row) => row.startDate.slice(0, 10)).sort();
    const ends = rows.map((row) => row.endDate.slice(0, 10)).sort();
    // Whole leave days on the workspace clock, the days the shifts are worked on.
    const from = zonedToInstant(starts[0], '00:00') ?? new Date(`${starts[0]}T00:00:00`);
    const lastMinute = zonedToInstant(ends[ends.length - 1], '23:59');
    const to = lastMinute ? new Date(lastMinute.getTime() + 59_000) : new Date(`${ends[ends.length - 1]}T23:59:59`);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [rows]);
  const shifts = useQuery({
    queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', 'leave-review', dateSpan?.from, dateSpan?.to),
    queryFn: () => getScheduledShifts({ from: dateSpan!.from, to: dateSpan!.to }),
    enabled: canSeeRota && status === 'pending' && !!dateSpan,
    meta: { silentError: true },
  });

  const review = useMutation({
    mutationFn: ({ id, next, note }: { id: string; next: 'approved' | 'declined'; note?: string }) => reviewLeaveRequest(id, next, note),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-managed') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('entitlements') });
      toast('success', variables.next === 'approved' ? 'Leave approved.' : 'Leave declined.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  const deciding = review.isPending ? review.variables?.id : null;

  const [now] = useState(() => new Date());
  const summary = useMemo(() => summariseLeaveQueue(pending.data ?? [], now, workspaceDateKey(now)), [pending.data, now]);
  const checking = approved.isPending || (canSeeRota && shifts.isPending);
  const label = STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;

  const list = requests.isPending ? (
    <ListSkeleton rows={3} label="Loading leave requests" />
  ) : requests.isError ? (
    <div className={CARD}>
      {/* Falling through to "clear" would tell a reviewer nobody is waiting when the read failed. */}
      <ErrorState
        icon={CircleHelp}
        title="Leave requests couldn’t be loaded"
        description="This is not an empty inbox — nothing could be read, so there may be requests waiting."
        onRetry={() => void requests.refetch()}
      />
    </div>
  ) : rows.length === 0 ? (
    <div className={CARD}>
      <EmptyState
        compact
        icon={status === 'pending' ? CheckCircle2 : Clock3}
        title={status === 'pending' ? 'Nobody is waiting' : `No ${label.toLowerCase()} leave`}
        description={status === 'pending' ? 'New requests appear here as the team books time off.' : undefined}
        kind={status === 'pending' ? 'done' : 'search'}
      />
    </div>
  ) : (
    <ListRowGroup>
      {rows.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          now={now}
          context={
            request.status === 'pending'
              ? leaveContext(request, {
                  approved: approved.data ?? [],
                  shifts: shifts.data ?? [],
                  entitlements: entitlements.data ?? null,
                })
              : null
          }
          canSeeBalances={canSeeBalances}
          canSeeRota={canSeeRota}
          checking={checking}
          open={expanded === request.id}
          onToggle={() => setExpanded((current) => (current === request.id ? null : request.id))}
          deciding={deciding === request.id}
          locked={!!deciding}
          onDecide={(next, note) => review.mutate({ id: request.id, next, note })}
        />
      ))}
    </ListRowGroup>
  );

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      aria-label="Leave requests"
    >
      {/* Skeletons while loading: a "0 waiting" before the data arrives would read as a clear queue. */}
      {pending.isPending ? (
        <FactsSkeleton count={4} surface="card" label="Loading leave counts" className="gap-2 sm:grid-cols-2 xl:grid-cols-4" />
      ) : (
        <motion.dl variants={SECTION_RISE} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Fact surface="card" icon={Clock3} label="Waiting" value={pending.isError ? '—' : summary.waiting} />
          <Fact
            surface="card"
            icon={Timer}
            label="Longest wait"
            value={
              pending.isError || summary.waiting === 0 ? (
                '—'
              ) : (
                <span className={cn(summary.longestWait >= 5 ? 'text-exception' : summary.longestWait >= 1 && 'text-measured')}>
                  {summary.longestWait === 0 ? 'Today' : plural(summary.longestWait, 'day')}
                </span>
              )
            }
          />
          <Fact
            surface="card"
            icon={CalendarClock}
            label="Starting this week"
            value={pending.isError ? '—' : <span className={cn(summary.startingSoon > 0 && 'text-measured')}>{summary.startingSoon}</span>}
          />
          <Fact surface="card" icon={CalendarRange} label="Days requested" value={pending.isError ? '—' : summary.days} />
        </motion.dl>
      )}

      <RecordGroup
        id="leave-requests"
        title="Leave requests"
        footnote={status === 'pending' && rows.length > 0 ? 'Clashes are checked against approved leave and the rota.' : undefined}
        actions={
          <SegmentedControl
            options={STATUSES.map((value) => ({
              value,
              label: value === 'pending' && summary.waiting > 0 ? `${STATUS_LABEL[value]} · ${summary.waiting}` : STATUS_LABEL[value],
            }))}
            value={status}
            onChange={(value) => {
              setExpanded(null);
              setStatus(value);
            }}
            ariaLabel="Leave status"
          />
        }
      >
        {list}
      </RecordGroup>
    </motion.div>
  );
}

/**
 * One request as a row: who, then when, how long and what kind; on the right
 * the one thing to know before deciding. Opened: their note, the allowance,
 * who else is off, the rota, and the decision.
 */
function RequestRow({
  request,
  now,
  context,
  canSeeBalances,
  canSeeRota,
  checking,
  open,
  onToggle,
  deciding,
  locked,
  onDecide,
}: {
  request: LeaveRequest;
  now: Date;
  context: LeaveContext | null;
  canSeeBalances: boolean;
  canSeeRota: boolean;
  checking: boolean;
  open: boolean;
  onToggle: () => void;
  deciding: boolean;
  locked: boolean;
  onDecide: (next: 'approved' | 'declined', note?: string) => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const name = request.employee?.name ?? request.employee?.email ?? 'Employee';
  const isPending = request.status === 'pending';
  const waited = daysBetween(request.createdAt, now);
  const sameDay = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);
  const dates = sameDay
    ? DAY.format(dayOf(request.startDate))
    : `${DAY.format(dayOf(request.startDate))} – ${DAY.format(dayOf(request.endDate))}`;
  const days = Number(request.totalDays);
  const flag = isPending ? leaveFlag(context, waited, checking) : null;
  const settled = request.status === 'declined' || request.status === 'cancelled';
  const balance = context?.balance;
  const overBy = balance && balance.after < 0 ? -balance.after : 0;

  return (
    <DetailRow
      icon={leaveIcon(request.leaveType.name)}
      iconLabel={request.leaveType.name}
      tone={flag ? URGENCY_TILE[flag.urgency] : request.status === 'approved' ? 'success' : 'muted'}
      title={name}
      meta={`${dates} · ${plural(days, 'day')} · ${request.leaveType.name}`}
      value={flag ? flag.label : STATUS_LABEL[request.status]}
      valueTone={flag?.tone ?? undefined}
      quiet={settled}
      muted={settled}
      open={open}
      onToggle={onToggle}
    >
      {request.notes && (
        <blockquote className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">“{request.notes}”</blockquote>
      )}

      <Facts
        rows={[
          isPending &&
            canSeeBalances && [
              'Allowance',
              !balance ? (
                `None set for ${request.leaveType.name.toLowerCase()}`
              ) : overBy > 0 ? (
                <span key="allowance" className="font-medium text-exception">
                  {plural(overBy, 'day')} over · {balance.remaining} of {balance.total} left now
                </span>
              ) : (
                `${balance.after} of ${balance.total} days left after · ${balance.remaining} now`
              ),
            ],
          isPending && [
            'Also off',
            checking ? (
              'Checking…'
            ) : context && context.alsoOff.length > 0 ? (
              <span key="also-off" className="font-medium text-measured">
                {context.alsoOff.join(', ')}
              </span>
            ) : (
              'Nobody'
            ),
          ],
          isPending &&
            canSeeRota && [
              'Rota',
              checking ? (
                'Checking…'
              ) : context && context.shiftsDuring > 0 ? (
                <Link
                  key="rota"
                  href="/staff/rota"
                  className="font-medium text-measured underline decoration-measured/40 underline-offset-2 hover:decoration-measured"
                >
                  {plural(context.shiftsDuring, 'shift')} on the rota need cover
                </Link>
              ) : (
                'Nothing rostered'
              ),
            ],
          [
            'Requested',
            `${formatDate(request.createdAt)}${isPending ? ` · ${waited >= 1 ? `${plural(waited, 'day')} ago` : 'today'}` : ''}`,
          ],
          !isPending && request.reviewNotes && ['Note', request.reviewNotes],
        ]}
      />

      {isPending && (
        <div className="flex flex-wrap items-center gap-2">
          {declining ? (
            <>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
                maxLength={500}
                placeholder="Reason — optional, they’ll see it"
                aria-label="Reason for declining"
                className="h-9 min-w-56 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
              />
              <Button variant="ghost" onClick={() => setDeclining(false)} disabled={locked}>
                Back
              </Button>
              <Button variant="destructive" disabled={locked} onClick={() => onDecide('declined', reason.trim() || undefined)}>
                {deciding ? <Loader2 className="animate-spin" /> : <X />}
                Decline
              </Button>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" disabled={locked} onClick={() => setDeclining(true)}>
                Decline…
              </Button>
              <Button disabled={locked} onClick={() => onDecide('approved')}>
                {deciding ? <Loader2 className="animate-spin" /> : <Check />}
                Approve
              </Button>
            </div>
          )}
        </div>
      )}
    </DetailRow>
  );
}
