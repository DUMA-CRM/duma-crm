'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { HelpdeskBoard } from '@/components/helpdesk/HelpdeskBoard';
import { EditorShell } from '@/components/shared/EditorShell';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getMyTrainingAssignments } from '@/lib/api/courses.service';
import {
  type BankDetailsPayload,
  type HrEmployee,
  getEmployeeBank,
  getMyEmployee,
  setEmployeeBank,
  updateMyEmployee,
} from '@/lib/api/hr.service';
import {
  type AttendanceDay,
  type EmployeeDocument,
  type LeaveEntitlement,
  type LeaveRequest,
  type TicketCategory,
  type TicketPriority,
  cancelLeaveRequest,
  createTicket,
  getLeaveTypes,
  getMyAttendance,
  getMyDocuments,
  getMyEntitlements,
  getMyLeaveRequests,
  getMyTickets,
  submitLeaveRequest,
} from '@/lib/api/people-ops.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

type Tab = 'overview' | 'leave' | 'attendance' | 'training' | 'documents' | 'helpdesk';
const fmt = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const statusVariant = (status: string): 'success' | 'warning' | 'destructive' | 'muted' =>
  status === 'approved' || status === 'resolved'
    ? 'success'
    : status === 'pending' || status === 'open' || status === 'in_progress'
      ? 'warning'
      : status === 'declined'
        ? 'destructive'
        : 'muted';

export function MyHrWorkspace() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('overview');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const { data: employee, isLoading: employeeLoading } = useQuery({ queryKey: ['hr-employee-me'], queryFn: getMyEmployee, retry: false });
  const { data: entitlements = [] } = useQuery({ queryKey: ['leave-entitlements-me'], queryFn: () => getMyEntitlements() });
  const { data: requests = [] } = useQuery({ queryKey: ['leave-requests-me'], queryFn: getMyLeaveRequests });
  const { data: tickets = [] } = useQuery({ queryKey: ['helpdesk-my'], queryFn: getMyTickets });
  const { data: documents = [] } = useQuery({ queryKey: ['documents-me'], queryFn: getMyDocuments });
  const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;
  const holiday = entitlements[0];
  const remaining = holiday ? Number(holiday.totalDays) - Number(holiday.usedDays) : 0;

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'overview', label: 'Overview', icon: LayoutDashboard },
      { value: 'leave', label: 'Leave', icon: CalendarDays },
      { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { value: 'training', label: 'Training', icon: GraduationCap },
      { value: 'documents', label: 'Documents', icon: FileText },
      { value: 'helpdesk', label: 'Helpdesk', icon: CircleHelp, count: openTickets },
    ],
    [openTickets],
  );

  const requestCorrection = (date: string) => {
    sessionStorage.setItem('attendance-correction-date', date);
    setTicketOpen(true);
  };

  const [firstName = '', lastName = ''] = (user?.name ?? '').split(' ');

  return (
    <EditorShell
      eyebrow="Employee workspace"
      title={user?.name ?? 'My HR'}
      leading={<InitialsAvatar firstName={firstName || 'U'} lastName={lastName} email={user?.email} className="size-11" />}
      meta={
        <>
          {employee?.jobTitle && <span className="text-xs text-muted-foreground">{employee.jobTitle}</span>}
          {employee?.department && <Badge variant="muted">{employee.department}</Badge>}
          {employee?.employmentType && <Badge variant="muted">{employee.employmentType.replaceAll('_', ' ')}</Badge>}
          {employee?.startDate && <span className="text-xs text-muted-foreground">Since {fmt(employee.startDate)}</span>}
        </>
      }
      actions={
        <>
          <Button variant="outline" className="h-10 gap-1.5" onClick={() => setTicketOpen(true)}>
            <MessageSquarePlus size={15} />
            <span className="hidden md:inline">New request</span>
          </Button>
          <Button className="h-10 gap-1.5" onClick={() => setLeaveOpen(true)}>
            <Plus size={15} />
            <span className="hidden md:inline">Request leave</span>
          </Button>
        </>
      }
      subheader={<SectionTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="My HR sections" />}
      // The helpdesk is a split queue/detail view — it manages its own scrolling.
      flush={tab === 'helpdesk'}
    >
      {tab === 'overview' && (
        <Overview
          employee={employee}
          loading={employeeLoading}
          remaining={remaining}
          used={Number(holiday?.usedDays ?? 0)}
          pending={requests.filter((r) => r.status === 'pending').length}
          openTickets={openTickets}
          go={setTab}
        />
      )}
      {tab === 'leave' && <LeavePanel requests={requests} entitlements={entitlements} onRequest={() => setLeaveOpen(true)} />}
      {tab === 'attendance' && <AttendanceCalendar onCorrection={requestCorrection} />}
      {tab === 'training' && <TrainingPanel />}
      {tab === 'documents' && <DocumentsPanel documents={documents} />}
      {tab === 'helpdesk' && (
        <HelpdeskBoard
          mode="employee"
          tickets={tickets}
          selectedId={selectedTicket}
          onSelect={setSelectedTicket}
          onNew={() => setTicketOpen(true)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['helpdesk-my'] })}
          emptyTitle="No requests yet"
          emptyDescription="Ask HR a question or request an attendance correction."
        />
      )}
      {leaveOpen && (
        <LeaveRequestModal
          onClose={() => setLeaveOpen(false)}
          onDone={() => {
            setLeaveOpen(false);
            qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
            qc.invalidateQueries({ queryKey: ['leave-entitlements-me'] });
          }}
        />
      )}
      {ticketOpen && (
        <NewTicketModal
          onClose={() => setTicketOpen(false)}
          onDone={(createdId) => {
            setTicketOpen(false);
            setTab('helpdesk');
            // Open the request straight away so the employee lands on what they just raised.
            if (createdId) setSelectedTicket(createdId);
            qc.invalidateQueries({ queryKey: ['helpdesk-my'] });
          }}
        />
      )}
    </EditorShell>
  );
}

// ── Small building blocks for the overview cards ────────────────────────────────
function InfoCard({
  icon: Icon,
  title,
  onEdit,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={16} aria-hidden="true" />
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        </div>
        {onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="gap-1.5 text-xs">
            <Pencil size={13} /> Edit
          </Button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium capitalize">{value || <span className="text-muted-foreground">Not set</span>}</dd>
    </div>
  );
}

function Overview({
  employee,
  loading,
  remaining,
  used,
  pending,
  openTickets,
  go,
}: {
  employee?: HrEmployee;
  loading: boolean;
  remaining: number;
  used: number;
  pending: number;
  openTickets: number;
  go: (tab: Tab) => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [editDetails, setEditDetails] = useState(false);
  const [editBank, setEditBank] = useState(false);

  const bank = useQuery({
    queryKey: ['my-bank', employee?.userId],
    queryFn: () => getEmployeeBank(employee!.userId),
    enabled: !!employee?.userId,
    retry: false,
  });

  if (loading)
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );

  const cards = [
    { label: 'Leave remaining', value: `${remaining} days`, note: `${used} days used`, tab: 'leave' as const },
    { label: 'Pending requests', value: pending, note: 'Awaiting review', tab: 'leave' as const },
    { label: 'Open tickets', value: openTickets, note: 'HR conversations', tab: 'helpdesk' as const },
  ];

  return (
    <div className="space-y-5">
      {/* Quick stats */}
      <div className="grid md:grid-cols-3 gap-3">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => go(card.tab)}
            className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{card.label}</p>
            <p className="text-3xl font-semibold mt-3 tabular-nums">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.note}</p>
          </button>
        ))}
      </div>

      {/* Details grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        <InfoCard icon={MapPin} title="Personal details" onEdit={() => setEditDetails(true)}>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Email" value={user?.email} />
            <Field label="Date of birth" value={employee?.dateOfBirth ? fmt(employee.dateOfBirth) : undefined} />
            <div className="sm:col-span-2">
              <Field label="Home address" value={employee?.address} />
            </div>
          </dl>
        </InfoCard>

        <InfoCard icon={ShieldAlert} title="Emergency contact" onEdit={() => setEditDetails(true)}>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Name" value={employee?.emergencyContactName} />
            <Field label="Relationship" value={employee?.emergencyContactRelation} />
            <div className="sm:col-span-2">
              <Field label="Phone" value={employee?.emergencyContactPhone} />
            </div>
          </dl>
        </InfoCard>

        <InfoCard icon={Landmark} title="Bank details" onEdit={bank.isError ? undefined : () => setEditBank(true)}>
          {bank.isError ? (
            <p className="text-sm text-muted-foreground">Not available here — contact HR to update your bank details.</p>
          ) : bank.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : bank.data?.hasBankDetails ? (
            <dl className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Account holder" value={bank.data.accountHolder} />
              <Field label="Bank" value={bank.data.bankName} />
              <Field label="Sort code" value={bank.data.sortCode} />
              <Field label="Account number" value={bank.data.accountNumber} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details on file. Add them so payroll can pay you.</p>
          )}
        </InfoCard>

        <InfoCard icon={FileText} title="Employment">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <Field label="Job title" value={employee?.jobTitle} />
            <Field label="Department" value={employee?.department} />
            <Field label="Employment type" value={employee?.employmentType?.replaceAll('_', ' ')} />
            <Field label="Start date" value={employee?.startDate ? fmt(employee.startDate) : undefined} />
          </dl>
        </InfoCard>
      </div>

      {editDetails && employee && (
        <EditDetailsModal
          employee={employee}
          onClose={() => setEditDetails(false)}
          onDone={() => {
            setEditDetails(false);
            qc.invalidateQueries({ queryKey: ['hr-employee-me'] });
          }}
        />
      )}
      {editBank && employee && (
        <EditBankModal
          userId={employee.userId}
          current={bank.data}
          onClose={() => setEditBank(false)}
          onDone={() => {
            setEditBank(false);
            qc.invalidateQueries({ queryKey: ['my-bank', employee.userId] });
          }}
        />
      )}
    </div>
  );
}

function EditDetailsModal({ employee, onClose, onDone }: { employee: HrEmployee; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    address: employee.address ?? '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactRelation: employee.emergencyContactRelation ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
  });
  const mutation = useMutation({
    mutationFn: () => updateMyEmployee(form),
    onSuccess: () => {
      toast('success', 'Details updated.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  const field = (key: keyof typeof form, label: string, props: Record<string, unknown> = {}) => (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <Input className="mt-1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  );
  return (
    <Modal title="Edit personal details" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {field('address', 'Home address', { placeholder: '123 High Street, Town, Postcode' })}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Emergency contact</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {field('emergencyContactName', 'Name')}
            {field('emergencyContactRelation', 'Relationship')}
          </div>
          <div className="mt-3">{field('emergencyContactPhone', 'Phone', { type: 'tel' })}</div>
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}Save changes
        </Button>
      </form>
    </Modal>
  );
}

function EditBankModal({
  userId,
  current,
  onClose,
  onDone,
}: {
  userId: string;
  current?: { accountHolder?: string | null; bankName?: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<BankDetailsPayload>({
    accountHolder: current?.accountHolder ?? '',
    bankName: current?.bankName ?? '',
    sortCode: '',
    accountNumber: '',
  });
  const mutation = useMutation({
    mutationFn: () => setEmployeeBank(userId, form),
    onSuccess: () => {
      toast('success', 'Bank details saved.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  const field = (key: keyof BankDetailsPayload, label: string, props: Record<string, unknown> = {}) => (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <Input className="mt-1" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </label>
  );
  return (
    <Modal title="Edit bank details" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {field('accountHolder', 'Account holder')}
        {field('bankName', 'Bank name')}
        <div className="grid grid-cols-2 gap-3">
          {field('sortCode', 'Sort code', { placeholder: '00-00-00', inputMode: 'numeric' })}
          {field('accountNumber', 'Account number', { placeholder: '8 digits', inputMode: 'numeric' })}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your full sort code and account number to update them. Existing values are hidden for security.
        </p>
        <Button type="submit" className="w-full" disabled={mutation.isPending || !form.sortCode?.trim() || !form.accountNumber?.trim()}>
          {mutation.isPending && <Loader2 className="animate-spin" />}Save bank details
        </Button>
      </form>
    </Modal>
  );
}

function LeavePanel({
  requests,
  entitlements,
  onRequest,
}: {
  requests: LeaveRequest[];
  entitlements: LeaveEntitlement[];
  onRequest: () => void;
}) {
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: cancelLeaveRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests-me'] });
      toast('success', 'Leave request cancelled.');
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Time off</h2>
          <p className="text-sm text-muted-foreground">Balances are calculated from your contracted work pattern.</p>
        </div>
        <Button onClick={onRequest}>
          <Plus />
          Request leave
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entitlements.map((item) => {
          const total = Number(item.totalDays);
          const used = Number(item.usedDays);
          return (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex justify-between">
                <p className="font-semibold">{item.leaveType.name}</p>
                <span className="text-xs text-muted-foreground">{item.year}</span>
              </div>
              <p className="text-3xl font-semibold mt-4">
                {total - used}
                <span className="text-sm font-normal text-muted-foreground"> days left</span>
              </p>
              <div className="h-2 bg-muted rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${total ? Math.min(100, (used / total) * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {used} used of {total}
              </p>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Request history</h3>
        </div>
        {requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No leave requests yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="p-4 md:px-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.leaveType.name}</p>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fmt(r.startDate)} – {fmt(r.endDate)} · {r.totalDays} days
                  </p>
                  {r.reviewNotes && <p className="text-xs text-muted-foreground mt-1">HR: {r.reviewNotes}</p>}
                </div>
                {r.status === 'pending' && (
                  <Button variant="ghost" size="sm" onClick={() => cancel.mutate(r.id)} disabled={cancel.isPending}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function monthBounds(offset: number) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { first, from: iso(first), to: iso(last), days: last.getDate(), blank: (first.getDay() + 6) % 7 };
}
const attendanceColor: Record<string, string> = {
  full: 'bg-success/15 text-success border-success/30',
  partial: 'bg-warning/15 text-warning-foreground border-warning/40',
  missed: 'bg-destructive/15 text-destructive border-destructive/30',
  no_shift: 'bg-muted text-muted-foreground border-border',
  scheduled: 'bg-primary/10 text-primary border-primary/25',
  leave: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
};
function AttendanceCalendar({ onCorrection }: { onCorrection: (date: string) => void }) {
  const [offset, setOffset] = useState(0);
  const range = monthBounds(offset);
  const { data = [], isLoading } = useQuery({
    queryKey: ['attendance-me', range.from, range.to],
    queryFn: () => getMyAttendance(range.from, range.to),
  });
  const byDate = useMemo(() => new Map(data.map((d) => [d.date, d])), [data]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Attendance</h2>
          <p className="text-sm text-muted-foreground">Full shift ≥90% of scheduled time. Select a day to request a correction.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft />
          </Button>
          <div className="w-36 text-center text-sm font-semibold">
            {range.first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setOffset(offset + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          ['full', 'Full shift'],
          ['partial', 'Partial'],
          ['missed', 'Missed'],
          ['leave', 'Approved leave'],
          ['no_shift', 'No shift'],
        ].map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <i className={cn('size-2.5 rounded-full border', attendanceColor[key])} />
            {label}
          </span>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-3 md:p-5">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase text-muted-foreground mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: range.blank }).map((_, i) => (
              <div key={`b${i}`} />
            ))}
            {Array.from({ length: range.days }, (_, i) => {
              const day = i + 1;
              const date = `${range.from.slice(0, 8)}${String(day).padStart(2, '0')}`;
              const entry = byDate.get(date) as AttendanceDay | undefined;
              return (
                <button
                  key={date}
                  onClick={() => entry && entry.status !== 'no_shift' && onCorrection(date)}
                  className={cn(
                    'min-h-16 md:min-h-24 rounded-xl border p-1.5 md:p-2 text-left transition-transform hover:-translate-y-0.5',
                    attendanceColor[entry?.status ?? 'no_shift'],
                  )}
                >
                  <span className="text-xs font-semibold">{day}</span>
                  {entry && entry.status !== 'no_shift' && (
                    <div className="mt-2 hidden md:block">
                      <p className="text-[10px] font-bold capitalize">{entry.status.replace('_', ' ')}</p>
                      {entry.plannedMinutes > 0 && (
                        <p className="text-[10px] opacity-80 mt-0.5">
                          {Math.round((entry.workedMinutes / 60) * 10) / 10}h / {Math.round((entry.plannedMinutes / 60) * 10) / 10}h
                        </p>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingPanel() {
  const { data: assignments = [], isLoading } = useQuery({ queryKey: ['training-assignments-me'], queryFn: getMyTrainingAssignments });
  const completed = assignments.filter((item) => item.status === 'completed').length;
  const overdue = assignments.filter((item) => item.status === 'overdue').length;
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Training & development</h2>
          <p className="text-sm text-muted-foreground">Required learning, renewals, and practical assessments.</p>
        </div>
        <Button asChild>
          <Link href="/training">
            <GraduationCap />
            Open training
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['Assigned', assignments.length],
          ['Completed', completed],
          ['Overdue', overdue],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-2">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <GraduationCap className="mx-auto mb-3" />
            <p className="font-medium text-foreground">No assigned training</p>
            <p className="text-sm mt-1">Optional courses are available in the training library.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {assignments.map((item) => (
              <Link
                key={item.id}
                href={`/training/${item.courseId}`}
                className="p-4 md:px-5 flex items-center justify-between gap-4 hover:bg-muted/50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.course.title}</p>
                    <Badge
                      variant={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'overdue'
                            ? 'destructive'
                            : item.status === 'in_progress'
                              ? 'primary'
                              : 'muted'
                      }
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.course.estimatedMinutes} min{item.dueAt ? ` · Due ${new Date(item.dueAt).toLocaleDateString('en-GB')}` : ''}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsPanel({ documents }: { documents: EmployeeDocument[] }) {
  const [expiryWarningCutoff] = useState(() => Date.now() + 60 * 86400000);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Documents & certificates</h2>
        <p className="text-sm text-muted-foreground">Employment records and expiry dates held by HR.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {documents.length ? (
          documents.map((d) => {
            const soon = d.expiresAt && new Date(d.expiresAt).getTime() < expiryWarningCutoff;
            return (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-5 flex gap-4">
                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileText size={19} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{d.title}</p>
                    {soon && <Badge variant="warning">Expiring</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{d.documentType}</p>
                  {d.expiresAt && <p className="text-xs text-muted-foreground mt-2">Expires {fmt(d.expiresAt)}</p>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3" />
            <p className="font-medium text-foreground">No documents recorded</p>
            <p className="text-sm mt-1">Documents added by HR will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaveRequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: types = [] } = useQuery({ queryKey: ['leave-types'], queryFn: getLeaveTypes });
  const [form, setForm] = useState<Parameters<typeof submitLeaveRequest>[0]>({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    partialDay: 'none',
    notes: '',
  });
  const mutation = useMutation({
    mutationFn: () => submitLeaveRequest(form),
    onSuccess: () => {
      toast('success', 'Leave request submitted.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  return (
    <Modal title="Request leave" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Select
          value={form.leaveTypeId}
          onValueChange={(v) => setForm({ ...form, leaveTypeId: v })}
          options={types.map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Choose leave type"
          ariaLabel="Leave type"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            From
            <Input type="date" className="mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            To
            <Input type="date" className="mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
        </div>
        <Select
          value={form.partialDay ?? 'none'}
          onValueChange={(v) => setForm({ ...form, partialDay: v as NonNullable<Parameters<typeof submitLeaveRequest>[0]['partialDay']> })}
          options={[
            { value: 'none', label: 'Full days' },
            { value: 'start', label: 'Half day on first day' },
            { value: 'end', label: 'Half day on last day' },
          ]}
          ariaLabel="Day length"
        />
        <textarea
          className="w-full min-h-24 rounded-lg border border-border bg-background p-3 text-sm"
          placeholder="Optional note"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <Button type="submit" className="w-full" disabled={!form.leaveTypeId || !form.startDate || !form.endDate || mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}Submit request
        </Button>
      </form>
    </Modal>
  );
}

function NewTicketModal({ onClose, onDone }: { onClose: () => void; onDone: (createdId?: string) => void }) {
  const correction = typeof window !== 'undefined' ? sessionStorage.getItem('attendance-correction-date') : null;
  const [form, setForm] = useState<{ subject: string; category: TicketCategory; priority: TicketPriority; message: string }>({
    subject: correction ? `Attendance correction — ${correction}` : '',
    category: correction ? 'scheduling' : 'hr',
    priority: 'normal',
    message: correction ? 'Please review my attendance record for this date. ' : '',
  });
  const mutation = useMutation({
    mutationFn: () => createTicket(form),
    onSuccess: (created) => {
      sessionStorage.removeItem('attendance-correction-date');
      toast('success', 'Request raised.');
      onDone(created?.id);
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  return (
    <Modal title={correction ? 'Request attendance correction' : 'New helpdesk ticket'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Short summary" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={form.category}
            onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}
            options={['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other'].map((v) => ({
              value: v,
              label: v[0].toUpperCase() + v.slice(1),
            }))}
            ariaLabel="Category"
          />
          <Select
            value={form.priority}
            onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
            options={['low', 'normal', 'high', 'urgent'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))}
            ariaLabel="Priority"
          />
        </div>
        <textarea
          className="w-full min-h-32 rounded-lg border border-border bg-background p-3 text-sm"
          placeholder="Describe what you need help with…"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        <Button type="submit" className="w-full" disabled={form.subject.length < 3 || !form.message.trim() || mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}Create ticket
        </Button>
      </form>
    </Modal>
  );
}
