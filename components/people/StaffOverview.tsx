'use client';

import { useQueries } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Info } from '@/components/icons';
import { usePayrollSettings } from '@/components/payroll/usePayroll';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Avatar } from '@/components/shared/Avatar';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { getStaff } from '@/lib/modules/identity/client';
import { getPayrollRuns } from '@/lib/modules/payroll/client';
import { getEmployees } from '@/lib/modules/people/client';
import { type PeopleSummary, getManagedLeaveRequests, getManagedTickets, getPeopleSummary } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts, getVariance } from '@/lib/modules/workforce/client';
import { getActiveShifts } from '@/lib/modules/workforce/client';
import { findCoverGaps } from '@/lib/utils/attendance';
import { cn } from '@/lib/utils/cn';
import { type StaffAttentionSeverity, buildStaffAttention, noShows, teamRecordState, unpublishedShifts } from '@/lib/utils/staff-overview';
import { type RosterRow, type RosterStatus, buildRoster } from '@/lib/utils/today-roster';
import { workspaceDateKey, workspaceFormatter } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Consequence as colour: blocking is red, attention amber, information the calm green. */
const SEVERITY_TILE: Record<StaffAttentionSeverity, string> = {
  blocking: 'bg-exception/8 text-exception',
  attention: 'bg-measured/10 text-measured',
  info: 'bg-primary/8 text-primary',
};
const SEVERITY_ICON: Record<StaffAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: Info,
};

/** The day an instant falls on at the business — not in UTC, not on this device. */
const isoDate = (date: Date) => workspaceDateKey(date);

export interface StaffOverviewAccess {
  team: boolean;
  rota: boolean;
  leave: boolean;
  helpdesk: boolean;
  payroll: boolean;
}

/**
 * The staff workspace's front page, top to bottom: what needs a manager, who
 * is working right now, where the team stands, and how it splits by department.
 * The queue counts that used to have their own cards (leave, helpdesk,
 * payslips) already surface as "Needs you" items, so they aren't repeated.
 *
 * Every query is gated on the capability that also gates its tab, so the panel
 * a store manager sees is assembled from what they can actually reach. A
 * section they cannot hold is absent, never empty — an empty "0 awaiting a
 * decision" would read as good news about a queue they cannot see.
 */
export function StaffOverview({ access }: { access: StaffOverviewAccess }) {
  const { tenantId } = useWorkspaceStore();
  const reduceMotion = useReducedMotion();
  const [needsOpen, setNeedsOpen] = useState(false);

  // Cover gaps compare the rota against the clock, so the clock must not run
  // during SSR or the first client render — the same guard the dashboard uses.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = mounted ? isoDate(now) : undefined;
  const weekAgo = mounted ? isoDate(new Date(now.getTime() - 7 * 86_400_000)) : undefined;

  const results = useQueries({
    queries: [
      {
        queryKey: moduleQueryKeys.identity.key('staff', tenantId),
        queryFn: () => getStaff(tenantId ?? undefined),
        enabled: access.team && !!tenantId,
      },
      { queryKey: moduleQueryKeys.people.key('hr-employees', tenantId), queryFn: getEmployees, enabled: access.team && !!tenantId },
      {
        queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', 'overview', today),
        queryFn: () => getScheduledShifts({ from: today, to: today }),
        enabled: access.rota && !!today,
      },
      { queryKey: moduleQueryKeys.workforce.key('shifts-active'), queryFn: getActiveShifts, enabled: access.rota, refetchInterval: 60_000 },
      {
        queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', 'overview-drafts'),
        queryFn: () => getScheduledShifts({ status: 'draft' }),
        enabled: access.rota,
      },
      {
        queryKey: moduleQueryKeys.workforce.key('variance', 'overview', weekAgo, today),
        queryFn: () => getVariance({ from: weekAgo, to: today }),
        enabled: access.rota && !!today,
      },
      {
        queryKey: moduleQueryKeys.people.key('leave-managed', 'pending'),
        queryFn: () => getManagedLeaveRequests('pending'),
        enabled: access.leave,
      },
      {
        queryKey: moduleQueryKeys.support.key('helpdesk-managed', 'open', '', ''),
        queryFn: () => getManagedTickets({ status: 'open' }),
        enabled: access.helpdesk,
      },
      { queryKey: moduleQueryKeys.payroll.key('payroll-runs'), queryFn: getPayrollRuns, enabled: access.payroll },
      {
        queryKey: moduleQueryKeys.people.key('analytics-summary', tenantId),
        queryFn: () => getPeopleSummary(tenantId ?? undefined),
        enabled: access.team && !!tenantId,
      },
    ],
  });

  const [staffQ, employeesQ, rotaQ, activeQ, draftsQ, varianceQ, leaveQ, ticketsQ, payrollQ, summaryQ] = results;
  const asked = results.filter((result) => result.fetchStatus !== 'idle' || result.isFetched);
  const loading = !mounted || asked.some((result) => result.isPending);
  // One dead endpoint must not read as "nothing needs you". A query that
  // *defaults to []* is exactly how a broken feature hides, so the panel says
  // it could not check rather than saying everything is fine.
  const error = asked.some((result) => result.isError);
  const retry = () => void Promise.all(results.map((result) => result.refetch()));

  // Decides whether the UK minimum-wage rule applies. Not part of `results`: a
  // failure here only means the check falls back to the pre-country default.
  const payrollCountry = usePayrollSettings(access.payroll).data?.payrollCountry ?? null;
  const records = useMemo(
    () =>
      access.team && staffQ.data && employeesQ.data && mounted
        ? teamRecordState(staffQ.data, employeesQ.data, now, payrollCountry)
        : undefined,
    [access.team, staffQ.data, employeesQ.data, mounted, now, payrollCountry],
  );

  const coverGaps = useMemo(() => {
    if (!access.rota || !rotaQ.data || !activeQ.data || !mounted) return undefined;
    return findCoverGaps({ rota: rotaQ.data, activeShifts: activeQ.data, now }).length;
  }, [access.rota, rotaQ.data, activeQ.data, mounted, now]);

  const items = useMemo(
    () =>
      mounted
        ? buildStaffAttention({
            now,
            records,
            coverGapCount: coverGaps,
            unpublishedCount: draftsQ.data ? unpublishedShifts(draftsQ.data).length : undefined,
            noShowCount: varianceQ.data ? noShows(varianceQ.data).length : undefined,
            leave: leaveQ.data,
            tickets: ticketsQ.data,
            payrollRuns: payrollQ.data,
          })
        : [],
    [mounted, now, records, coverGaps, draftsQ.data, varianceQ.data, leaveQ.data, ticketsQ.data, payrollQ.data],
  );

  const worst: StaffAttentionSeverity = items.some((item) => item.severity === 'blocking')
    ? 'blocking'
    : items.some((item) => item.severity === 'attention')
      ? 'attention'
      : 'info';

  const roster = useMemo(() => {
    if (!access.rota || !rotaQ.data || !activeQ.data || !mounted) return undefined;
    return buildRoster({
      now,
      shifts: rotaQ.data.map((shift) => ({
        id: shift.id,
        userId: shift.userId,
        name: shift.staff?.user?.name || 'Open shift',
        role: shift.role,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      })),
      clockedIn: activeQ.data.map((shift) => ({
        id: shift.id,
        userId: shift.userId,
        name: shift.staff?.name || shift.staff?.user?.name || 'Team member',
        clockedIn: shift.clockedIn,
      })),
    });
  }, [access.rota, rotaQ.data, activeQ.data, mounted, now]);

  const activeTeam = summaryQ.data?.activeHeadcount ?? staffQ.data?.filter((member) => member.isActive).length ?? 0;
  const summary = summaryQ.data;
  const documents = summary ? summary.expiredDocuments + summary.documentsExpiringIn60Days + summary.documentsWithoutFiles : null;
  const departments = [...(summary?.departments ?? [])].sort((a, b) => b.headcount - a.headcount);

  return (
    <motion.div className="space-y-7" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      <motion.section variants={SECTION_RISE} aria-label="Needs you">
        {loading ? (
          // The folded "needs you" card is one line until opened, so is its placeholder.
          <TilesSkeleton count={1} label="Checking the team" tileClassName="border-rule/60 bg-field px-4 py-3.5" />
        ) : error ? (
          <ErrorState
            title="The team checks couldn’t run"
            description="Some of this page’s data didn’t load, so nothing here is a complete picture."
            onRetry={retry}
          />
        ) : items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-momentum/10 text-momentum">
              <CheckCircle2 size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Nothing needs you</span>
              <span className="block text-xs text-muted-foreground">
                The rota is published, the queues are clear and every record is complete.
              </span>
            </span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
            {/* Folded by default: one line that says how much and what, opened on demand. */}
            <button
              type="button"
              aria-expanded={needsOpen}
              onClick={() => setNeedsOpen((open) => !open)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE[worst])}>
                <AlertTriangle size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {items.length} {items.length === 1 ? 'thing needs' : 'things need'} you
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{items.map((item) => item.title).join(' · ')}</span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">{needsOpen ? 'Hide' : 'Show'}</span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={cn('shrink-0 text-muted-foreground transition-transform duration-200', needsOpen && 'rotate-180')}
              />
            </button>
            <AnimatePresence initial={false}>
              {needsOpen && (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden border-t border-rule/50"
                >
                  <div className="p-2">
                    <ul className="space-y-2">
                      {items.map((item) => {
                        const Icon = SEVERITY_ICON[item.severity];
                        return (
                          <li key={item.id}>
                            <Link
                              href={item.href}
                              className={cn(
                                'group flex items-center gap-3 rounded-lg border bg-background/60 px-3.5 py-3 transition-colors hover:bg-band/40',
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                item.severity === 'blocking' ? 'border-exception/35' : 'border-rule/60',
                              )}
                            >
                              <span
                                className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE[item.severity])}
                              >
                                <Icon size={18} aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                              </span>
                              <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-foreground sm:flex">
                                {item.actionLabel}
                                <ChevronRight
                                  size={14}
                                  className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                                  aria-hidden="true"
                                />
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {access.rota && (
        <motion.section variants={SECTION_RISE} aria-labelledby="staff-today">
          <SectionHeading id="staff-today" action={{ label: 'Open rota', href: '/staff/rota' }}>
            Today
          </SectionHeading>
          {rotaQ.isPending || activeQ.isPending || !roster ? (
            <RosterSkeleton />
          ) : rotaQ.isError || activeQ.isError ? (
            <ErrorState title="Today’s rota couldn’t be loaded" onRetry={() => void Promise.all([rotaQ.refetch(), activeQ.refetch()])} />
          ) : (
            <TodayRoster roster={roster} now={now} />
          )}
        </motion.section>
      )}

      {access.team && (
        <motion.section variants={SECTION_RISE} aria-labelledby="staff-team">
          <SectionHeading id="staff-team" action={{ label: 'Open team', href: '/staff/team' }}>
            Team
          </SectionHeading>
          {summaryQ.isError ? (
            <ErrorState title="Team figures couldn’t be loaded" onRetry={() => void summaryQ.refetch()} />
          ) : summaryQ.isPending || staffQ.isPending ? (
            <TeamCardSkeleton />
          ) : (
            <TeamCard
              members={(staffQ.data ?? []).filter((member) => member.isActive)}
              headcount={activeTeam}
              summary={summary}
              records={records}
              documents={documents}
              departments={departments}
            />
          )}
        </motion.section>
      )}
    </motion.div>
  );
}

const DAY = () => workspaceFormatter({ weekday: 'long', day: 'numeric', month: 'long' });

/** `TodayRoster` without its words: the day and legend, then a row per person with their bar. */
function RosterSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading today’s rota"
      className="overflow-hidden rounded-lg border border-rule/60 bg-field"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule/50 px-5 py-3.5" aria-hidden="true">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-3 w-48" />
      </div>
      <ul className="space-y-1 px-5 pt-3 pb-4" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <li
            key={index}
            className="grid grid-cols-[11rem_minmax(0,1fr)_8.5rem] items-center gap-4 py-1.5 max-md:grid-cols-[8rem_minmax(0,1fr)]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Bone className="size-8 shrink-0" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <Bone className="h-3.5 w-20 max-w-full" />
                <Bone className="h-3 w-24 max-w-full" />
              </span>
            </span>
            <Bone className="h-7 w-full" />
            <Bone className="ml-auto h-3 w-16 max-md:hidden" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `TeamCard` without its words: the faces and headcount, the department bar, the record checks. */
function TeamCardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading the team" className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-5" aria-hidden="true">
        <span className="flex -space-x-2">
          {[0, 1, 2, 3].map((index) => (
            <Bone key={index} className="size-10 border-2 border-field" />
          ))}
        </span>
        <span className="min-w-0 flex-1 space-y-2">
          <Bone className="h-6 w-28" />
          <Bone className="h-3.5 w-56 max-w-full" />
        </span>
      </div>
      <div className="border-t border-rule/50 px-5 py-4" aria-hidden="true">
        <Bone className="h-2.5 w-full rounded-full" />
        <Bone className="mt-2.5 h-3 w-64 max-w-full" />
      </div>
      <div className="border-t border-rule/50" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3 border-b border-rule/45 px-5 py-3 last:border-b-0">
            <Bone className="size-8 shrink-0" />
            <Bone className={index % 2 ? 'h-3.5 w-48' : 'h-3.5 w-36'} />
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<RosterStatus, { bar: string; dot: string; text: string; legend: string }> = {
  on: { bar: 'bg-primary', dot: 'bg-primary', text: 'text-primary', legend: 'On shift' },
  unplanned: { bar: 'bg-measured', dot: 'bg-measured', text: 'text-measured', legend: 'Not on the rota' },
  late: { bar: 'border border-dashed border-exception bg-exception/10', dot: 'bg-exception', text: 'text-exception', legend: 'Late' },
  later: { bar: 'border border-primary/35 bg-primary/12', dot: 'bg-primary/40', text: 'text-muted-foreground', legend: 'Later' },
  done: { bar: 'bg-muted-foreground/25', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', legend: 'Finished' },
};
const LEGEND_ORDER: RosterStatus[] = ['on', 'late', 'later', 'done', 'unplanned'];

/**
 * Today's rota as a timeline: a bar per shift across the day, a line at "now",
 * and each row saying where its person is up to — so "who's in, who's late,
 * who's next" is one glance instead of a number and a list.
 */
function TodayRoster({ roster, now }: { roster: ReturnType<typeof buildRoster>; now: Date }) {
  const reduceMotion = useReducedMotion();
  const { rows, window, counts } = roster;
  const span = window.endHour - window.startHour;

  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule/50 px-5 py-3.5">
        <p className="text-sm font-semibold text-foreground">{DAY().format(now)}</p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND_ORDER.filter((status) => counts[status] > 0).map((status) => (
            <li key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2 rounded-full', STATUS_STYLE[status].dot)} aria-hidden="true" />
              <span className="font-semibold text-foreground">{counts[status]}</span> {STATUS_STYLE[status].legend.toLowerCase()}
            </li>
          ))}
        </ul>
      </header>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">Nobody is on today’s rota</p>
          <p className="mt-1 text-xs text-muted-foreground">Plan shifts on the rota and they’ll appear here as the day runs.</p>
        </div>
      ) : (
        <div className="px-5 pt-3 pb-4">
          {/* Axis: the person column and status column are fixed, the track takes the rest. */}
          <div className="grid grid-cols-[11rem_minmax(0,1fr)_8.5rem] items-end gap-4 pb-1.5 max-md:grid-cols-[8rem_minmax(0,1fr)]">
            <span />
            <div className="relative h-4">
              {window.ticks
                .filter((hour) => window.now === null || Math.abs(((hour - window.startHour) / span) * 100 - window.now) > 5)
                .map((hour) => (
                  <span
                    key={hour}
                    className="absolute -translate-x-1/2 font-sans text-xs text-muted-foreground"
                    style={{ left: `${((hour - window.startHour) / span) * 100}%` }}
                  >
                    {String(hour % 24).padStart(2, '0')}:00
                  </span>
                ))}
              {window.now !== null && (
                <span
                  className="absolute -translate-x-1/2 rounded-sm bg-exception px-1.5 font-sans text-xs font-semibold text-white"
                  style={{ left: `${window.now}%` }}
                >
                  Now
                </span>
              )}
            </div>
            <span className="max-md:hidden" />
          </div>

          <ul className="space-y-1">
            {rows.map((row, index) => (
              <RosterLine
                key={row.key}
                row={row}
                nowAt={window.now}
                ticks={window.ticks}
                start={window.startHour}
                span={span}
                index={index}
                reduceMotion={!!reduceMotion}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RosterLine({
  row,
  nowAt,
  ticks,
  start,
  span,
  index,
  reduceMotion,
}: {
  row: RosterRow;
  nowAt: number | null;
  ticks: number[];
  start: number;
  span: number;
  index: number;
  reduceMotion: boolean;
}) {
  const style = STATUS_STYLE[row.status];
  return (
    <li className="grid grid-cols-[11rem_minmax(0,1fr)_8.5rem] items-center gap-4 rounded-md py-1.5 max-md:grid-cols-[8rem_minmax(0,1fr)]">
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={row.name} size="sm" className={cn(row.status === 'done' && 'opacity-50 grayscale')} />
        <span className="min-w-0">
          <span className={cn('block truncate text-sm font-medium', row.status === 'done' ? 'text-muted-foreground' : 'text-foreground')}>
            {row.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{row.role ? `${row.role} · ${row.span}` : row.span}</span>
        </span>
      </span>
      <span className="relative h-7 rounded-md bg-band/50">
        {ticks.map((hour) => (
          <span
            key={hour}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-rule/50"
            style={{ left: `${((hour - start) / span) * 100}%` }}
          />
        ))}
        <motion.span
          aria-hidden="true"
          className={cn('absolute inset-y-1 origin-left rounded-sm', style.bar)}
          style={{ left: `${row.left}%`, width: `${row.width}%` }}
          initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.05 + index * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
        {nowAt !== null && (
          <span aria-hidden="true" className="absolute -inset-y-1 w-0.5 rounded-full bg-exception" style={{ left: `${nowAt}%` }} />
        )}
      </span>
      <span className={cn('truncate text-right text-xs font-semibold max-md:col-span-2 max-md:text-left', style.text)}>{row.label}</span>
    </li>
  );
}

const ROLE_NAMES: Record<string, [string, string]> = {
  franchise_owner: ['owner', 'owners'],
  store_manager: ['store manager', 'store managers'],
  barista: ['barista', 'baristas'],
  hr_manager: ['HR manager', 'HR managers'],
  marketing_manager: ['marketing manager', 'marketing managers'],
  auditor: ['auditor', 'auditors'],
  super_admin: ['platform admin', 'platform admins'],
};

const DEPARTMENT_SHADES = ['bg-primary', 'bg-primary/70', 'bg-primary/45', 'bg-primary/25', 'bg-measured/60', 'bg-reference/50'];

/**
 * The team in one card: who they are (faces and the role mix), how it splits
 * across departments, and whether the records behind them are in order.
 */
function TeamCard({
  members,
  headcount,
  summary,
  records,
  documents,
  departments,
}: {
  members: { userId: string; name?: string | null; email?: string | null; role: string }[];
  headcount: number;
  summary: PeopleSummary | undefined;
  records: ReturnType<typeof teamRecordState> | undefined;
  documents: number | null;
  departments: { department: string; headcount: number }[];
}) {
  const reduceMotion = useReducedMotion();
  const roles = Object.entries(
    members.reduce<Record<string, number>>((tally, member) => ({ ...tally, [member.role]: (tally[member.role] ?? 0) + 1 }), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => {
      const [one, many] = ROLE_NAMES[role] ?? [role.replaceAll('_', ' '), `${role.replaceAll('_', ' ')}s`];
      return `${count} ${count === 1 ? one : many}`;
    });
  const faces = members.slice(0, 7);
  const departmentTotal = departments.reduce((sum, item) => sum + item.headcount, 0) || 1;

  const checks: {
    key: string;
    ok: boolean;
    tone: 'ok' | 'warning' | 'danger' | 'info';
    title: string;
    detail: string;
    href: string;
    action: string;
  }[] = [
    {
      key: 'records',
      ok: !!records && records.averageProgress >= 100,
      tone: records && records.unpayable.length > 0 ? 'danger' : records && records.averageProgress < 100 ? 'warning' : 'ok',
      title: records
        ? records.unpayable.length > 0
          ? `${records.unpayable.length} ${records.unpayable.length === 1 ? 'person' : 'people'} can’t be paid yet`
          : records.averageProgress < 100
            ? `Records ${records.averageProgress}% complete`
            : 'Every record is complete'
        : 'Records',
      detail: records
        ? `Records are ${records.averageProgress}% complete on average — right to work, contract and pay details.`
        : 'Checking…',
      href: '/staff/team',
      action: 'Review',
    },
    {
      key: 'documents',
      ok: documents === 0,
      tone: summary && summary.expiredDocuments > 0 ? 'danger' : documents ? 'warning' : 'ok',
      title: documents ? `${documents} ${documents === 1 ? 'document' : 'documents'} to review` : 'Documents are up to date',
      detail: summary
        ? `${summary.expiredDocuments} expired · ${summary.documentsExpiringIn60Days} expiring in 60 days · ${summary.documentsWithoutFiles} missing a file`
        : '',
      href: '/staff/team',
      action: 'Review',
    },
    {
      key: 'absence',
      ok: true,
      tone: 'info',
      title: summary
        ? `${summary.absenceDaysLast30Days} ${summary.absenceDaysLast30Days === 1 ? 'day' : 'days'} of absence in 30 days`
        : 'Absence',
      detail: summary ? `${summary.contractedWeeklyHours} hours contracted a week across the team` : '',
      href: '/staff/requests',
      action: 'Open',
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 py-5">
        <div className="flex -space-x-2" aria-hidden="true">
          {faces.map((member) => (
            <span key={member.userId} className="rounded-md border-2 border-field" title={member.name ?? member.email ?? undefined}>
              <Avatar name={member.name || member.email} email={member.email} size="md" />
            </span>
          ))}
          {members.length > faces.length && (
            <span className="flex size-10 items-center justify-center rounded-md border-2 border-field bg-band text-xs font-semibold text-muted-foreground">
              +{members.length - faces.length}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold tracking-headline text-foreground">
            {headcount} {headcount === 1 ? 'person' : 'people'}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{roles.join(' · ') || 'No roles yet'}</p>
        </div>
        {summary && (
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md bg-primary/8 px-2 py-1 font-semibold text-primary">+{summary.startersLast30Days} joined</span>
            <span className="rounded-md bg-band px-2 py-1 font-semibold text-muted-foreground">−{summary.leaversLast30Days} left</span>
            <span className="text-muted-foreground">in 30 days</span>
          </div>
        )}
      </div>

      {departments.length > 0 && (
        <div className="border-t border-rule/50 px-5 py-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-band" role="img" aria-label="Team by department">
            {departments.map((item, index) => (
              <motion.span
                key={item.department}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', DEPARTMENT_SHADES[index % DEPARTMENT_SHADES.length])}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${(item.headcount / departmentTotal) * 100}%` }}
                transition={{ duration: 0.6, delay: reduceMotion ? 0 : index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
            {departments.map((item, index) => (
              <li key={item.department} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn('size-2 rounded-full', DEPARTMENT_SHADES[index % DEPARTMENT_SHADES.length])} aria-hidden="true" />
                <span className="font-medium text-foreground">{item.department || 'No department'}</span> {item.headcount}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="border-t border-rule/50">
        {checks.map((check) => (
          <li key={check.key} className="border-b border-rule/45 last:border-b-0">
            <Link
              href={check.href}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-md',
                  check.tone === 'danger'
                    ? 'bg-exception/8 text-exception'
                    : check.tone === 'warning'
                      ? 'bg-measured/10 text-measured'
                      : check.tone === 'info'
                        ? 'bg-band text-muted-foreground'
                        : 'bg-momentum/10 text-momentum',
                )}
              >
                {check.tone === 'ok' ? (
                  <CheckCircle2 size={16} aria-hidden="true" />
                ) : check.tone === 'info' ? (
                  <Clock size={16} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={16} aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{check.title}</span>
                {check.detail && <span className="block truncate text-xs text-muted-foreground">{check.detail}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                {check.action}
                <ChevronRight size={13} aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A section title in the settings style, with an optional count and a way into the full view. */
function SectionHeading({
  id,
  count,
  action,
  children,
}: {
  id: string;
  count?: number;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 id={id} className="text-base font-semibold tracking-title text-foreground">
        {children}
      </h2>
      {count !== undefined && count > 0 && <Badge variant="warning">{count}</Badge>}
      {action && (
        <Link
          href={action.href}
          className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {action.label}
          <ChevronRight size={13} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
