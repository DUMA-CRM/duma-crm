'use client';

import { useQueries } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock,
  FileText,
  Info,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { usePayrollSettings } from '@/components/payroll/usePayroll';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';

import { getStaff } from '@/lib/modules/identity/client';
import { getPayrollRuns } from '@/lib/modules/payroll/client';
import { getEmployees } from '@/lib/modules/people/client';
import { type PeopleSummary, getManagedLeaveRequests, getManagedTickets, getPeopleSummary } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts, getVariance } from '@/lib/modules/workforce/client';
import { getActiveShifts } from '@/lib/modules/workforce/client';
import { findCoverGaps } from '@/lib/utils/attendance';
import { cn } from '@/lib/utils/cn';
import {
  LEAVE_STALE_DAYS,
  type StaffAttentionSeverity,
  TICKET_STALE_DAYS,
  awaitingIssue,
  buildStaffAttention,
  daysBetween,
  linesAwaitingDeductions,
  noShows,
  oldestAgeDays,
  openTickets,
  pendingLeave,
  teamRecordState,
  unpublishedShifts,
} from '@/lib/utils/staff-overview';
import { type RosterRow, type RosterStatus, buildRoster } from '@/lib/utils/today-roster';
import { workspaceDateKey, workspaceFormatter } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Consequence as colour: blocking is red, attention amber, information the calm green. */
const SEVERITY_TONE: Record<StaffAttentionSeverity, NeedsAttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'info',
};
const SEVERITY_ICON: Record<StaffAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: Info,
};

/** The day an instant falls on at the business — not in UTC, not on this device. */
const isoDate = (date: Date) => workspaceDateKey(date);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The surface every list on this page sits on — the same as `ListRowGroup`. */
const CARD = 'overflow-hidden rounded-lg border border-border bg-card shadow-sm';

export interface StaffOverviewAccess {
  team: boolean;
  rota: boolean;
  leave: boolean;
  helpdesk: boolean;
  payroll: boolean;
}

/**
 * The staff workspace's front page, top to bottom: four figures for today
 * (leave to decide, cover, hours to correct, payroll), the list of what needs
 * a manager, who is working right now, then the team and the state of its
 * records side by side.
 *
 * Every query is gated on the capability that also gates its tab, so the panel
 * a store manager sees is assembled from what they can actually reach. A
 * figure or section they cannot hold is absent, never empty — an empty
 * "0 awaiting a decision" would read as good news about a queue they cannot see.
 */
export function StaffOverview({ access }: { access: StaffOverviewAccess }) {
  const { tenantId } = useWorkspaceStore();

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
  const departments = [...(summary?.departments ?? [])].sort((a, b) => b.headcount - a.headcount);

  // ── The four figures ───────────────────────────────────────────────────────
  // Picked in order of what a manager acts on first, from the ones this person
  // can reach; the first four are shown. Each reads its own query, so one dead
  // endpoint dashes one tile rather than the row.
  const figures: Figure[] = [];
  if (access.leave) {
    const waiting = leaveQ.data ? pendingLeave(leaveQ.data) : [];
    const oldest = oldestAgeDays(waiting, now);
    figures.push({
      key: 'leave',
      icon: CalendarDays,
      label: 'Leave to decide',
      value: waiting.length,
      hint: waiting.length ? (oldest > 0 ? `Oldest waited ${plural(oldest, 'day')}` : 'Raised today') : undefined,
      tone: oldest >= LEAVE_STALE_DAYS ? 'danger' : waiting.length ? 'warning' : 'default',
      href: '/staff/requests',
      error: leaveQ.isError,
    });
  }
  if (access.rota) {
    figures.push({
      key: 'cover',
      icon: CalendarClock,
      label: 'Uncovered now',
      value: coverGaps ?? 0,
      tone: coverGaps ? 'danger' : 'default',
      href: '/staff/rota',
      error: rotaQ.isError || activeQ.isError,
    });
    const missed = varianceQ.data ? noShows(varianceQ.data).length : 0;
    figures.push({
      key: 'hours',
      icon: Clock,
      label: 'Hours to correct',
      value: missed,
      hint: 'No-shows in the last 7 days',
      tone: missed ? 'warning' : 'default',
      href: '/staff/rota',
      error: varianceQ.isError,
    });
  }
  if (access.payroll) {
    const runs = payrollQ.data ?? [];
    const unissued = awaitingIssue(runs);
    const lines = unissued.reduce((total, run) => total + run.lines.length, 0);
    const missing = linesAwaitingDeductions(runs);
    const lastIssued = runs
      .map((run) => run.issuedAt)
      .filter((at): at is string => !!at)
      .sort()
      .at(-1);
    figures.push({
      key: 'payroll',
      icon: Banknote,
      label: 'Payslips to issue',
      value: lines,
      hint: missing
        ? `${missing} waiting on tax and NI`
        : lines
          ? 'Ready to issue'
          : lastIssued
            ? `Last issued ${SHORT_DATE().format(new Date(lastIssued))}`
            : undefined,
      tone: missing ? 'danger' : lines ? 'warning' : 'default',
      href: '/staff/payroll',
      error: payrollQ.isError,
    });
  }
  if (access.helpdesk) {
    const open = ticketsQ.data ? openTickets(ticketsQ.data) : [];
    const stale = open.filter((ticket) => daysBetween(ticket.createdAt, now) >= TICKET_STALE_DAYS).length;
    figures.push({
      key: 'helpdesk',
      icon: CircleHelp,
      label: 'Open requests',
      value: open.length,
      hint: stale ? `${stale} open over a week` : undefined,
      tone: stale ? 'warning' : 'default',
      href: '/staff/helpdesk',
      error: ticketsQ.isError,
    });
  }
  if (access.team) {
    figures.push({
      key: 'team',
      icon: UsersRound,
      label: 'Active team',
      value: activeTeam,
      tone: 'default',
      href: '/staff/team',
      error: summaryQ.isError && staffQ.isError,
    });
  }
  const shownFigures = figures.slice(0, 4);

  const teamLoading = !mounted || summaryQ.isPending || staffQ.isPending;
  const teamError = summaryQ.isError || staffQ.isError;
  const recordsLoading = !mounted || summaryQ.isPending || staffQ.isPending || employeesQ.isPending;
  const recordsError = summaryQ.isError || staffQ.isError || employeesQ.isError;

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial="hidden"
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
    >
      {shownFigures.length > 0 &&
        // While loading, the tiles are skeletons: a "0 uncovered" before the
        // data arrives would be a claim, not a wait.
        (loading ? (
          <FactsSkeleton
            count={shownFigures.length}
            surface="card"
            label="Loading today’s figures"
            className={cn('grid-cols-1 gap-2', FIGURE_GRID[shownFigures.length])}
          />
        ) : (
          <motion.dl variants={SECTION_RISE} className={cn('grid gap-2', FIGURE_GRID[shownFigures.length])}>
            {shownFigures.map((figure) => (
              <Fact
                key={figure.key}
                surface="card"
                icon={figure.icon}
                label={figure.label}
                value={figure.error ? '—' : figure.value}
                hint={figure.error ? 'Couldn’t be loaded' : figure.hint}
                tone={figure.error ? 'default' : figure.tone}
                href={figure.href}
              />
            ))}
          </motion.dl>
        ))}

      <RecordGroup id="staff-needs" title="Needs you">
        {loading ? (
          <ListSkeleton rows={3} label="Checking the team" />
        ) : error ? (
          <div className={CARD}>
            <ErrorState
              title="The team checks couldn’t run"
              description="Some of this page’s data didn’t load, so nothing here is a complete picture."
              onRetry={retry}
            />
          </div>
        ) : items.length === 0 ? (
          <div className={CARD}>
            <EmptyState
              compact
              kind="done"
              icon={CheckCircle2}
              title="Nothing needs you"
              description="Leave to decide, uncovered shifts, payroll and records to finish appear here."
            />
          </div>
        ) : (
          <NeedsAttention
            label="Needs you"
            items={items.map((item) => ({
              key: item.id,
              tone: SEVERITY_TONE[item.severity],
              icon: SEVERITY_ICON[item.severity],
              title: item.title,
              detail: item.detail,
              fix: { label: item.actionLabel, href: item.href },
            }))}
          />
        )}
      </RecordGroup>

      {access.rota && (
        <RecordGroup id="staff-today" title="Today" actions={<OpenLink href="/staff/rota">Open rota</OpenLink>}>
          {!mounted || rotaQ.isPending || activeQ.isPending ? (
            <RosterSkeleton />
          ) : rotaQ.isError || activeQ.isError ? (
            <div className={CARD}>
              <ErrorState title="Today’s rota couldn’t be loaded" onRetry={() => void Promise.all([rotaQ.refetch(), activeQ.refetch()])} />
            </div>
          ) : roster ? (
            <TodayRoster roster={roster} />
          ) : (
            <RosterSkeleton />
          )}
        </RecordGroup>
      )}

      {access.team && (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            {teamLoading ? (
              <TeamSkeleton />
            ) : teamError ? (
              <SettingsSection title="Team">
                <ErrorState
                  title="Team figures couldn’t be loaded"
                  onRetry={() => void Promise.all([summaryQ.refetch(), staffQ.refetch()])}
                />
              </SettingsSection>
            ) : (
              <TeamSection
                members={(staffQ.data ?? []).filter((member) => member.isActive)}
                headcount={activeTeam}
                summary={summary}
                departments={departments}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <RecordGroup id="staff-records" title="Records">
              {recordsLoading ? (
                <ListSkeleton rows={2} trailing={false} label="Checking records" />
              ) : recordsError ? (
                <div className={CARD}>
                  <ErrorState
                    title="Records couldn’t be checked"
                    onRetry={() => void Promise.all([summaryQ.refetch(), staffQ.refetch(), employeesQ.refetch()])}
                  />
                </div>
              ) : (
                <RecordChecks records={records} summary={summary} />
              )}
            </RecordGroup>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface Figure {
  key: string;
  icon: IconComponent;
  label: string;
  value: number;
  hint?: string;
  tone: 'default' | 'warning' | 'danger';
  href: string;
  error: boolean;
}

/** Static class names per tile count, so a row of three never leaves a hole. */
const FIGURE_GRID: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'sm:grid-cols-2 lg:grid-cols-2',
  3: 'sm:grid-cols-3 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4',
};

const SHORT_DATE = () => workspaceFormatter({ day: 'numeric', month: 'short' });

/** The way into a section's full view, in a `RecordGroup`'s header. */
function OpenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
      <ChevronRight size={13} aria-hidden="true" />
    </Link>
  );
}

// ── Today ────────────────────────────────────────────────────────────────────

/** `TodayRoster` without its words: the legend, then a row per person with their bar. */
function RosterSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading today’s rota" className={CARD}>
      <div className="flex items-center gap-3 px-5 pt-4" aria-hidden="true">
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
 * who's next" is one glance instead of a number and a list. The section title
 * already says "Today", so the card opens on the counts, not the date.
 */
function TodayRoster({ roster }: { roster: ReturnType<typeof buildRoster> }) {
  const reduceMotion = useReducedMotion();
  const { rows, window, counts } = roster;
  const span = window.endHour - window.startHour;

  if (rows.length === 0) {
    return (
      <div className={CARD}>
        <EmptyState
          compact
          icon={CalendarDays}
          title="Nobody is on today’s rota"
          description="Shifts planned for today appear here as the day runs."
        />
      </div>
    );
  }

  return (
    <div className={CARD}>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-4">
        {LEGEND_ORDER.filter((status) => counts[status] > 0).map((status) => (
          <li key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-2 rounded-full', STATUS_STYLE[status].dot)} aria-hidden="true" />
            <span className="font-semibold text-foreground">{counts[status]}</span> {STATUS_STYLE[status].legend.toLowerCase()}
          </li>
        ))}
      </ul>

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
                className="absolute -translate-x-1/2 rounded-sm bg-exception px-1.5 font-sans text-xs font-semibold text-on-fill"
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

// ── Team ─────────────────────────────────────────────────────────────────────

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

/** `TeamSection` without its words: faces and headcount over four fact tiles. */
function TeamSkeleton() {
  return (
    <SettingsSection title="Team">
      <div role="status" aria-busy="true" aria-label="Loading the team" className="space-y-4">
        <div className="flex items-center gap-4" aria-hidden="true">
          <span className="flex -space-x-2">
            {[0, 1, 2, 3].map((index) => (
              <Bone key={index} className="size-10 border-2 border-card" />
            ))}
          </span>
          <span className="min-w-0 flex-1 space-y-2">
            <Bone className="h-7 w-32" />
            <Bone className="h-3.5 w-56 max-w-full" />
          </span>
        </div>
        <FactsSkeleton count={4} surface="panel" className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2" />
      </div>
    </SettingsSection>
  );
}

/**
 * The team at a glance, in the identity-block shape: faces, the headcount and
 * the role mix, four fact tiles for the last 30 days, then the split by
 * department.
 */
function TeamSection({
  members,
  headcount,
  summary,
  departments,
}: {
  members: { userId: string; name?: string | null; email?: string | null; role: string }[];
  headcount: number;
  summary: PeopleSummary | undefined;
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
  const faces = members.slice(0, 6);
  const departmentTotal = departments.reduce((sum, item) => sum + item.headcount, 0) || 1;

  return (
    <SettingsSection title="Team" actions={<OpenLink href="/staff/team">Open team</OpenLink>}>
      <div className="space-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {faces.length > 0 && (
            <div className="flex shrink-0 -space-x-2" aria-hidden="true">
              {faces.map((member) => (
                <span key={member.userId} className="rounded-md border-2 border-card" title={member.name ?? member.email ?? undefined}>
                  <Avatar name={member.name || member.email} email={member.email} size="md" />
                </span>
              ))}
              {members.length > faces.length && (
                <span className="flex size-10 items-center justify-center rounded-md border-2 border-card bg-band text-xs font-semibold text-muted-foreground">
                  +{members.length - faces.length}
                </span>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold tracking-headline text-heading">{plural(headcount, 'person', 'people')}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{roles.join(' · ') || 'No roles yet'}</p>
          </div>
        </div>

        {summary && (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact icon={UserPlus} label="Joined in 30 days" value={summary.startersLast30Days} />
            <Fact icon={UserMinus} label="Left in 30 days" value={summary.leaversLast30Days} />
            <Fact icon={CalendarDays} label="Absence in 30 days" value={plural(summary.absenceDaysLast30Days, 'day')} />
            <Fact icon={Clock} label="Contracted hours" value={`${summary.contractedWeeklyHours}h a week`} />
          </dl>
        )}

        {departments.length > 0 && (
          <div>
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
      </div>
    </SettingsSection>
  );
}

/**
 * Whether the records behind the team are in order — shown when they are, too,
 * which "Needs you" (problems only) doesn't. Documents are only here.
 */
function RecordChecks({
  records,
  summary,
}: {
  records: ReturnType<typeof teamRecordState> | undefined;
  summary: PeopleSummary | undefined;
}) {
  const unpayable = records?.unpayable.length ?? 0;
  const progress = records?.averageProgress ?? 100;
  const documents = summary ? summary.expiredDocuments + summary.documentsExpiringIn60Days + summary.documentsWithoutFiles : 0;

  return (
    <ListRowGroup>
      <ListRow
        href="/staff/team"
        icon={unpayable ? AlertTriangle : progress < 100 ? ShieldCheck : CheckCircle2}
        tone={unpayable ? 'exception' : progress < 100 ? 'warning' : 'success'}
        title={
          unpayable
            ? `${plural(unpayable, 'person', 'people')} can’t be paid yet`
            : progress < 100
              ? `Records ${progress}% complete`
              : 'Every record is complete'
        }
        meta={unpayable ? `Records ${progress}% complete on average` : undefined}
      />
      <ListRow
        href="/staff/team"
        icon={documents ? FileText : CheckCircle2}
        tone={summary && summary.expiredDocuments > 0 ? 'exception' : documents ? 'warning' : 'success'}
        title={documents ? `${plural(documents, 'document')} to review` : 'Documents are up to date'}
        meta={
          summary && documents
            ? `${summary.expiredDocuments} expired · ${summary.documentsExpiringIn60Days} expiring in 60 days · ${summary.documentsWithoutFiles} missing a file`
            : undefined
        }
      />
    </ListRowGroup>
  );
}
