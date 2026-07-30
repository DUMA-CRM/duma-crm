'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CalendarDays, CalendarRange, CircleHelp, Clock, Lock, Plus, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { HelpdeskBoard, type HelpdeskFilters } from '@/components/helpdesk/HelpdeskBoard';
import { PayrollHistoryPanel } from '@/components/payroll/PayrollHistoryPanel';
import { RunPayrollPanel } from '@/components/payroll/RunPayrollPanel';
import { LeaveInbox } from '@/components/people/HrInbox';
import { OnboardingPage } from '@/components/people/OnboardingPage';
import { StaffDirectory } from '@/components/people/StaffDirectory';
import { canSeeMoney } from '@/components/people/shared';
import { ShiftsView } from '@/components/scheduling/ShiftsView';
import { TeamRota } from '@/components/scheduling/TeamRota';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';

import { getManagedLeaveRequests, getManagedTickets } from '@/lib/api/people-ops.service';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export type StaffTab = 'team' | 'rota' | 'shifts' | 'leave' | 'helpdesk' | 'payroll';

/**
 * Each tab is a route so links stay shareable, the browser back button steps
 * between tabs, and the server-side role gates in the route layouts still apply.
 */
const TAB_PATH: Record<StaffTab, string> = {
  team: '/staff',
  rota: '/staff/rota',
  shifts: '/staff/shifts',
  leave: '/staff/requests',
  helpdesk: '/staff/helpdesk',
  payroll: '/staff/payroll',
};

// Team management is store_manager and up; people-ops tabs are an explicit
// allow-list because store_manager out-ranks hr_manager but must not see them.
const TEAM_ROLES = ['super_admin', 'franchise_owner', 'store_manager', 'hr_manager'];
const PEOPLE_OPS_ROLES = ['super_admin', 'franchise_owner', 'hr_manager'];

export function StaffWorkspace({ tab }: { tab: StaffTab }) {
  const router = useRouter();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const { tenantId } = useWorkspaceStore();

  const canManageTeam = TEAM_ROLES.includes(role ?? '');
  const canPeopleOps = PEOPLE_OPS_ROLES.includes(role ?? '');
  const canOnboard = canSeeMoney(role);

  const [onboarding, setOnboarding] = useState(false);
  const [leaveStatus, setLeaveStatus] = useState('pending');
  const [payrollView, setPayrollView] = useState<'run' | 'history'>('run');
  const [ticketFilters, setTicketFilters] = useState<HelpdeskFilters>({ search: '', status: 'open', category: '' });
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  // Counts for the tab badges. Cheap list reads, shared with the panels below.
  const { data: pendingLeave = [] } = useQuery({
    queryKey: ['leave-managed', 'pending'],
    queryFn: () => getManagedLeaveRequests('pending'),
    enabled: canPeopleOps,
  });
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['helpdesk-managed', ticketFilters.status, ticketFilters.category, ticketFilters.search],
    queryFn: () =>
      getManagedTickets({
        status: ticketFilters.status || undefined,
        category: ticketFilters.category || undefined,
        search: ticketFilters.search || undefined,
      }),
    enabled: canPeopleOps,
  });
  const { data: openTickets = [] } = useQuery({
    queryKey: ['helpdesk-managed', 'open', '', ''],
    queryFn: () => getManagedTickets({ status: 'open' }),
    enabled: canPeopleOps,
  });

  const tabs = useMemo<SectionTab<StaffTab>[]>(() => {
    const list: SectionTab<StaffTab>[] = [
      { value: 'team', label: 'Team', icon: UsersRound },
      { value: 'rota', label: 'Rota', icon: CalendarRange },
      { value: 'shifts', label: 'Shifts', icon: Clock },
    ];
    if (canPeopleOps) {
      list.push({
        value: 'leave',
        label: 'Leave',
        icon: CalendarDays,
        count: pendingLeave.filter((request) => request.status === 'pending').length,
        countTone: 'danger',
        countLabel: `${pendingLeave.length} awaiting a decision`,
      });
      list.push({
        value: 'helpdesk',
        label: 'Helpdesk',
        icon: CircleHelp,
        count: openTickets.length,
        countLabel: `${openTickets.length} open requests`,
      });
      list.push({ value: 'payroll', label: 'Payroll', icon: Banknote });
    }
    return list;
  }, [canPeopleOps, pendingLeave, openTickets.length]);

  if (role && !canManageTeam) {
    return (
      <EditorShell eyebrow="Management" title="Staff" icon={<UsersRound size={20} aria-hidden="true" />}>
        <EmptyState icon={Lock} title="Not available" description="You don’t have access to the staff directory." />
      </EditorShell>
    );
  }

  // A people-ops tab reached without the role (stale link) falls back to the team.
  const peopleOpsTab = tab === 'leave' || tab === 'helpdesk' || tab === 'payroll';
  const active: StaffTab = peopleOpsTab && !canPeopleOps ? 'team' : tab;

  return (
    <EditorShell
      eyebrow="Management"
      title="Staff"
      icon={<UsersRound size={20} aria-hidden="true" />}
      actions={
        active === 'team' && canOnboard ? (
          <Button className="h-10 gap-1.5" onClick={() => setOnboarding(true)}>
            <Plus size={15} />
            <span className="hidden md:inline">Onboard</span>
          </Button>
        ) : active === 'payroll' ? (
          <SegmentedControl
            options={[
              { value: 'run', label: 'Run payroll' },
              { value: 'history', label: 'History' },
            ]}
            value={payrollView}
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
      {active === 'team' && <StaffDirectory />}

      {active === 'rota' && <TeamRota />}

      {active === 'shifts' && <ShiftsView />}

      {active === 'leave' && <LeaveInbox status={leaveStatus} setStatus={setLeaveStatus} />}

      {active === 'helpdesk' && (
        <HelpdeskBoard
          mode="agent"
          tickets={tickets}
          loading={ticketsLoading}
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
        (payrollView === 'run' ? <RunPayrollPanel onFinalised={() => setPayrollView('history')} /> : <PayrollHistoryPanel />)}

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
