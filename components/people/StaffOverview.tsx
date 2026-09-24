'use client';

import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { AlertTriangle, Banknote, CalendarRange, CircleHelp, Clock, Info, ShieldCheck, UsersRound } from '@/components/icons';
import { AttentionList, type AttentionTone } from '@/components/shared/AttentionList';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';

import { getStaff } from '@/lib/modules/identity/client';
import { getEmployees } from '@/lib/modules/people/client';
import { getPayrollRuns } from '@/lib/modules/people/client';
import { getManagedLeaveRequests, getManagedTickets } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts, getVariance } from '@/lib/modules/workforce/client';
import { getActiveShifts } from '@/lib/modules/workforce/client';
import { findCoverGaps } from '@/lib/utils/attendance';
import {
  type StaffAttentionSeverity,
  buildStaffAttention,
  linesAwaitingDeductions,
  noShows,
  openTickets,
  pendingLeave,
  teamRecordState,
  unpublishedShifts,
} from '@/lib/utils/staff-overview';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Consequence maps onto the shared panel's tones exactly as it does on My HR. */
const SEVERITY_TONE: Record<StaffAttentionSeverity, AttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'reference',
};
const SEVERITY_ICON: Record<StaffAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: Info,
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export interface StaffOverviewAccess {
  team: boolean;
  rota: boolean;
  leave: boolean;
  helpdesk: boolean;
  payroll: boolean;
}

/**
 * The staff workspace's front page: what is wrong, then where the team stands.
 *
 * Every query is gated on the capability that also gates its tab, so the panel
 * a store manager sees is assembled from what they can actually reach. A
 * section they cannot hold is absent, never empty — an empty "0 awaiting a
 * decision" would read as good news about a queue they cannot see.
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
      { queryKey: moduleQueryKeys.people.key('payroll-runs'), queryFn: getPayrollRuns, enabled: access.payroll },
    ],
  });

  const [staffQ, employeesQ, rotaQ, activeQ, draftsQ, varianceQ, leaveQ, ticketsQ, payrollQ] = results;
  const asked = results.filter((result) => result.fetchStatus !== 'idle' || result.isFetched);
  const loading = !mounted || asked.some((result) => result.isPending);
  // One dead endpoint must not read as "nothing needs you". A query that
  // *defaults to []* is exactly how a broken feature hides, so the panel says
  // it could not check rather than saying everything is fine.
  const error = asked.some((result) => result.isError);
  const retry = () => void Promise.all(results.map((result) => result.refetch()));

  const records = useMemo(
    () => (access.team && staffQ.data && employeesQ.data && mounted ? teamRecordState(staffQ.data, employeesQ.data, now) : undefined),
    [access.team, staffQ.data, employeesQ.data, mounted, now],
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

  const activeTeam = staffQ.data?.filter((member) => member.isActive).length ?? 0;
  const rosteredToday = rotaQ.data?.length ?? 0;
  const clockedIn = activeQ.data?.length ?? 0;
  const waiting = leaveQ.data ? pendingLeave(leaveQ.data).length : 0;
  const pendingDeductions = payrollQ.data ? linesAwaitingDeductions(payrollQ.data) : 0;
  const open = ticketsQ.data ? openTickets(ticketsQ.data).length : 0;

  return (
    <div className="space-y-4">
      <AttentionList
        items={items.map((item) => ({
          key: item.id,
          tone: SEVERITY_TONE[item.severity],
          icon: SEVERITY_ICON[item.severity],
          label: item.title,
          detail: item.detail,
          actionLabel: item.actionLabel,
          href: item.href,
        }))}
        loading={loading}
        error={error}
        onRetry={retry}
        clearTitle="Nothing needs you"
        clearDescription="The rota is published, the queues are clear and every record is complete."
        errorTitle="The team checks could not be run"
        errorDescription="Some of this page's data did not load, so nothing here is a complete picture."
      />

      <StatCardGrid columns={4}>
        {access.team && (
          <StatCard
            label="Active team"
            icon={UsersRound}
            value={activeTeam}
            caption={staffQ.data ? `${staffQ.data.length} accounts in total` : undefined}
            loading={staffQ.isPending}
            error={staffQ.isError}
            href="/staff/team"
          />
        )}
        {access.rota && (
          <StatCard
            label="On shift now"
            icon={Clock}
            accent="success"
            value={clockedIn}
            caption={`${rosteredToday} rostered today`}
            loading={rotaQ.isPending || activeQ.isPending}
            error={rotaQ.isError || activeQ.isError}
            href="/staff/rota"
          />
        )}
        {access.leave && (
          <StatCard
            label="Awaiting a decision"
            icon={CalendarRange}
            accent={waiting > 0 ? 'warning' : 'neutral'}
            value={waiting}
            caption="Leave requests"
            loading={leaveQ.isPending}
            error={leaveQ.isError}
            href="/staff/requests"
          />
        )}
        {access.helpdesk && (
          <StatCard
            label="Open requests"
            icon={CircleHelp}
            accent={open > 0 ? 'info' : 'neutral'}
            value={open}
            caption="Helpdesk"
            loading={ticketsQ.isPending}
            error={ticketsQ.isError}
            href="/staff/helpdesk"
          />
        )}
        {access.payroll && (
          <StatCard
            label="Payslips to issue"
            icon={Banknote}
            accent={pendingDeductions > 0 ? 'warning' : 'neutral'}
            value={pendingDeductions}
            caption={pendingDeductions > 0 ? 'Awaiting tax and NI figures' : 'Nothing waiting'}
            loading={payrollQ.isPending}
            error={payrollQ.isError}
            href="/staff/payroll"
          />
        )}
        {access.team && (
          <StatCard
            label="Records complete"
            icon={ShieldCheck}
            accent={records && records.averageProgress < 100 ? 'warning' : 'success'}
            value={records ? `${records.averageProgress}%` : '—'}
            caption={
              records?.unpayable.length
                ? `${records.unpayable.length} cannot be paid yet`
                : 'Right to work and contracts are checked on each record'
            }
            loading={staffQ.isPending || employeesQ.isPending}
            error={staffQ.isError || employeesQ.isError}
            visual={records ? { type: 'progress', pct: records.averageProgress } : undefined}
            href="/staff/team"
          />
        )}
      </StatCardGrid>
    </div>
  );
}
