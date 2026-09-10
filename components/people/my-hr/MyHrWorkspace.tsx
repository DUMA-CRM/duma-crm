'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { HelpdeskBoard } from '@/components/helpdesk/HelpdeskBoard';
import {
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  FileText,
  LayoutDashboard,
  MessageSquarePlus,
  Pencil,
  Plus,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { getEmployeeBank, getMyEmployee } from '@/lib/api/hr.service';
import {
  getMyDocuments,
  getMyEntitlements,
  getMyLeaveRequests,
  getMyPayslips,
  getMyTickets,
} from '@/lib/api/people-ops.service';
import { type MyHrAction, myHrActions } from '@/lib/utils/my-hr';
import { useAuthStore } from '@/stores/authStore';

import { AttendancePanel } from './AttendancePanel';
import { DocumentsPanel } from './DocumentsPanel';
import { Overview } from './Overview';
import { TimeOffPanel } from './TimeOffPanel';
import { EditDetailsDrawer, LeaveRequestDrawer, NewTicketDrawer, type TicketPreset } from './forms';
import { type BankVisibility, MY_HR_TABS, type MyHrTab } from './shared';

/**
 * The employee's own HR workspace.
 *
 * One tab per question — what needs me, how much time off do I have, where did
 * my hours go, what does HR hold about me, what am I owed, what have I asked
 * for. Everything an employee is legally entitled to see about themselves is
 * reachable from here without asking anyone.
 */
export function MyHrWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // `?tab=` lets other pages (Support, notifications) link to a section.
  const searchParams = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<MyHrTab>(MY_HR_TABS.includes(requested as MyHrTab) ? (requested as MyHrTab) : 'overview');

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [ticket, setTicket] = useState<TicketPreset | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  const { data: employee, isLoading: employeeLoading } = useQuery({ queryKey: ['hr-employee-me'], queryFn: getMyEmployee, retry: false });
  const { data: entitlements = [] } = useQuery({ queryKey: ['leave-entitlements-me'], queryFn: () => getMyEntitlements() });
  const { data: requests = [] } = useQuery({ queryKey: ['leave-requests-me'], queryFn: getMyLeaveRequests });
  const ticketsQuery = useQuery({ queryKey: ['helpdesk-my'], queryFn: getMyTickets });
  // Memoised because `?? []` hands back a fresh array every render, which
  // would defeat the `actions` memo below.
  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const { data: documents = [] } = useQuery({ queryKey: ['documents-me'], queryFn: getMyDocuments });
  const { data: payslips = [] } = useQuery({ queryKey: ['payslips-me'], queryFn: getMyPayslips, retry: false });

  // AI and notifications may deep-link to a specific self-service action. Once
  // the employee record has loaded, open the existing form and consume the
  // intent so closing the drawer does not immediately reopen it.
  useEffect(() => {
    if (!employee || searchParams.get('action') !== 'edit-details') return;
    const timer = window.setTimeout(() => {
      setTab('overview');
      setEditOpen(true);
      router.replace('/my-hr?tab=overview', { scroll: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [employee, router, searchParams]);

  // The bank endpoint is manager-scoped; for ordinary staff it refuses. A
  // refusal means "cannot tell", never "none held" — so nothing downstream is
  // allowed to assert the details are missing.
  const bankQuery = useQuery({
    queryKey: ['my-bank', employee?.userId],
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

  const tabs = useMemo<SectionTab<MyHrTab>[]>(
    () => [
      {
        value: 'overview',
        label: 'Overview',
        icon: LayoutDashboard,
        count: needsAttention,
        countTone: 'danger',
        countLabel: `${needsAttention} things need you`,
      },
      { value: 'time-off', label: 'Time off', icon: CalendarDays },
      { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { value: 'documents', label: 'Documents', icon: FileText },
      { value: 'requests', label: 'Requests', icon: CircleHelp, count: openTickets, countLabel: `${openTickets} open requests` },
    ],
    [needsAttention, openTickets],
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
    if (action.target === 'details' || action.target === 'bank') return setEditOpen(true);
    if (action.target === 'documents') return setTab('documents');
    if (action.target === 'time') return setTab('time-off');
    if (action.id === 'written-particulars') return requestDocument();
    const waiting = tickets.find((t) => `ticket-${t.id}` === action.id);
    if (waiting) {
      setSelectedTicket(waiting.id);
      return setTab('requests');
    }
    setTicket({ subject: action.title, category: 'hr', message: '' });
  };

  /**
   * The header offers what this tab is for. "Ask HR" stays available
   * throughout, because needing to ask is not confined to one section.
   */
  const primaryAction: Record<MyHrTab, { label: string; icon: typeof Plus; onClick: () => void } | null> = {
    overview: { label: 'Edit your details', icon: Pencil, onClick: () => setEditOpen(true) },
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
    requests: { label: 'Ask HR', icon: MessageSquarePlus, onClick: () => setTicket({}) },
  };
  const primary = primaryAction[tab];
  const PrimaryIcon = primary?.icon;

  const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');

  return (
    <EditorShell
      eyebrow="Your HR"
      title={user?.name ?? 'My HR'}
      leading={<InitialsAvatar firstName={firstName || 'U'} lastName={lastName} email={user?.email} className="size-9" />}
      actions={
        <>
          {tab !== 'requests' && (
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setTicket({})}>
              <MessageSquarePlus size={15} />
              <span className="hidden lg:inline">Ask HR</span>
            </Button>
          )}
          {primary && (
            <Button className="h-9 gap-1.5" onClick={primary.onClick} disabled={primary.label === 'Edit your details' && !employee}>
              {PrimaryIcon && <PrimaryIcon size={15} />}
              <span className="hidden md:inline">{primary.label}</span>
            </Button>
          )}
        </>
      }
      subheader={<SectionTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="My HR sections" />}
      // The requests board is a split queue/detail view — it manages its own scrolling.
      flush={tab === 'requests'}
    >
      {tab === 'overview' && (
        <Overview
          employee={employee}
          loading={employeeLoading}
          entitlements={entitlements}
          latestPayslip={payslips[0]}
          openTickets={openTickets}
          bank={bank}
          actions={actions}
          onAction={runAction}
          go={setTab}
        />
      )}
      {tab === 'time-off' && <TimeOffPanel requests={requests} entitlements={entitlements} />}
      {tab === 'attendance' && <AttendancePanel onCorrection={requestCorrection} />}
      {tab === 'documents' && <DocumentsPanel employee={employee} documents={documents} onDataRequest={requestData} />}
      {tab === 'requests' && (
        <HelpdeskBoard
          mode="employee"
          tickets={tickets}
          loading={ticketsQuery.isPending}
          error={ticketsQuery.isError}
          onRetry={() => void ticketsQuery.refetch()}
          selectedId={selectedTicket}
          onSelect={setSelectedTicket}
          onNew={() => setTicket({})}
          onChanged={() => qc.invalidateQueries({ queryKey: ['helpdesk-my'] })}
          emptyTitle="No requests yet"
          emptyDescription="Ask HR a question, request a document, or query something on your record."
        />
      )}

      {leaveOpen && (
        <LeaveRequestDrawer
          onClose={() => setLeaveOpen(false)}
          onDone={() => {
            setLeaveOpen(false);
            qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
            qc.invalidateQueries({ queryKey: ['leave-entitlements-me'] });
          }}
        />
      )}
      {editOpen && employee && (
        <EditDetailsDrawer
          employee={employee}
          onClose={() => setEditOpen(false)}
          onDone={() => {
            setEditOpen(false);
            qc.invalidateQueries({ queryKey: ['hr-employee-me'] });
            qc.invalidateQueries({ queryKey: ['my-bank', employee.userId] });
          }}
        />
      )}
      {ticket && (
        <NewTicketDrawer
          preset={ticket}
          onClose={() => setTicket(null)}
          onDone={(createdId) => {
            setTicket(null);
            setTab('requests');
            // Open the request straight away so the employee lands on what they just raised.
            if (createdId) setSelectedTicket(createdId);
            qc.invalidateQueries({ queryKey: ['helpdesk-my'] });
          }}
        />
      )}
    </EditorShell>
  );
}
