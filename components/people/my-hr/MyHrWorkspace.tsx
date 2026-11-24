'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { HelpdeskBoard } from '@/components/helpdesk/HelpdeskBoard';
import { CalendarCheck, CalendarClock, CalendarDays, CircleHelp, FileText, LayoutDashboard, MessageSquarePlus, Plus } from '@/components/icons';
import { EnrollEmployeeDrawer } from '@/components/people/PeopleModals';
import { EditorShell } from '@/components/shared/EditorShell';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { getMyPayslips } from '@/lib/modules/payroll/client';
import { getEmployeeBank, getMyEmployee } from '@/lib/modules/people/client';
import { getMyDocuments, getMyEntitlements, getMyLeaveRequests, getMyTickets } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type MyHrAction, myHrActions } from '@/lib/utils/my-hr';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AttendancePanel } from './AttendancePanel';
import { DocumentsPanel } from './DocumentsPanel';
import { Overview } from './Overview';
import { TimeOffPanel } from './TimeOffPanel';
import { LeaveRequestDrawer, NewTicketDrawer, type TicketPreset } from './forms';
import { type BankVisibility, type EditRow, type MyHrTab, type MyWorkTab } from './shared';

/** The HR tabs of My work, without their counts — what the Rota tab's strip shows beside its own. */
export const MY_HR_TAB_DEFS: SectionTab<MyHrTab>[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'time-off', label: 'Time off', icon: CalendarDays },
  { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { value: 'documents', label: 'Documents', icon: FileText },
  { value: 'helpdesk', label: 'Helpdesk', icon: CircleHelp },
];

/**
 * The employee's own HR — the HR tabs of My work (/my-work, which was /my-hr).
 *
 * One tab per question — what needs me, how much time off do I have, where did
 * my hours go, what does HR hold about me, what am I owed, what have I asked
 * for. Everything an employee is legally entitled to see about themselves is
 * reachable from here without asking anyone.
 *
 * The open tab lives in the URL (`?tab=`), owned by `MyWork`; `leadingTabs`
 * is the Rota tab when the workforce module is on.
 */
export function MyHrWorkspace({
  tab,
  onTabChange: setTab,
  leadingTabs = [],
}: {
  tab: MyHrTab;
  onTabChange: (tab: MyWorkTab) => void;
  leadingTabs?: SectionTab<MyWorkTab>[];
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const capabilities = useAuthStore((s) => s.capabilities);
  const tenantId = useWorkspaceStore((s) => s.tenantId);
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    staleTime: 30_000,
  });
  const payrollEnabled = modules.data?.modules.some((module) => module.moduleId === 'payroll' && module.status === 'enabled') ?? false;
  const searchParams = useSearchParams();

  const [leaveOpen, setLeaveOpen] = useState(false);
  // The Overview row whose form is open — held here so a deep link or a "needs you" fix can open it.
  const [editRow, setEditRow] = useState<EditRow | null>(null);
  const [createEmployeeOpen, setCreateEmployeeOpen] = useState(false);
  const [ticket, setTicket] = useState<TicketPreset | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employee-me'),
    queryFn: getMyEmployee,
    retry: false,
  });
  const canCreateOwnEmployeeRecord = Boolean(user && tenantId && hasCapability(capabilities, 'hr.people:write'));
  const { data: entitlements = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('leave-entitlements-me'),
    queryFn: () => getMyEntitlements(),
  });
  const { data: requests = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('leave-requests-me'), queryFn: getMyLeaveRequests });
  const ticketsQuery = useQuery({ queryKey: moduleQueryKeys.support.key('helpdesk-my'), queryFn: getMyTickets });
  // Memoised because `?? []` hands back a fresh array every render, which
  // would defeat the `actions` memo below.
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const { data: documents = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('documents-me'), queryFn: getMyDocuments });
  const { data: payslips = [] } = useQuery({
    queryKey: moduleQueryKeys.payroll.key('payslips-me'),
    queryFn: getMyPayslips,
    enabled: payrollEnabled,
    retry: false,
  });

  // AI and notifications may deep-link to a specific self-service action. Once
  // the employee record has loaded, open the first editable row and consume
  // the intent so closing it does not immediately reopen it.
  useEffect(() => {
    if (!employee || searchParams.get('action') !== 'edit-details') return;
    const timer = window.setTimeout(() => {
      // Replaces the URL with `?tab=overview`, which also drops the `action`.
      setTab('overview');
      setEditRow('address');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [employee, searchParams, setTab]);

  // The bank endpoint is manager-scoped; for ordinary staff it refuses. A
  // refusal means "cannot tell", never "none held" — so nothing downstream is
  // allowed to assert the details are missing.
  const bankQuery = useQuery({
    queryKey: moduleQueryKeys.people.key('my-bank', employee?.userId),
    queryFn: () => getEmployeeBank(employee!.userId),
    enabled: !!employee?.userId,
    retry: false,
  });
  const bank: BankVisibility = bankQuery.isSuccess ? { known: true, ...bankQuery.data } : { known: false };

  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length;

  const actions = useMemo(
    () => myHrActions({ employee, hasBankDetails: bank.known ? bank.hasBankDetails : undefined, documents, tickets }),
    [employee, bank.known, bank.hasBankDetails, documents, tickets],
  );
  const needsAttention = actions.filter((action) => action.severity !== 'info').length;

  const tabs = useMemo<SectionTab<MyWorkTab>[]>(
    () => [
      ...leadingTabs,
      ...MY_HR_TAB_DEFS.map((def): SectionTab<MyWorkTab> => {
        if (def.value === 'overview')
          return { ...def, count: needsAttention, countTone: 'danger', countLabel: `${needsAttention} things need you` };
        if (def.value === 'helpdesk') return { ...def, count: openTickets, countLabel: `${openTickets} open questions` };
        return def;
      }),
    ],
    [leadingTabs, needsAttention, openTickets],
  );

  const requestDocument = () =>
    setTicket({
      title: 'Request a document',
      subject: 'Document request',
      category: 'hr',
      message: 'Please send me a copy of the following document: ',
    });

  const requestCorrection = (date: string) =>
    setTicket({
      title: 'Ask for an attendance correction',
      subject: `Attendance correction — ${date}`,
      category: 'scheduling',
      message: `Please review my attendance record for ${date}. `,
    });

  const requestData = () =>
    setTicket({
      title: 'Request your data',
      subject: 'Request for a copy of my employment data',
      category: 'hr',
      message: 'Please send me a copy of the personal data held about me, and confirm how it is used.',
    });

  /** Every action row lands the employee on the thing that resolves it. */
  const runAction = (action: MyHrAction) => {
    // The row whose form fixes it: NI and bank are separate rows under Pay, the
    // address and emergency contact separate rows under Personal details.
    if (action.target === 'details' || action.target === 'bank') {
      const row: EditRow =
        action.id === 'ni' ? 'ni' : action.id === 'emergency-contact' ? 'emergency' : action.target === 'bank' ? 'bank' : 'address';
      setTab('overview');
      return setEditRow(row);
    }
    if (action.target === 'documents') return setTab('documents');
    if (action.target === 'time') return setTab('time-off');
    if (action.id === 'written-particulars') return requestDocument();
    const waiting = tickets.find((t) => `ticket-${t.id}` === action.id);
    if (waiting) {
      setSelectedTicket(waiting.id);
      return setTab('helpdesk');
    }
    setTicket({ subject: action.title, category: 'hr', message: '' });
  };

  /**
   * The header offers what this tab is for. "Ask HR" stays available
   * throughout, because needing to ask is not confined to one section. The
   * Overview has no header action: each of its rows carries its own Change.
   */
  const primaryAction: Record<MyHrTab, { label: string; icon: typeof Plus; onClick: () => void } | null> = {
    overview: null,
    'time-off': { label: 'Request time off', icon: Plus, onClick: () => setLeaveOpen(true) },
    attendance: {
      label: 'Report a problem',
      icon: MessageSquarePlus,
      onClick: () =>
        setTicket({
          title: 'Report an attendance problem',
          subject: 'Attendance query',
          category: 'scheduling',
          message: 'There is a problem with my recorded hours: ',
        }),
    },
    documents: { label: 'Request a document', icon: Plus, onClick: requestDocument },
    helpdesk: { label: 'Ask HR', icon: MessageSquarePlus, onClick: () => setTicket({}) },
  };
  const primary = primaryAction[tab];
  const PrimaryIcon = primary?.icon;

  return (
    <EditorShell
      title="My work"
      // The page's name, not the user's face — the Overview's identity card shows that, a few pixels below.
      icon={<CalendarClock size={20} aria-hidden="true" />}
      actions={
        <>
          {tab !== 'helpdesk' && (
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setTicket({})}>
              <MessageSquarePlus size={15} />
              <span className="hidden lg:inline">Ask HR</span>
            </Button>
          )}
          {primary && (
            <Button className="h-9 gap-1.5" onClick={primary.onClick}>
              {PrimaryIcon && <PrimaryIcon size={15} />}
              <span className="hidden md:inline">{primary.label}</span>
            </Button>
          )}
        </>
      }
      subheader={<SectionTabs<MyWorkTab> tabs={tabs} value={tab} onChange={setTab} ariaLabel="My work sections" animationId="my-work-tabs" />}
    >
      {tab === 'overview' && (
        <Overview
          employee={employee}
          loading={employeeLoading}
          entitlements={entitlements}
          latestPayslip={payslips[0]}
          payrollEnabled={payrollEnabled}
          bank={bank}
          actions={actions}
          onAction={runAction}
          editRow={editRow}
          onEditRow={setEditRow}
          onEdited={() => {
            setEditRow(null);
            qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employee-me') });
            qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('my-bank', employee?.userId) });
          }}
          go={setTab}
          canCreateOwnEmployeeRecord={canCreateOwnEmployeeRecord}
          onCreateOwnEmployeeRecord={() => setCreateEmployeeOpen(true)}
        />
      )}
      {tab === 'time-off' && <TimeOffPanel requests={requests} entitlements={entitlements} />}
      {tab === 'attendance' && <AttendancePanel onCorrection={requestCorrection} />}
      {tab === 'documents' && (
        <DocumentsPanel employee={employee} documents={documents} payrollEnabled={payrollEnabled} onDataRequest={requestData} />
      )}
      {tab === 'helpdesk' && (
        <HelpdeskBoard
          mode="employee"
          tickets={tickets}
          loading={ticketsQuery.isPending}
          error={ticketsQuery.isError}
          onRetry={() => void ticketsQuery.refetch()}
          selectedId={selectedTicket}
          onSelect={setSelectedTicket}
          onNew={() => setTicket({})}
          onChanged={() => qc.invalidateQueries({ queryKey: moduleQueryKeys.support.key('helpdesk-my') })}
          emptyTitle="No questions yet"
          emptyDescription="Ask HR a question, request a document, or query something on your record."
        />
      )}

      {leaveOpen && (
        <LeaveRequestDrawer
          onClose={() => setLeaveOpen(false)}
          onDone={() => {
            setLeaveOpen(false);
            qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-requests-me') });
            qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('leave-entitlements-me') });
          }}
        />
      )}
      {createEmployeeOpen && user && tenantId && (
        <EnrollEmployeeDrawer
          member={{ userId: user.id, name: user.name, email: user.email }}
          onClose={() => setCreateEmployeeOpen(false)}
          initialJobTitle="Franchise owner"
          submitLabel="Create record"
        />
      )}
      {ticket && (
        <NewTicketDrawer
          preset={ticket}
          onClose={() => setTicket(null)}
          onDone={(createdId) => {
            setTicket(null);
            setTab('helpdesk');
            // Open the question straight away so the employee lands on what they just raised.
            if (createdId) setSelectedTicket(createdId);
            qc.invalidateQueries({ queryKey: moduleQueryKeys.support.key('helpdesk-my') });
          }}
        />
      )}
    </EditorShell>
  );
}
