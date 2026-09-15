'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { HelpdeskBoard, type HelpdeskFilters } from '@/components/helpdesk/HelpdeskBoard';
import { Banknote, CalendarDays, CalendarRange, CircleHelp, Clock, LayoutDashboard, Lock, Plus, UsersRound } from '@/components/icons';
import { PayrollHistoryPanel } from '@/components/payroll/PayrollHistoryPanel';
import { RunPayrollPanel } from '@/components/payroll/RunPayrollPanel';
import { LeaveInbox } from '@/components/people/HrInbox';
import { OnboardingPage } from '@/components/people/OnboardingPage';
import { StaffDirectory } from '@/components/people/StaffDirectory';
import { StaffOverview } from '@/components/people/StaffOverview';
import { ShiftsWorkspace } from '@/components/scheduling/ShiftsWorkspace';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';

import { getManagedLeaveRequests, getManagedTickets } from '@/lib/api/people-ops.service';
import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export type StaffTab = 'overview' | 'team' | 'rota' | 'leave' | 'helpdesk' | 'payroll';

/**
 * Each tab is a route so links stay shareable, the browser back button steps
 * between tabs, and the server-side capability guards in the route layouts
 * still apply.
 *
 * `/staff` is the overview, not the directory: the workspace opens on what
 * needs a manager, the same way `/dashboard` and `/my-hr` do. The directory
 * moved to `/staff/team` when the overview took the root.
 */
const TAB_PATH: Record<StaffTab, string> = {
  overview: '/staff',
  team: '/staff/team',
  rota: '/staff/rota',
  leave: '/staff/requests',
  helpdesk: '/staff/helpdesk',
  payroll: '/staff/payroll',
};

export function StaffWorkspace({ tab }: { tab: StaffTab }) {
  const router = useRouter();
  const qc = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const { tenantId } = useWorkspaceStore();

  // One capability per tab, each the one the API already enforces on the data
  // behind it. This replaced two hardcoded role arrays: they let `auditor`
  // through the route guard and then showed them a locked door, and they hid
  // leave review from `store_manager`, who holds `hr.leave:review`.
  const canTeam = hasAnyCapability(capabilities, 'staff:read', 'hr.people:read');
  const canRota = hasAnyCapability(capabilities, 'scheduling:read', 'shifts:read');
  const canLeave = hasCapability(capabilities, 'hr.leave:review');
  const canHelpdesk = hasCapability(capabilities, 'helpdesk:manage');
  const canPayroll = hasCapability(capabilities, 'hr.payroll:read');

  const canOnboard = hasCapability(capabilities, 'staff:onboard');
  const canWriteRota = hasCapability(capabilities, 'scheduling:write');
  const canCorrectHours = hasCapability(capabilities, 'shifts:write');
  // Read without write is the auditor's whole point: they see payroll history
  // and never reach the panel that creates a run.
  const canRunPayroll = hasCapability(capabilities, 'hr.payroll:write');

  const [onboarding, setOnboarding] = useState(false);
  const [newShift, setNewShift] = useState<'planned' | 'worked' | null>(null);
  const [leaveStatus, setLeaveStatus] = useState('pending');
  // Not `useState(canRunPayroll ? 'run' : 'history')`: `capabilities` arrives
  // with the session, so on the first render it is empty, the initialiser —
  // which runs exactly once — locks this to 'history', and the tab then opens
  // on History for someone who can run payroll. Default to 'run' and clamp at
  // render instead, so a read-only holder still cannot reach the panel.
  const [payrollView, setPayrollView] = useState<'run' | 'history'>('run');
  const [ticketFilters, setTicketFilters] = useState<HelpdeskFilters>({ search: '', status: 'open', category: '' });
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  // Counts for the tab badges. Cheap list reads, shared by key with the panels
  // below and with the overview.
  const pendingLeaveQuery = useQuery({
    queryKey: ['leave-managed', 'pending'],
    queryFn: () => getManagedLeaveRequests('pending'),
    enabled: canLeave,
  });
  const {
    data: tickets = [],
    isLoading: ticketsLoading,
    isError: ticketsError,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ['helpdesk-managed', ticketFilters.status, ticketFilters.category, ticketFilters.search],
    queryFn: () =>
      getManagedTickets({
        status: ticketFilters.status || undefined,
        category: ticketFilters.category || undefined,
        search: ticketFilters.search || undefined,
      }),
    enabled: canHelpdesk,
  });
  const openTicketsQuery = useQuery({
    queryKey: ['helpdesk-managed', 'open', '', ''],
    queryFn: () => getManagedTickets({ status: 'open' }),
    enabled: canHelpdesk,
  });

  const tabs = useMemo<SectionTab<StaffTab>[]>(() => {
    const list: SectionTab<StaffTab>[] = [{ value: 'overview', label: 'Overview', icon: LayoutDashboard }];
    if (canTeam) list.push({ value: 'team', label: 'Team', icon: UsersRound });
    if (canRota) list.push({ value: 'rota', label: 'Rota & shifts', icon: CalendarRange });
    if (canLeave) {
      // A failed read must not render as "0 awaiting a decision" — no badge is
      // honest about not knowing; a zero is a claim the queue is clear.
      const waiting = pendingLeaveQuery.isError
        ? undefined
        : (pendingLeaveQuery.data ?? []).filter((request) => request.status === 'pending').length;
      list.push({
        value: 'leave',
        label: 'Leave',
        icon: CalendarDays,
        count: waiting,
        countTone: 'danger',
        countLabel: waiting ? `${waiting} awaiting a decision` : undefined,
      });
    }
    if (canHelpdesk) {
      const open = openTicketsQuery.isError ? undefined : openTicketsQuery.data?.length;
      list.push({
        value: 'helpdesk',
        label: 'Helpdesk',
        icon: CircleHelp,
        count: open,
        countLabel: open ? `${open} open requests` : undefined,
      });
    }
    if (canPayroll) list.push({ value: 'payroll', label: 'Payroll', icon: Banknote });
    return list;
  }, [
    canTeam,
    canRota,
    canLeave,
    canHelpdesk,
    canPayroll,
    pendingLeaveQuery.data,
    pendingLeaveQuery.isError,
    openTicketsQuery.data,
    openTicketsQuery.isError,
  ]);

  // Capabilities arrive with the session; an empty list means "not loaded yet",
  // not "holds nothing", so the locked state waits for it.
  if (capabilities.length > 0 && !canTeam && !canRota && !canLeave && !canHelpdesk && !canPayroll) {
    return (
      <EditorShell eyebrow="Management" title="Staff" icon={<UsersRound size={20} aria-hidden="true" />}>
        <EmptyState icon={Lock} title="Not available" description="You don’t have access to the staff workspace." />
      </EditorShell>
    );
  }

  // A tab reached without the capability (a stale link, a changed grant) falls
  // back to the overview, which every holder of any staff capability can read.
  const reachable = tabs.some((entry) => entry.value === tab);
  const active: StaffTab = reachable ? tab : 'overview';

  return (
    <EditorShell
      eyebrow="Management"
      title="Staff"
      icon={<UsersRound size={20} aria-hidden="true" />}
      actions={
        active === 'team' && canOnboard ? (
          <Button className="h-9 gap-1.5" onClick={() => setOnboarding(true)}>
            <Plus size={15} />
            <span className="hidden md:inline">Onboard</span>
          </Button>
        ) : active === 'rota' && (canWriteRota || canCorrectHours) ? (
          <div className="flex items-center gap-2">
            {canCorrectHours && (
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setNewShift('worked')}>
                <Clock size={15} />
                <span className="hidden md:inline">Record hours</span>
                <span className="md:hidden">Hours</span>
              </Button>
            )}
            {canWriteRota && (
              <Button className="h-9 gap-1.5" onClick={() => setNewShift('planned')}>
                <Plus size={15} />
                <span className="hidden md:inline">Plan shift</span>
                <span className="md:hidden">Shift</span>
              </Button>
            )}
          </div>
        ) : active === 'payroll' && canRunPayroll ? (
          <SegmentedControl
            options={[
              { value: 'run', label: 'Run payroll' },
              { value: 'history', label: 'History' },
            ]}
            value={canRunPayroll ? payrollView : 'history'}
            onChange={setPayrollView}
          />
        ) : undefined
      }
      subheader={
        <SectionTabs
          tabs={tabs}
          value={active}
          onChange={(next) => {
            setSelectedTicket(null);
            router.push(TAB_PATH[next]);
          }}
          ariaLabel="Staff sections"
        />
      }
      // The helpdesk queue/detail split scrolls its own panes.
      flush={active === 'helpdesk'}
    >
      {active === 'overview' && (
        <StaffOverview access={{ team: canTeam, rota: canRota, leave: canLeave, helpdesk: canHelpdesk, payroll: canPayroll }} />
      )}

      {active === 'team' && <StaffDirectory />}

      {active === 'rota' && <ShiftsWorkspace creating={newShift} onCreatingChange={setNewShift} />}

      {active === 'leave' && <LeaveInbox status={leaveStatus} setStatus={setLeaveStatus} />}

      {active === 'helpdesk' && (
        <HelpdeskBoard
          mode="agent"
          tickets={tickets}
          loading={ticketsLoading}
          error={ticketsError}
          onRetry={() => void refetchTickets()}
          selectedId={selectedTicket}
          onSelect={setSelectedTicket}
          filters={ticketFilters}
          onFiltersChange={setTicketFilters}
          onChanged={() => qc.invalidateQueries({ queryKey: ['helpdesk-managed'] })}
          emptyTitle="Queue clear"
          emptyDescription="No requests match this view."
        />
      )}

      {active === 'payroll' &&
        (canRunPayroll && payrollView === 'run' ? (
          <RunPayrollPanel onFinalised={() => setPayrollView('history')} />
        ) : (
          <PayrollHistoryPanel />
        ))}

      {/* Full-screen onboarding, then straight into the new record */}
      {onboarding && tenantId && (
        <OnboardingPage
          onClose={() => setOnboarding(false)}
          onCreated={(userId) => {
            setOnboarding(false);
            router.push(`/staff/${userId}`);
          }}
        />
      )}
    </EditorShell>
  );
}
