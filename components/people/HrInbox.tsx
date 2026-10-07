'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Loader2,
  Users,
  X,
} from '@/components/icons';
import { Avatar, LeaveTypeIcon } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { MiniBar } from '@/components/shared/MiniBar';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { type LeaveRequest, getEntitlements, getManagedLeaveRequests, reviewLeaveRequest } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { type LeaveContext, leaveContext } from '@/lib/utils/leave-review';
import { daysBetween } from '@/lib/utils/staff-overview';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

const STATUSES = ['pending', 'approved', 'declined', 'cancelled'] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  pending: 'Waiting',
  approved: 'Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayOf = (value: string) => {
  const [year, month, date] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, date);
};

/**
 * Leave requests, worked one at a time with what the decision depends on laid
 * out beside each: the allowance it would leave, who else is off those days,
 * and the rota shifts it would leave uncovered. No optimistic update — an
 * approval spends an entitlement.
 */
export function LeaveInbox({ status, setStatus }: { status: string; setStatus: (value: string) => void }) {
  const qc = useQueryClient();
  const capabilities = useAuthStore((s) => s.capabilities);
  // Balances need the read capability; a reviewer without it still reviews, just without the number.
  const canSeeBalances = hasCapability(capabilities, 'hr.leave:read');
  const canSeeRota = hasCapability(capabilities, 'scheduling:read');

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
    return { from: new Date(`${starts[0]}T00:00:00`).toISOString(), to: new Date(`${ends[ends.length - 1]}T23:59:59`).toISOString() };
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

  const pendingCount = pending.data?.length ?? 0;

  return (
    <div className="space-y-5">
      <SegmentedControl
        options={STATUSES.map((value) => ({
          value,
          label: value === 'pending' && pendingCount > 0 ? `${STATUS_LABEL[value]} · ${pendingCount}` : STATUS_LABEL[value],
        }))}
        value={status}
        onChange={setStatus}
        ariaLabel="Leave status"
      />

      {requests.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading leave requests" className="space-y-2.5">
          {[0, 1, 2].map((index) => (
            <RequestCardSkeleton key={index} />
          ))}
        </div>
      ) : requests.isError ? (
        // Falling through to "clear" would tell a reviewer nobody is waiting when the read failed.
        <ErrorState
          icon={CircleHelp}
          title="Leave requests couldn’t be loaded"
          description="This is not an empty inbox — nothing could be read, so there may be requests waiting."
          onRetry={() => void requests.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={status === 'pending' ? CheckCircle2 : Clock3}
          title={status === 'pending' ? 'Nobody is waiting' : `No ${STATUS_LABEL[status as keyof typeof STATUS_LABEL].toLowerCase()} leave`}
          description={status === 'pending' ? 'New requests appear here as the team books time off.' : 'Nothing to show for this status.'}
          kind={status === 'pending' ? 'done' : 'search'}
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((request, index) => (
            <RequestCard
              key={request.id}
              index={index}
              request={request}
              context={
                request.status === 'pending'
                  ? leaveContext(request, {
                      approved: approved.data ?? [],
                      shifts: shifts.data ?? [],
                      entitlements: entitlements.data ?? null,
                    })
                  : null
              }
              checking={approved.isPending || (canSeeRota && shifts.isPending)}
              deciding={deciding === request.id}
              locked={!!deciding}
              onDecide={(next, note) => review.mutate({ id: request.id, next, note })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A `RequestCard` without its words: who and when, the three checks, the decision bar. */
function RequestCardSkeleton() {
  return (
    <div className="rounded-lg border border-rule/60 bg-field" aria-hidden="true">
      <div className="flex items-start gap-4 px-5 pt-4">
        <Bone className="size-9 shrink-0" />
        <span className="min-w-0 flex-1 space-y-2">
          <Bone className="h-3.5 w-44 max-w-full" />
          <Bone className="h-5 w-56 max-w-full" />
          <Bone className="h-3 w-28" />
        </span>
        <Bone className="h-5 w-24 shrink-0" />
      </div>
      <div className="mx-5 mt-4 grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-2.5 rounded-md border border-rule/50 bg-background/60 px-3 py-2.5">
            <Bone className="size-8 shrink-0" />
            <span className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-3.5 w-28 max-w-full" />
              <Bone className="h-3 w-20 max-w-full" />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-rule/50 px-5 py-3.5">
        <Bone className="h-9 w-24" />
        <Bone className="h-9 w-24" />
      </div>
    </div>
  );
}

function RequestCard({
  request,
  context,
  checking,
  deciding,
  locked,
  onDecide,
  index,
}: {
  request: LeaveRequest;
  context: LeaveContext | null;
  checking: boolean;
  deciding: boolean;
  locked: boolean;
  onDecide: (next: 'approved' | 'declined', note?: string) => void;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const name = request.employee?.name ?? request.employee?.email ?? 'Employee';
  const waited = daysBetween(request.createdAt, new Date());
  const start = dayOf(request.startDate);
  const end = dayOf(request.endDate);
  const sameDay = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);
  const days = Number(request.totalDays);
  const overAllowance = !!context?.balance && context.balance.after < 0;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 8) * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('rounded-lg border bg-field', overAllowance ? 'border-exception/35' : 'border-rule/60')}
    >
      <div className="flex flex-wrap items-start gap-4 px-5 pt-4">
        <Avatar name={name} email={request.employee?.email} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-band px-2 py-0.5 text-xs font-medium text-foreground">
              <LeaveTypeIcon name={request.leaveType.name} size={12} className="text-muted-foreground" />
              {request.leaveType.name}
            </span>
          </p>
          <p className="mt-1 text-lg font-semibold tracking-title text-foreground">
            {sameDay ? DAY.format(start) : `${DAY.format(start)} – ${DAY.format(end)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {days} working {days === 1 ? 'day' : 'days'} off
          </p>
        </div>
        {request.status === 'pending' ? (
          waited >= 5 ? (
            <Badge variant="destructive">Waiting {waited} days</Badge>
          ) : waited >= 1 ? (
            <Badge variant="warning">Waiting {waited} days</Badge>
          ) : (
            <Badge variant="muted">New today</Badge>
          )
        ) : (
          <IconTag
            icon={request.status === 'approved' ? Check : Ban}
            label={STATUS_LABEL[request.status]}
            tone={request.status === 'approved' ? 'success' : 'muted'}
            tile
          />
        )}
      </div>

      {request.notes && (
        <blockquote className="mx-5 mt-3 border-l-2 border-rule pl-3 text-sm leading-relaxed text-muted-foreground">
          “{request.notes}”
        </blockquote>
      )}

      {/* What the decision depends on. */}
      {request.status === 'pending' && (
        <ul className="mx-5 mt-4 grid gap-2 sm:grid-cols-3">
          <ContextItem
            icon={CalendarRange}
            tone={!context?.balance ? 'muted' : overAllowance ? 'danger' : context.balance.after <= 3 ? 'warning' : 'ok'}
            title={
              !context?.balance
                ? `No allowance for ${request.leaveType.name.toLowerCase()}`
                : overAllowance
                  ? `${-context.balance.after} ${-context.balance.after === 1 ? 'day' : 'days'} over allowance`
                  : `${context.balance.after} of ${context.balance.total} days left after`
            }
            detail={context?.balance ? `${context.balance.remaining} left before this request` : 'Nothing to count it against'}
            meter={
              context?.balance && context.balance.total > 0 ? (
                <MiniBar
                  value={context.balance.total - context.balance.after}
                  max={context.balance.total}
                  tone={overAllowance ? 'exception' : context.balance.after <= 3 ? 'warning' : 'success'}
                  label={`${context.balance.total - context.balance.after} of ${context.balance.total} days used after this request`}
                  className="mt-1.5"
                />
              ) : undefined
            }
          />
          <ContextItem
            icon={Users}
            tone={checking ? 'muted' : context && context.alsoOff.length > 0 ? 'warning' : 'ok'}
            title={
              checking ? 'Checking…' : context && context.alsoOff.length > 0 ? `${context.alsoOff.length} also off` : 'Nobody else off'
            }
            detail={context && context.alsoOff.length > 0 ? context.alsoOff.join(', ') : 'On any of these days'}
          />
          <ContextItem
            icon={CalendarClock}
            tone={checking ? 'muted' : context && context.shiftsDuring > 0 ? 'warning' : 'ok'}
            title={
              checking
                ? 'Checking…'
                : context && context.shiftsDuring > 0
                  ? `${context.shiftsDuring} ${context.shiftsDuring === 1 ? 'shift needs' : 'shifts need'} cover`
                  : 'No shifts to cover'
            }
            detail={context && context.shiftsDuring > 0 ? 'Already on the rota for these days' : 'Nothing rostered for them then'}
            href={context && context.shiftsDuring > 0 ? '/staff/rota' : undefined}
          />
        </ul>
      )}

      {request.status !== 'pending' && request.reviewNotes && (
        <p className="mx-5 mt-3 rounded-md bg-band/60 px-3 py-2 text-sm text-foreground">
          <span className="font-semibold">Note:</span> {request.reviewNotes}
        </p>
      )}

      {request.status === 'pending' ? (
        <div className="mt-4 border-t border-rule/50 px-5 py-3.5">
          <AnimatePresence initial={false} mode="wait">
            {declining ? (
              <motion.div
                key="decline"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-wrap items-center gap-2"
              >
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
              </motion.div>
            ) : (
              <motion.div
                key="choose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-end gap-2"
              >
                <Button variant="outline" disabled={locked} onClick={() => setDeclining(true)}>
                  <X /> Decline…
                </Button>
                <Button disabled={locked} onClick={() => onDecide('approved')}>
                  {deciding ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="pb-4" />
      )}
    </motion.li>
  );
}

function ContextItem({
  icon: Icon,
  tone,
  title,
  detail,
  meter,
  href,
}: {
  icon: typeof Users;
  tone: 'ok' | 'warning' | 'danger' | 'muted';
  title: string;
  detail: string;
  /** A thin bar under the detail, for a reading with a whole (days of an allowance). */
  meter?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          tone === 'danger'
            ? 'bg-exception/8 text-exception'
            : tone === 'warning'
              ? 'bg-measured/10 text-measured'
              : tone === 'ok'
                ? 'bg-momentum/10 text-momentum'
                : 'bg-band text-muted-foreground',
        )}
      >
        {tone === 'danger' ? <AlertTriangle size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-semibold', tone === 'danger' ? 'text-exception' : 'text-foreground')}>
          {title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        {meter}
      </span>
    </>
  );
  const className = 'flex items-center gap-2.5 rounded-md border border-rule/50 bg-background/60 px-3 py-2.5';
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(className, 'transition-colors hover:bg-band/50')}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}
