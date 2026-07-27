'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  Minus,
  Receipt,
  ShieldCheck,
  Store,
  Target,
  Timer,
  TrendingUp,
  UserRound,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

import { AddressFields } from '@/components/people/AddressFields';
import {
  Avatar,
  EMPLOYMENT_CONFIG,
  EMPLOYMENT_TYPES,
  PAY_CONFIG,
  PAY_TYPES,
  ROLES,
  ROLE_CONFIG,
  SCOPES,
  canSeeMoney,
  fmtDate,
  fmtHours,
  fmtMoney,
  inp,
  lbl,
  sel,
  toDateInput,
} from '@/components/people/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { assignCourse, getCourses, getTrainingCompliance } from '@/lib/api/courses.service';
import {
  type BankDetailsPayload,
  type EmployeeHours,
  type TimesheetShift,
  getEmployee,
  getEmployeeBank,
  getEmployeeHours,
  getWorkPattern,
  offboardEmployee,
  setEmployeeBank,
  updateEmployee,
  updateWorkPattern,
} from '@/lib/api/hr.service';
import {
  type LeaveEntitlement,
  addEmployeeDocument,
  createEntitlement,
  createLeaveType,
  deleteEmployeeAbsence,
  deleteEmployeeDocument,
  getEmployeeAbsences,
  getEmployeeDocuments,
  getEmployeeEntitlements,
  getEmployeePayslips,
  getLeaveTypes,
  logEmployeeAbsence,
  updateEntitlement,
} from '@/lib/api/people-ops.service';
import {
  type StaffPerfWindow,
  type StaffPerfWindowKey,
  type StaffProfile,
  type StaffRole,
  type StaffScope,
  type UpdateStaffPayload,
  getStaffPerformance,
  updateStaff,
} from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { employeeSetupChecks, setupProgress } from '@/lib/utils/employee-compliance';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

// Current + previous month range presets for the hours view.
function monthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}

type RecordSection = 'overview' | 'time' | 'pay' | 'documents' | 'performance';

const RECORD_SECTIONS: { value: RecordSection; label: string; icon: typeof Clock; moneyOnly?: boolean }[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'time', label: 'Time & leave', icon: CalendarDays },
  { value: 'pay', label: 'Pay & statutory', icon: Banknote, moneyOnly: true },
  { value: 'documents', label: 'Documents & training', icon: FileText },
  { value: 'performance', label: 'Performance', icon: TrendingUp },
];

export function EmployeeRecordPage({
  userId,
  member,
  locations,
  onClose,
}: {
  userId: string;
  member: StaffProfile | null;
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const money = canSeeMoney(role);
  // Owned here (not the parent) so the confirm dialog sits with this record view.
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [section, setSection] = useState<RecordSection>('overview');

  const offboard = useMutation({
    mutationFn: () => offboardEmployee(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
      setOffboardOpen(false);
      toast('success', 'Employee offboarded.');
      // Stay on the record (now inactive) so it can be re-onboarded from here.
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to offboard.'),
  });

  // Re-activate a previously offboarded member — flips the staff record back to
  // active. Invalidating ['staff'] refreshes the `member` prop so the view (and
  // this button) reflects the active state without closing.
  const reactivate = useMutation({
    mutationFn: () => updateStaff(userId, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('success', 'Employee account reactivated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to re-onboard.'),
  });

  const { data: emp, isLoading, isError } = useQuery({ queryKey: ['hr-employee', userId], queryFn: () => getEmployee(userId) });
  const [monthOffset, setMonthOffset] = useState(0);
  const range = monthRange(monthOffset);
  const { data: hours } = useQuery({
    queryKey: ['employee-hours', userId, range.from, range.to],
    queryFn: () => getEmployeeHours(userId, range.from, range.to),
  });

  const name = member?.name ?? emp?.jobTitle ?? 'Employee';
  const estGross =
    emp?.payType === 'salaried' ? Number(emp.annualSalary ?? 0) / 12 : (hours?.totals.rawHours ?? 0) * Number(emp?.hourlyRate ?? 0);

  return (
    // In-page full-height panel (keeps the app sidebar + header visible). Negative
    // margins cancel the <main> padding so it fills the content area edge-to-edge.
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to staff" className="size-11 shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <Avatar name={name} email={member?.email} size="lg" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {member && (
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded',
                    ROLE_CONFIG[member.role].bg,
                    ROLE_CONFIG[member.role].text,
                  )}
                >
                  {ROLE_CONFIG[member.role].label}
                </span>
              )}
              {member && !member.isActive && <Badge variant="muted">Inactive</Badge>}
              {emp && <span className="text-xs text-muted-foreground">{emp.jobTitle}</span>}
            </div>
          </div>
        </div>
        {member && money && (
          <div className="flex items-center gap-2 shrink-0">
            {member.isActive ? (
              <Button variant="outline" onClick={() => setOffboardOpen(true)} className="h-10 text-destructive hover:text-destructive">
                Offboard
              </Button>
            ) : (
              <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="h-10 gap-2">
                {reactivate.isPending && <Loader2 size={15} className="animate-spin" />}
                Reactivate account
              </Button>
            )}
          </div>
        )}
      </div>

      <nav className="border-b border-border bg-card px-4 md:px-8 overflow-x-auto shrink-0" aria-label="Employee record sections">
        <div className="flex min-w-max">
          {RECORD_SECTIONS.filter((item) => !item.moneyOnly || money).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setSection(item.value)}
                className={cn(
                  'h-11 px-3 md:px-4 border-b-2 flex items-center gap-2 text-sm font-medium transition-colors',
                  section === item.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Body — everything on one page: stat tiles, a 2-per-row card grid, then the full-width timesheet. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-8xl mx-auto p-4 md:p-8 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : isError && !member ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <AlertTriangle className="mx-auto text-destructive" />
              <h2 className="mt-3 font-semibold">Employee record unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">It may have been removed, or you may not have access to it.</p>
              <Button variant="outline" className="mt-4" onClick={onClose}>
                Back to staff
              </Button>
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <>
                  {member && <ComplianceSummaryCard member={member} employee={emp ?? null} />}
                  {emp && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <Stat icon={Clock} label={`Clocked · ${range.label}`} value={fmtHours(hours?.totals.rawHours ?? 0)} />
                      {money && (
                        <Stat
                          icon={Banknote}
                          label={emp.payType === 'hourly' ? 'Clocked value' : 'Monthly salary'}
                          value={fmtMoney(estGross)}
                        />
                      )}
                      <Stat icon={UserRound} label="Employment" value={EMPLOYMENT_CONFIG[emp.employmentType].label} />
                      <Stat icon={ShieldCheck} label="Started" value={fmtDate(emp.startDate)} />
                    </div>
                  )}
                  <div className="grid lg:grid-cols-2 gap-4 items-start">
                    {member && <AccessCard member={member} locations={locations} canEdit={money} />}
                    {emp ? (
                      <>
                        <PersonalTab userId={userId} emp={emp} canEdit={money} email={member?.email} />
                        <EmploymentTab userId={userId} emp={emp} canEditPay={money} />
                      </>
                    ) : (
                      <div className="bg-card border border-dashed border-border rounded-2xl p-6">
                        <p className="font-medium">Account only</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          This login has no linked employment record. Do not schedule or pay this person until onboarding is completed.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {section === 'time' && emp && (
                <>
                  <div className="grid lg:grid-cols-2 gap-4 items-start">
                    <WorkPatternCard userId={userId} />
                    <LeaveAllowanceCard userId={userId} employmentType={emp.employmentType} />
                  </div>
                  <AbsenceCard userId={userId} />
                  <TimesheetCard hours={hours} monthOffset={monthOffset} onMonthChange={setMonthOffset} />
                </>
              )}

              {section === 'pay' && emp && money && (
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  <BankTab userId={userId} emp={emp} />
                  <PayslipsCard userId={userId} />
                </div>
              )}

              {section === 'documents' && member && (
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  {money && <EmployeeDocumentsCard userId={userId} />}
                  <EmployeeTrainingCard userId={userId} tenantId={member.tenantId} />
                </div>
              )}

              {section === 'performance' && member && <PerformanceCard userId={userId} />}
            </>
          )}
        </div>
      </div>

      {/* Portaled modal — centers on the viewport above the record view. */}
      {member && offboardOpen && (
        <ConfirmModal
          title="Confirm account offboarding"
          message={
            <div className="space-y-3">
              <p>
                Offboard <span className="font-semibold text-foreground">{member.name ?? member.email}</span>? Their HR history is retained
                and their account is marked inactive.
              </p>
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-left text-xs text-muted-foreground">
                Before confirming, record the last working day and reason in the employment documents, approve final time and expenses,
                calculate unused holiday, arrange final payroll/P45, recover assets, and confirm when access must end.
              </div>
            </div>
          }
          isPending={offboard.isPending}
          onConfirm={() => offboard.mutate()}
          onClose={() => setOffboardOpen(false)}
        />
      )}
    </div>
  );
}

function EmployeeTrainingCard({ userId, tenantId }: { userId: string; tenantId: string }) {
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [required, setRequired] = useState(true);
  const { data } = useQuery({ queryKey: ['training-compliance', tenantId], queryFn: () => getTrainingCompliance(tenantId) });
  const { data: courses = [] } = useQuery({ queryKey: ['courses', tenantId], queryFn: () => getCourses(tenantId), enabled: assignOpen });
  const rows = data?.rows.filter((row) => row.userId === userId) ?? [];
  const completed = rows.filter((row) => row.status === 'completed').length;
  const overdue = rows.filter((row) => row.status === 'overdue' || row.status === 'expired').length;
  const assign = useMutation({
    mutationFn: () =>
      assignCourse(courseId, { userIds: [userId], dueAt: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null, required }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-compliance'] });
      qc.invalidateQueries({ queryKey: ['training-assignments-me'] });
      setAssignOpen(false);
      setCourseId('');
      setDueDate('');
      setRequired(true);
      toast('success', 'Course assigned to employee.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const publishedCourses = courses.filter((course) => course.isPublished);
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Training compliance</p>
          <p className="text-xs text-muted-foreground mt-1">
            {completed} of {rows.length} assigned courses complete
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && <Badge variant="destructive">{overdue} attention needed</Badge>}
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            Assign course
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No training assigned.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.slice(0, 6).map((row) => (
            <div key={row.assignmentId} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{row.courseTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{row.dueAt ? `Due ${fmtDate(row.dueAt)}` : 'No due date'}</p>
              </div>
              <Badge
                variant={
                  row.status === 'completed'
                    ? 'success'
                    : row.status === 'overdue' || row.status === 'expired'
                      ? 'destructive'
                      : row.status === 'in_progress'
                        ? 'primary'
                        : 'muted'
                }
              >
                {row.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
        </div>
      )}
      {assignOpen && (
        <Modal title="Assign training course" onClose={() => setAssignOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              assign.mutate();
            }}
          >
            <div>
              <label className={lbl}>Course</label>
              <Select
                value={courseId}
                onValueChange={setCourseId}
                options={publishedCourses.map((course) => ({
                  value: course.id,
                  label: `${course.title} · ${course.estimatedMinutes} min`,
                }))}
                placeholder={publishedCourses.length ? 'Choose a course' : 'No published courses'}
                ariaLabel="Training course"
              />
            </div>
            <div>
              <label className={lbl}>Due date</label>
              <input type="date" className={inp} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <button
              type="button"
              onClick={() => setRequired(!required)}
              className={cn(
                'w-full rounded-xl border p-3 text-left flex gap-3',
                required ? 'border-primary/40 bg-primary/5' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0',
                  required ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                )}
              >
                {required && <CheckCircle2 size={13} />}
              </span>
              <span>
                <span className="block text-sm font-medium">Required training</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Include this course in compliance and overdue reporting.</span>
              </span>
            </button>
            <Button type="submit" className="w-full" disabled={!courseId || assign.isPending}>
              {assign.isPending && <Loader2 className="animate-spin" />}Assign to employee
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</dt>
      <dd className="text-foreground mt-0.5">{value || <span className="text-muted-foreground/60">—</span>}</dd>
    </div>
  );
}

function ComplianceSummaryCard({ member, employee }: { member: StaffProfile; employee: Employee | null }) {
  const [asOf] = useState(() => new Date());
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['employee-documents', member.userId],
    queryFn: () => getEmployeeDocuments(member.userId),
  });
  const checks = employeeSetupChecks(member, employee, documents, asOf);
  const progress = setupProgress(checks);
  const urgent = checks.filter((check) => check.tone === 'destructive').length;
  const outstanding = checks.filter((check) => !check.complete).length;

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={17} className="text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Employment readiness</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Operational checks only — pension assessment and HMRC starter declarations still need completing in payroll.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{isLoading ? '—' : `${progress}%`}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {urgent ? `${urgent} urgent` : outstanding ? `${outstanding} outstanding` : 'Core checks ready'}
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.id} className="p-4 border-b border-border md:border-r last:border-r-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{check.label}</p>
              <Badge variant={check.tone}>{check.complete ? 'Ready' : check.tone === 'destructive' ? 'Urgent' : 'Action'}</Badge>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AbsenceCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [initialDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
  const {
    data: absences = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['employee-absences', userId],
    queryFn: () => getEmployeeAbsences(userId),
  });
  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: getLeaveTypes,
    enabled: adding,
  });
  const add = useMutation({
    mutationFn: () =>
      logEmployeeAbsence({
        userId,
        date: form.date,
        leaveTypeId: form.leaveTypeId || undefined,
        isHalfDay: form.isHalfDay,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-absences', userId] });
      setAdding(false);
      setForm({ date: initialDate, leaveTypeId: '', isHalfDay: false, reason: '' });
      toast('success', 'Absence recorded.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeAbsence,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-absences', userId] });
      toast('success', 'Absence record removed.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <HeartPulse size={16} className="text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Sickness & unplanned absence</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Keep the absence history needed for payroll and return-to-work follow-up.</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Record absence
        </Button>
      </div>
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="p-6 text-sm text-muted-foreground">Absence records are unavailable for your current access level.</p>
      ) : absences.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No unplanned absences recorded.</p>
      ) : (
        <div className="divide-y divide-border">
          {absences.slice(0, 12).map((absence) => (
            <div key={absence.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{fmtDate(absence.date)}</p>
                  {absence.isHalfDay && <Badge variant="muted">Half day</Badge>}
                  {absence.leaveType && <Badge variant="primary">{absence.leaveType.name}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{absence.reason || 'No reason recorded'}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(absence.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
      {adding && (
        <Modal title="Record unplanned absence" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <div>
              <label className={lbl}>Date</label>
              <input type="date" className={inp} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </div>
            <div>
              <label className={lbl}>Leave category</label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(value) => setForm({ ...form, leaveTypeId: value })}
                options={leaveTypes.map((type) => ({ value: type.id, label: type.name }))}
                placeholder="Optional category"
                ariaLabel="Absence category"
              />
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isHalfDay: !form.isHalfDay })}
              className={cn(
                'w-full rounded-xl border p-3 text-left flex gap-3',
                form.isHalfDay ? 'border-primary/40 bg-primary/5' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-5 rounded-md border flex items-center justify-center',
                  form.isHalfDay ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                )}
              >
                {form.isHalfDay && <CheckCircle2 size={13} />}
              </span>
              <span>
                <span className="block text-sm font-medium">Half-day absence</span>
                <span className="block text-xs text-muted-foreground">Leave unticked for a full scheduled day.</span>
              </span>
            </button>
            <div>
              <label className={lbl}>Reason or payroll note</label>
              <textarea
                className={cn(inp, 'h-24 py-2 resize-none')}
                maxLength={500}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!form.date || add.isPending}>
              {add.isPending && <Loader2 className="animate-spin" />}Save absence
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function PayslipsCard({ userId }: { userId: string }) {
  const {
    data: payslips = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['employee-payslips', userId],
    queryFn: () => getEmployeePayslips(userId),
  });
  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Payslips</p>
        <p className="text-xs text-muted-foreground mt-1">Draft and finalised payroll documents for this employee.</p>
      </div>
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="p-6 text-sm text-muted-foreground">Payslips are restricted to payroll-authorised roles.</p>
      ) : payslips.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No payslips have been created.</p>
      ) : (
        <div className="divide-y divide-border">
          {payslips.slice(0, 8).map((payslip) => (
            <div key={payslip.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {fmtDate(payslip.payPeriodStart)} – {fmtDate(payslip.payPeriodEnd)}
                  </p>
                  <Badge variant={payslip.status === 'finalised' ? 'success' : 'warning'}>{payslip.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gross {fmtMoney(payslip.grossPay)} · Tax {fmtMoney(payslip.taxDeducted)} · NI {fmtMoney(payslip.nationalInsurance)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{fmtMoney(payslip.netPay)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net pay</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-5 py-3 border-t border-border bg-muted/30">
        <p className="text-[11px] text-muted-foreground">
          HMRC submissions, P45/P60 and pension assessment remain payroll-system responsibilities.
        </p>
      </div>
    </section>
  );
}

// ── Contracted work pattern ───────────────────────────────────────────────────

function WorkPatternCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['work-pattern', userId], queryFn: () => getWorkPattern(userId) });
  const [edit, setEdit] = useState(false);
  const [days, setDays] = useState<number[] | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const selectedDays = days ?? data?.workingDays ?? [1, 2, 3, 4, 5];
  const weeklyHours = hours ?? data?.contractedWeeklyHours ?? 40;
  const save = useMutation({
    mutationFn: () => updateWorkPattern(userId, { workingDays: selectedDays, contractedWeeklyHours: weeklyHours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-pattern', userId] });
      setEdit(false);
      toast('success', 'Work pattern updated.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contracted pattern</p>
          <p className="text-xs text-muted-foreground mt-1">Used for leave planning; actual time remains the payroll record.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEdit(!edit)}>
          {edit ? 'Cancel' : 'Edit'}
        </Button>
      </div>
      <div className="flex gap-1.5">
        {names.map((name, index) => {
          const value = index + 1;
          const active = selectedDays.includes(value);
          return (
            <button
              key={name}
              disabled={!edit}
              onClick={() => setDays(active ? selectedDays.filter((d) => d !== value) : [...selectedDays, value].sort())}
              className={cn(
                'flex-1 h-9 rounded-lg border text-xs font-semibold',
                active ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground',
                edit && 'hover:border-primary',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex items-end justify-between gap-4 mt-4">
        <div>
          <p className="text-xs text-muted-foreground">Contracted weekly hours</p>
          {edit ? (
            <input
              type="number"
              min="0"
              max="168"
              step="0.5"
              value={weeklyHours}
              onChange={(e) => setHours(Number(e.target.value))}
              className={cn(inp, 'mt-1 w-28')}
            />
          ) : (
            <p className="text-xl font-semibold mt-1">{weeklyHours}h</p>
          )}
        </div>
        {edit && (
          <Button onClick={() => save.mutate()} disabled={selectedDays.length === 0 || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save pattern'}
          </Button>
        )}
      </div>
      {weeklyHours > 48 && (
        <p className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          More than 48 contracted hours requires a working-time review. Keep any valid opt-out separately and continue to protect daily and
          weekly rest.
        </p>
      )}
    </div>
  );
}

function LeaveAllowanceCard({ userId, employmentType }: { userId: string; employmentType: Employee['employmentType'] }) {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState<LeaveEntitlement | 'new' | null>(null);
  const { data: workPattern } = useQuery({
    queryKey: ['work-pattern', userId],
    queryFn: () => getWorkPattern(userId),
  });
  const { data: entitlements = [], isLoading } = useQuery({
    queryKey: ['employee-entitlements', userId, year],
    queryFn: () => getEmployeeEntitlements(userId, year),
  });
  const regularHoursBaseline = Math.min(28, Math.round((workPattern?.workingDays.length ?? 5) * 5.6 * 10) / 10);
  const annualEntitlement = entitlements.find((item) => item.leaveType.name.toLowerCase().includes('annual'));
  const belowRegularBaseline =
    employmentType !== 'zero_hours' &&
    employmentType !== 'contractor' &&
    !!annualEntitlement &&
    Number(annualEntitlement.totalDays) < regularHoursBaseline;
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Annual leave allowance</p>
          <p className="text-xs text-muted-foreground mt-1">Assigned days, usage, and remaining balance.</p>
        </div>
        <div className="flex gap-2">
          <Select
            value={String(year)}
            onValueChange={(value) => setYear(Number(value))}
            options={[currentYear - 1, currentYear, currentYear + 1].map((value) => ({ value: String(value), label: String(value) }))}
            ariaLabel="Entitlement year"
            className="w-24"
          />
          <Button size="sm" onClick={() => setEditing('new')}>
            Add leave
          </Button>
        </div>
      </div>
      {employmentType === 'zero_hours' ? (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Irregular-hours holiday must accrue from hours worked in each pay period. A manually assigned day balance is not a complete
          statutory calculation.
        </div>
      ) : employmentType === 'contractor' ? (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Confirm the person&apos;s real employment status. Labelling someone a contractor does not remove worker holiday rights if the
          working relationship says otherwise.
        </div>
      ) : (
        <div
          className={cn(
            'mb-4 rounded-xl border p-3 text-xs text-muted-foreground',
            belowRegularBaseline ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30',
          )}
        >
          Regular-hours baseline from the current {workPattern?.workingDays.length ?? 5}-day pattern:{' '}
          <strong className="text-foreground">{regularHoursBaseline} days</strong> for a full leave year, subject to proration and
          contractual enhancements.
          {belowRegularBaseline && (
            <span className="block mt-1 text-destructive">The recorded annual allowance is below this baseline.</span>
          )}
        </div>
      )}
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : entitlements.length === 0 ? (
        <div className="py-7 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium">No allowance for {year}</p>
          <p className="text-xs text-muted-foreground mt-1">Add annual leave so the employee can submit requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entitlements.map((item) => {
            const total = Number(item.totalDays);
            const used = Number(item.usedDays);
            const remaining = total - used;
            return (
              <button
                key={item.id}
                onClick={() => setEditing(item)}
                className="w-full text-left rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.leaveType.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {used} used · {remaining} remaining
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums">{total}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">days</p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${total > 0 ? Math.min(100, (used / total) * 100) : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
      {editing && (
        <LeaveAllowanceModal
          userId={userId}
          year={year}
          entitlement={editing === 'new' ? null : editing}
          existing={entitlements}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['employee-entitlements', userId] });
          }}
        />
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">
        Keep the entitlement, leave taken and holiday-pay calculation history. From 6 April 2026, detailed annual-leave and holiday-pay
        records must be retained for at least six years.
      </p>
    </div>
  );
}

function LeaveAllowanceModal({
  userId,
  year,
  entitlement,
  existing,
  onClose,
  onDone,
}: {
  userId: string;
  year: number;
  entitlement: LeaveEntitlement | null;
  existing: LeaveEntitlement[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: leaveTypes = [] } = useQuery({ queryKey: ['leave-types'], queryFn: getLeaveTypes });
  const annualType = leaveTypes.find((type) => type.name.toLowerCase().includes('annual'));
  const [leaveTypeId, setLeaveTypeId] = useState(entitlement?.leaveType.id ?? annualType?.id ?? 'annual-default');
  const [totalDays, setTotalDays] = useState(entitlement?.totalDays ?? annualType?.defaultAllowanceDays ?? '28');
  const save = useMutation({
    mutationFn: async () => {
      if (entitlement) return updateEntitlement(entitlement.id, { totalDays: Number(totalDays).toFixed(1) });
      let targetTypeId = leaveTypeId;
      if (targetTypeId === 'annual-default') {
        if (annualType) {
          targetTypeId = annualType.id;
        } else {
          const created = await createLeaveType({
            name: 'Annual Leave',
            isPaid: true,
            requiresApproval: true,
            defaultAllowanceDays: Number(totalDays).toFixed(1),
          });
          targetTypeId = created.id;
        }
      }
      const duplicate = existing.find((item) => item.leaveType.id === targetTypeId);
      if (duplicate) return updateEntitlement(duplicate.id, { totalDays: Number(totalDays).toFixed(1) });
      return createEntitlement({ userId, leaveTypeId: targetTypeId, year, totalDays: Number(totalDays).toFixed(1) });
    },
    onSuccess: () => {
      toast('success', entitlement ? 'Leave allowance updated.' : 'Leave allowance added.');
      onDone();
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const options = [
    { value: 'annual-default', label: annualType?.name ?? 'Annual Leave' },
    ...leaveTypes.filter((type) => type.id !== annualType?.id).map((type) => ({ value: type.id, label: type.name })),
  ];
  return (
    <Modal title={entitlement ? 'Edit leave allowance' : `Add leave allowance · ${year}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {!entitlement && (
          <div>
            <label className={lbl}>Leave type</label>
            <Select
              value={leaveTypeId}
              onValueChange={(value) => {
                setLeaveTypeId(value);
                const type = leaveTypes.find((item) => item.id === value);
                if (type?.defaultAllowanceDays) setTotalDays(type.defaultAllowanceDays);
              }}
              options={options}
              ariaLabel="Leave type"
            />
          </div>
        )}
        <div>
          <label className={lbl}>Total allowance (days)</label>
          <input
            type="number"
            min={entitlement ? Number(entitlement.usedDays) : 0.5}
            max="366"
            step="0.5"
            className={inp}
            value={totalDays}
            onChange={(event) => setTotalDays(event.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Half days are supported. An allowance cannot be lower than days already used.
          </p>
        </div>
        {entitlement && (
          <div className="rounded-xl bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Already used:</span> <strong>{entitlement.usedDays} days</strong>
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={
            !totalDays ||
            Number(totalDays) <= 0 ||
            (entitlement ? Number(totalDays) < Number(entitlement.usedDays) : false) ||
            save.isPending
          }
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          {entitlement ? 'Save allowance' : 'Add allowance'}
        </Button>
      </form>
    </Modal>
  );
}

function EmployeeDocumentsCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [asOf] = useState(() => new Date());
  const [form, setForm] = useState({
    title: '',
    documentType: 'Right to work',
    reference: '',
    issuedAt: '',
    expiresAt: '',
    notes: '',
  });
  const { data: documents = [] } = useQuery({ queryKey: ['employee-documents', userId], queryFn: () => getEmployeeDocuments(userId) });
  const add = useMutation({
    mutationFn: () => addEmployeeDocument({ userId, ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-documents', userId] });
      setAdding(false);
      setForm({ title: '', documentType: 'Right to work', reference: '', issuedAt: '', expiresAt: '', notes: '' });
      toast('success', 'Document record added.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  const remove = useMutation({
    mutationFn: deleteEmployeeDocument,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-documents', userId] }),
  });
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Documents & certificates</p>
          <p className="text-xs text-muted-foreground mt-1">Record evidence, check dates and renewal deadlines.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          Add
        </Button>
      </div>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No document records yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {documents.map((document) => {
            const expiry = document.expiresAt ? new Date(document.expiresAt).getTime() : null;
            const expired = expiry !== null && expiry < asOf.getTime();
            const expiring = expiry !== null && !expired && expiry < asOf.getTime() + 60 * 86_400_000;
            return (
              <div key={document.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{document.title}</p>
                    {expired && <Badge variant="destructive">Expired</Badge>}
                    {expiring && <Badge variant="warning">Due soon</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {document.documentType}
                    {document.issuedAt ? ` · checked ${fmtDate(document.issuedAt)}` : ''}
                    {document.expiresAt ? ` · expires ${fmtDate(document.expiresAt)}` : ''}
                  </p>
                  {document.reference && <p className="text-xs text-muted-foreground mt-0.5 truncate">{document.reference}</p>}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove.mutate(document.id)}>
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {adding && (
        <Modal title="Add compliance record" onClose={() => setAdding(false)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate();
            }}
          >
            <div>
              <label className={lbl}>Title</label>
              <input
                className={inp}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="e.g. Online right-to-work check"
              />
            </div>
            <div>
              <label className={lbl}>Type</label>
              <Select
                value={form.documentType}
                onValueChange={(value) => setForm({ ...form, documentType: value })}
                options={[
                  'Right to work',
                  'Employment contract',
                  'Starter declaration / P45',
                  'Pension notice',
                  'Fit note',
                  'Food safety',
                  'Training certificate',
                  'Policy acknowledgement',
                  'Other',
                ].map((value) => ({ value, label: value }))}
                ariaLabel="Document type"
              />
            </div>
            <div>
              <label className={lbl}>Check method or reference</label>
              <input
                className={inp}
                value={form.reference}
                onChange={(event) => setForm({ ...form, reference: event.target.value })}
                placeholder="Online service, IDVT, manual or document reference"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Checked / issued</label>
                <input
                  type="date"
                  className={inp}
                  value={form.issuedAt}
                  onChange={(event) => setForm({ ...form, issuedAt: event.target.value })}
                />
              </div>
              <div>
                <label className={lbl}>Follow-up / expiry</label>
                <input
                  type="date"
                  className={inp}
                  value={form.expiresAt}
                  onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <textarea
                className={cn(inp, 'h-20 py-2 resize-none')}
                value={form.notes}
                maxLength={1000}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
            {form.documentType === 'Right to work' && (
              <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                A record here does not itself establish a statutory excuse. Retain the prescribed evidence, record the actual check date,
                and complete follow-up checks where permission is time-limited.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={form.title.length < 2 || add.isPending}>
              {add.isPending ? 'Adding…' : 'Add record'}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Employment & Pay (inline edit) ────────────────────────────────────────────

function EmploymentTab({ userId, emp, canEditPay }: { userId: string; emp: Employee; canEditPay: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    jobTitle: emp.jobTitle,
    department: emp.department ?? '',
    employmentType: emp.employmentType,
    startDate: toDateInput(emp.startDate),
    payType: emp.payType ?? 'hourly',
    hourlyRate: emp.hourlyRate ?? '',
    annualSalary: emp.annualSalary ?? '',
    unpaidBreakMins: emp.unpaidBreakMins ?? 0,
    breakThresholdMins: emp.breakThresholdMins ?? 360,
    taxCode: emp.taxCode ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      updateEmployee(userId, {
        jobTitle: f.jobTitle,
        department: f.department || undefined,
        employmentType: f.employmentType,
        startDate: f.startDate,
        ...(canEditPay
          ? {
              payType: f.payType,
              hourlyRate: f.payType === 'hourly' ? Number(f.hourlyRate) || 0 : null,
              annualSalary: f.payType === 'salaried' ? Number(f.annualSalary) || 0 : null,
              unpaidBreakMins: Number(f.unpaidBreakMins),
              breakThresholdMins: Number(f.breakThresholdMins),
              taxCode: f.taxCode || null,
            }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employee', userId] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      setEdit(false);
      toast('success', 'Employment details updated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to update.'),
  });

  if (!edit) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employment & Pay</p>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <Info label="Job title" value={emp.jobTitle} />
          <Info label="Department" value={emp.department} />
          <div>
            <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employment type</dt>
            <dd className="mt-1">
              <Badge variant={EMPLOYMENT_CONFIG[emp.employmentType].variant}>{EMPLOYMENT_CONFIG[emp.employmentType].label}</Badge>
            </dd>
          </div>
          <Info label="Start date" value={fmtDate(emp.startDate)} />
          {canEditPay && emp.payType && (
            <>
              <div>
                <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pay</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Badge variant={PAY_CONFIG[emp.payType].variant}>{PAY_CONFIG[emp.payType].label}</Badge>
                  <span className="text-foreground">
                    {emp.payType === 'hourly' ? `${fmtMoney(emp.hourlyRate)}/hr` : `${fmtMoney(emp.annualSalary)}/yr`}
                  </span>
                </dd>
              </div>
              <Info label="Tax code" value={emp.taxCode} />
              <Info label="Contract break rule" value={`${emp.unpaidBreakMins ?? 0} min after ${emp.breakThresholdMins ?? 0} min`} />
            </>
          )}
        </dl>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Job title</label>
          <input className={inp} value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Department</label>
          <input className={inp} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
        </div>
        <div>
          <label className={lbl}>Employment type</label>
          <Select
            className={sel}
            value={f.employmentType}
            onValueChange={(value) => setF({ ...f, employmentType: value as typeof f.employmentType })}
            options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_CONFIG[type].label }))}
            ariaLabel="Employment type"
          />
        </div>
        <div>
          <label className={lbl}>Start date</label>
          <input type="date" className={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        </div>
      </div>
      {canEditPay && (
        <>
          <div className="flex gap-1.5">
            {PAY_TYPES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setF({ ...f, payType: p })}
                className={cn(
                  'flex-1 h-10 rounded-lg border text-sm font-medium transition-colors',
                  f.payType === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {PAY_CONFIG[p].label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {f.payType === 'hourly' ? (
              <div>
                <label className={lbl}>Hourly rate (£)</label>
                <input
                  className={inp}
                  inputMode="decimal"
                  value={f.hourlyRate}
                  onChange={(e) => setF({ ...f, hourlyRate: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <label className={lbl}>Annual salary (£)</label>
                <input
                  className={inp}
                  inputMode="decimal"
                  value={f.annualSalary}
                  onChange={(e) => setF({ ...f, annualSalary: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className={lbl}>Contract break (mins)</label>
              <input
                className={inp}
                inputMode="numeric"
                value={f.unpaidBreakMins}
                onChange={(e) => setF({ ...f, unpaidBreakMins: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={lbl}>Break after (mins)</label>
              <input
                className={inp}
                inputMode="numeric"
                value={f.breakThresholdMins}
                onChange={(e) => setF({ ...f, breakThresholdMins: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="sm:w-1/3">
            <label className={lbl}>Tax code</label>
            <input className={inp} value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value.toUpperCase() })} />
          </div>
          <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
            This is the contractual break rule, not proof a break was taken. Payroll must not deduct a break that the worker did not
            actually receive.
          </p>
        </>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">
          Cancel
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// Employee shape returned by getEmployee — used by tab component props.
type Employee = Awaited<ReturnType<typeof getEmployee>>;

// ── Access & Role (staff profile: role, scope, locations, status) ─────────────

function AccessCard({ member, locations, canEdit }: { member: StaffProfile; locations: { id: string; name: string }[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [role, setRole] = useState<StaffRole>(member.role);
  const [scope, setScope] = useState<StaffScope>(member.scope);
  const [isActive, setIsActive] = useState(member.isActive);
  const [locs, setLocs] = useState<string[]>(member.locationIds ?? []);
  const toggleLoc = (id: string) => setLocs((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));

  const save = useMutation({
    mutationFn: () => {
      const payload: UpdateStaffPayload = { role, scope, isActive };
      if (scope === 'location') payload.locationIds = locs;
      return updateStaff(member.userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      setEdit(false);
      toast('success', 'Access updated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to update access.'),
  });

  const locNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name ?? id);

  if (edit) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access & Role</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Role</label>
            <Select
              className={sel}
              value={role}
              onValueChange={(value) => setRole(value as StaffRole)}
              options={ROLES.map((nextRole) => ({ value: nextRole, label: ROLE_CONFIG[nextRole].label }))}
              ariaLabel="Role"
            />
          </div>
          <div>
            <label className={lbl}>Scope</label>
            <Select
              className={sel}
              value={scope}
              onValueChange={(value) => setScope(value as StaffScope)}
              options={SCOPES.map((nextScope) => ({ value: nextScope, label: nextScope[0].toUpperCase() + nextScope.slice(1) }))}
              ariaLabel="Scope"
            />
          </div>
        </div>
        {scope === 'location' && locations.length > 0 && (
          <div>
            <label className={lbl}>Assigned locations</label>
            <div className="flex flex-wrap gap-1.5">
              {locations.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLoc(l.id)}
                  className={cn(
                    'px-3 h-9 rounded-lg border text-xs font-medium transition-colors',
                    locs.includes(l.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">Account active (can sign in)</span>
        </label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access & Role</p>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            Edit
          </Button>
        )}
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</dt>
          <dd className="mt-1">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide',
                ROLE_CONFIG[member.role].bg,
                ROLE_CONFIG[member.role].text,
              )}
            >
              {ROLE_CONFIG[member.role].label}
            </span>
          </dd>
        </div>
        <Info label="Scope" value={member.scope[0].toUpperCase() + member.scope.slice(1)} />
        <Info
          label="Locations"
          value={member.scope === 'location' ? (locNames.length ? locNames.join(', ') : 'None assigned') : 'All in workspace'}
        />
        <div>
          <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account</dt>
          <dd className="mt-1">
            <Badge variant={member.isActive ? 'success' : 'muted'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Personal (view + inline edit for HR/owner) ────────────────────────────────

function PersonalTab({ userId, emp, canEdit, email }: { userId: string; emp: Employee; canEdit: boolean; email?: string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    dateOfBirth: toDateInput(emp.dateOfBirth),
    address: emp.address ?? '',
    emergencyContactName: emp.emergencyContactName ?? '',
    emergencyContactPhone: emp.emergencyContactPhone ?? '',
    emergencyContactRelation: emp.emergencyContactRelation ?? '',
  });

  const save = useMutation({
    mutationFn: () =>
      updateEmployee(userId, {
        dateOfBirth: f.dateOfBirth || null,
        address: f.address || null,
        emergencyContactName: f.emergencyContactName || null,
        emergencyContactPhone: f.emergencyContactPhone || null,
        emergencyContactRelation: f.emergencyContactRelation || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employee', userId] });
      setEdit(false);
      toast('success', 'Personal details updated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to update.'),
  });

  if (edit) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Personal details</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Date of birth</label>
            <input type="date" className={inp} value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={lbl}>Home address</label>
          <AddressFields value={f.address} onChange={(v) => setF({ ...f, address: v })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Emergency name</label>
            <input className={inp} value={f.emergencyContactName} onChange={(e) => setF({ ...f, emergencyContactName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Emergency phone</label>
            <input
              className={inp}
              value={f.emergencyContactPhone}
              onChange={(e) => setF({ ...f, emergencyContactPhone: e.target.value })}
            />
          </div>
          <div>
            <label className={lbl}>Relationship</label>
            <input
              className={inp}
              value={f.emergencyContactRelation}
              onChange={(e) => setF({ ...f, emergencyContactRelation: e.target.value })}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Personal details</p>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            Edit
          </Button>
        )}
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <Info label="Email" value={email} />
        <Info label="Date of birth" value={emp.dateOfBirth ? fmtDate(emp.dateOfBirth) : undefined} />
        <Info label="Address" value={emp.address} />
        <Info label="Emergency contact" value={emp.emergencyContactName} />
        <Info label="Emergency phone" value={emp.emergencyContactPhone} />
        <Info label="Relationship" value={emp.emergencyContactRelation} />
      </dl>
      {!canEdit && <p className="text-[11px] text-muted-foreground mt-4">Employees can also edit these from their own profile.</p>}
    </div>
  );
}

// ── Bank & Statutory (money roles only) ───────────────────────────────────────

function BankTab({ userId, emp }: { userId: string; emp: Employee }) {
  const qc = useQueryClient();
  const [reveal, setReveal] = useState(false);
  const { data: bank } = useQuery({ queryKey: ['employee-bank', userId, reveal], queryFn: () => getEmployeeBank(userId, reveal) });
  const { data: revealedEmp } = useQuery({
    queryKey: ['hr-employee', userId, 'reveal'],
    queryFn: () => getEmployee(userId, true),
    enabled: reveal,
  });
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<BankDetailsPayload & { niNumber: string; taxCode: string }>({
    accountHolder: '',
    bankName: '',
    sortCode: '',
    accountNumber: '',
    niNumber: '',
    taxCode: emp.taxCode ?? '',
  });

  const save = useMutation({
    mutationFn: async () => {
      await setEmployeeBank(userId, {
        accountHolder: f.accountHolder || null,
        bankName: f.bankName || null,
        ...(f.sortCode ? { sortCode: f.sortCode } : {}),
        ...(f.accountNumber ? { accountNumber: f.accountNumber } : {}),
      });
      if (f.niNumber || f.taxCode) await updateEmployee(userId, { niNumber: f.niNumber || undefined, taxCode: f.taxCode || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-bank', userId] });
      qc.invalidateQueries({ queryKey: ['hr-employee', userId] });
      setEdit(false);
      toast('success', 'Bank & statutory details saved.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to save.'),
  });

  const niDisplay = reveal ? revealedEmp?.niNumber : emp.niNumber;

  if (edit) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bank & statutory</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Account holder</label>
            <input className={inp} value={f.accountHolder ?? ''} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Bank name</label>
            <input className={inp} value={f.bankName ?? ''} onChange={(e) => setF({ ...f, bankName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Sort code</label>
            <input
              className={inp}
              value={f.sortCode ?? ''}
              onChange={(e) => setF({ ...f, sortCode: e.target.value })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>Account number</label>
            <input
              className={inp}
              value={f.accountNumber ?? ''}
              onChange={(e) => setF({ ...f, accountNumber: e.target.value })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>National Insurance no.</label>
            <input
              className={inp}
              value={f.niNumber}
              onChange={(e) => setF({ ...f, niNumber: e.target.value.toUpperCase() })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>Tax code</label>
            <input className={inp} value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bank & statutory</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReveal((v) => !v)} className="gap-1.5">
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            {reveal ? 'Hide' : 'Reveal'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setF((current) => ({
                ...current,
                accountHolder: bank?.accountHolder ?? '',
                bankName: bank?.bankName ?? '',
                taxCode: emp.taxCode ?? '',
              }));
              setEdit(true);
            }}
          >
            Edit
          </Button>
        </div>
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <Info label="Account holder" value={bank?.accountHolder} />
        <Info label="Bank" value={bank?.bankName} />
        <Info label="Sort code" value={bank?.sortCode} />
        <Info label="Account number" value={bank?.accountNumber} />
        <Info label="National Insurance" value={niDisplay} />
        <Info label="Tax code" value={emp.taxCode} />
      </dl>
      <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
        <ShieldCheck size={13} /> Sort code, account number and NI number are encrypted at rest and visible to HR/owners only.
      </p>
    </div>
  );
}

// ── Hours & Timesheet (one row per day, detail modal per day) ─────────────────

interface DayGroup {
  key: string; // YYYY-MM-DD
  date: Date;
  segments: TimesheetShift[];
  rawHours: number;
  paidHours: number;
  overtimeHours: number;
  locations: string[];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—');

function groupByDay(shifts: TimesheetShift[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const s of shifts) {
    const key = dayKey(s.clockedIn);
    const g =
      map.get(key) ??
      ({ key, date: new Date(s.clockedIn), segments: [], rawHours: 0, paidHours: 0, overtimeHours: 0, locations: [] } as DayGroup);
    g.segments.push(s);
    g.rawHours += s.rawHours;
    g.paidHours += s.paidHours;
    g.overtimeHours += s.overtimeHours;
    if (s.locationName && !g.locations.includes(s.locationName)) g.locations.push(s.locationName);
    map.set(key, g);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...map.values()]
    .map((g) => ({ ...g, rawHours: round(g.rawHours), paidHours: round(g.paidHours), overtimeHours: round(g.overtimeHours) }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

const TH = 'px-3 md:px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest';
const TD = 'px-3 md:px-5 py-3.5';

function TimesheetCard({
  hours,
  monthOffset,
  onMonthChange,
}: {
  hours: EmployeeHours | undefined;
  monthOffset: number;
  onMonthChange: (v: number) => void;
}) {
  const [openDay, setOpenDay] = useState<DayGroup | null>(null);
  const days = groupByDay(hours?.shifts ?? []);
  const t = hours?.totals;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-border flex-wrap">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hours &amp; Timesheet</p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground tabular-nums">
            {fmtHours(t?.paidHours ?? 0)} marked payable
            {(t?.overtimeHours ?? 0) > 0 && <span className="text-warning"> · {fmtHours(t!.overtimeHours)} to review</span>} ·{' '}
            {fmtHours(t?.rawHours ?? 0)} clocked
          </span>
          <SegmentedControl
            options={[
              { value: '0', label: monthRange(0).label },
              { value: '1', label: monthRange(1).label },
              { value: '2', label: monthRange(2).label },
            ]}
            value={String(monthOffset)}
            onChange={(v) => onMonthChange(Number(v))}
          />
        </div>
      </div>

      {(t?.overtimeHours ?? 0) > 0 && (
        <div className="px-5 py-3 border-b border-warning/30 bg-warning/5 flex gap-2 text-xs text-muted-foreground">
          <AlertTriangle size={15} className="text-warning shrink-0" aria-hidden="true" />
          <p>
            Clocked time exceeds the current payable-hours calculation. Review every exception before payroll; unscheduled or additional
            work is not automatically unpaid.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={cn(TH, 'text-left')}>Date</th>
              <th className={cn(TH, 'text-left')}>Location</th>
              <th className={cn(TH, 'text-left hidden sm:table-cell')}>Shifts</th>
              <th className={cn(TH, 'text-right')}>Clocked</th>
              <th className={cn(TH, 'text-right')}>Exception</th>
              <th className={cn(TH, 'text-right')}>Payable</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No shifts in this period.
                </td>
              </tr>
            ) : (
              days.map((d) => (
                <tr
                  key={d.key}
                  onClick={() => setOpenDay(d)}
                  className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                >
                  <td className={cn(TD, 'font-medium text-foreground whitespace-nowrap')}>{fmtDay(d.date)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>
                    {d.locations.length === 0 ? '—' : d.locations.length === 1 ? d.locations[0] : `${d.locations.length} locations`}
                  </td>
                  <td className={cn(TD, 'text-muted-foreground tabular-nums hidden sm:table-cell')}>{d.segments.length}</td>
                  <td className={cn(TD, 'text-right tabular-nums text-muted-foreground')}>{fmtHours(d.rawHours)}</td>
                  <td className={cn(TD, 'text-right tabular-nums')}>
                    {d.overtimeHours > 0 ? (
                      <Badge variant="warning">+{fmtHours(d.overtimeHours)}</Badge>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className={cn(TD, 'text-right tabular-nums font-semibold text-foreground')}>{fmtHours(d.paidHours)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openDay && (
        <Modal title={fmtDay(openDay.date)} onClose={() => setOpenDay(null)} className="max-w-xl">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="muted">{fmtHours(openDay.rawHours)} clocked</Badge>
              {openDay.overtimeHours > 0 && <Badge variant="warning">{fmtHours(openDay.overtimeHours)} needs review</Badge>}
              <Badge variant="success">{fmtHours(openDay.paidHours)} marked payable</Badge>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <th className="px-3 py-2 text-left">Clocked</th>
                    <th className="px-3 py-2 text-left">Scheduled</th>
                    <th className="px-3 py-2 text-right">Clocked</th>
                    <th className="px-3 py-2 text-right">Review</th>
                    <th className="px-3 py-2 text-right">Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {openDay.segments.map((s) => (
                    <tr key={s.id} className="border-t border-border/50">
                      <td className="px-3 py-2 text-foreground tabular-nums whitespace-nowrap">
                        {fmtTime(s.clockedIn)} – {s.clockedOut ? fmtTime(s.clockedOut) : <span className="text-warning">open</span>}
                        {s.locationName && <span className="block text-[11px] text-muted-foreground">{s.locationName}</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">
                        {s.scheduled ? `${fmtTime(s.scheduled.startsAt)} – ${fmtTime(s.scheduled.endsAt)}` : 'Unscheduled'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtHours(s.rawHours)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.overtimeHours > 0 ? <span className="text-warning">+{fmtHours(s.overtimeHours)}</span> : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{fmtHours(s.paidHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The rota is evidence of planned work, not a legal cap on pay. Confirm actual working time, breaks and authorised corrections
              before payroll, including unscheduled work the business required or permitted.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Performance (sales & throughput, per time window) ─────────────────────────

const PERF_WINDOWS: { value: StaffPerfWindowKey; label: string }[] = [
  { value: 'last7Days', label: '7 days' },
  { value: 'last30Days', label: '30 days' },
  { value: 'allTime', label: 'All time' },
];

const fmtMins = (measured: number, mins: number) =>
  measured === 0 ? '—' : mins < 1 ? `${Math.round(mins * 60)}s` : `${Math.round(mins * 10) / 10} min`;
const fmtPct = (value: number) => `${Math.round(value * 10) / 10}%`;
const divide = (value: number, denominator: number) => (denominator > 0 ? value / denominator : 0);
const relativeDelta = (value: number, baseline: number) => (baseline > 0 ? ((value - baseline) / baseline) * 100 : null);
const windowSpanDays = (window: StaffPerfWindow) => {
  if (window.windowDays) return window.windowDays;
  if (!window.firstOrderAt || !window.lastOrderAt) return Math.max(window.activeDays, 1);
  return Math.max(1, Math.ceil((new Date(window.lastOrderAt).getTime() - new Date(window.firstOrderAt).getTime()) / 86_400_000) + 1);
};
const performanceMetrics = (window: StaffPerfWindow) => {
  const spanDays = windowSpanDays(window);
  const revenue = Number(window.totalRevenue);
  return {
    spanDays,
    revenue,
    completionRate: divide(window.completedOrders, window.totalOrders) * 100,
    cancellationRate: window.cancellationRate * 100,
    revenuePerOrder: Number(window.avgOrderValue),
    ordersPerActiveDay: window.avgOrdersPerActiveDay,
    ordersPerCalendarDay: window.avgOrdersPerCalendarDay ?? divide(window.totalOrders, spanDays),
    revenuePerActiveDay: divide(revenue, window.activeDays),
    revenuePerCalendarDay: divide(revenue, spanDays),
    activityCoverage: divide(window.activeDays, spanDays) * 100,
    prepCoverage: divide(window.prepTime.measuredOrders, window.completedOrders) * 100,
    posShare: divide(window.bySource.pos, window.totalOrders) * 100,
    mobileShare: divide(window.bySource.mobile, window.totalOrders) * 100,
  };
};

function DeltaBadge({ value, baseline, lowerIsBetter = false }: { value: number; baseline: number; lowerIsBetter?: boolean }) {
  const delta = relativeDelta(value, baseline);
  if (delta === null || Math.abs(delta) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <Minus size={11} /> Flat
      </span>
    );
  }
  const up = delta > 0;
  const positive = lowerIsBetter ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold', positive ? 'text-success' : 'text-warning')}>
      <Icon size={11} />
      {Math.abs(Math.round(delta))}%
    </span>
  );
}

function PerfTile({
  icon: Icon,
  label,
  value,
  hint,
  compare,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint?: string;
  compare?: { value: number; baseline: number; lowerIsBetter?: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3.5">
      <div className="flex items-center justify-between gap-2 text-muted-foreground mb-2">
        <div className="flex items-center gap-1.5">
          <Icon size={13} aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
        </div>
        {compare && <DeltaBadge {...compare} />}
      </div>
      <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}

function BreakdownBar({ rows }: { rows: { label: string; value: number; total: number; colour: string }[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const share = divide(row.value, row.total) * 100;
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">
                {row.value} <span className="text-xs font-normal text-muted-foreground">· {fmtPct(share)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', row.colour)} style={{ width: `${Math.min(100, share)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComparisonMetric({
  label,
  value,
  baseline,
  format,
  lowerIsBetter,
}: {
  label: string;
  value: number;
  baseline: number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-lg font-bold tabular-nums">{format(value)}</p>
        <DeltaBadge value={value} baseline={baseline} lowerIsBetter={lowerIsBetter} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Baseline {format(baseline)}</p>
    </div>
  );
}

function Insight({ tone, children }: { tone: 'good' | 'watch' | 'neutral'; children: React.ReactNode }) {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'watch' ? AlertTriangle : Target;
  return (
    <div className="flex gap-2.5 rounded-xl border border-border bg-background p-3">
      <Icon
        size={15}
        className={cn('mt-0.5 shrink-0', tone === 'good' ? 'text-success' : tone === 'watch' ? 'text-warning' : 'text-primary')}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function PerformanceCard({ userId }: { userId: string }) {
  const [win, setWin] = useState<StaffPerfWindowKey>('last30Days');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff-performance', userId],
    queryFn: () => getStaffPerformance(userId),
  });
  const w = data?.windows[win];

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-background animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !w || !data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <TrendingUp size={22} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden="true" />
        <p className="font-medium">Couldn&apos;t load performance stats</p>
        <p className="text-sm text-muted-foreground mt-1">Refresh the page or try again shortly.</p>
      </div>
    );
  }

  const metrics = performanceMetrics(w);
  const baselineKey: StaffPerfWindowKey = win === 'last7Days' ? 'last30Days' : 'allTime';
  const displayedBaseline = performanceMetrics(data.windows[baselineKey]);
  const comparisonWindow = win === 'allTime' ? data.windows.last30Days : w;
  const comparisonBase = win === 'allTime' ? w : data.windows[baselineKey];
  const compared = performanceMetrics(comparisonWindow);
  const comparison = performanceMetrics(comparisonBase);
  const comparisonLabel =
    win === 'last7Days'
      ? '7-day pace vs 30-day baseline'
      : win === 'last30Days'
        ? '30-day pace vs career baseline'
        : 'Recent 30-day pace vs career baseline';
  const otherOrders = Math.max(0, w.totalOrders - w.completedOrders - w.cancelledOrders);
  const otherSources = Math.max(0, w.totalOrders - w.bySource.pos - w.bySource.mobile);
  const comparisonPrepAvailable = comparisonWindow.prepTime.measuredOrders > 0 && comparisonBase.prepTime.measuredOrders > 0;
  const dateRange =
    w.firstOrderAt && w.lastOrderAt
      ? `${fmtDate(w.firstOrderAt)} – ${fmtDate(w.lastOrderAt)}`
      : `${metrics.spanDays} calendar ${metrics.spanDays === 1 ? 'day' : 'days'}`;
  const slowTail = w.prepTime.measuredOrders > 0 && w.prepTime.avgMinutes > w.prepTime.medianMinutes * 1.2;
  const cancellationImproved = compared.cancellationRate < comparison.cancellationRate;
  const paceImproved = compared.ordersPerCalendarDay > comparison.ordersPerCalendarDay;

  return (
    <div className="space-y-4">
      <section className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-4 border-b border-border flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Gauge size={17} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold">Operational performance</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dateRange} · {w.totalOrders} orders · {w.activeDays} active {w.activeDays === 1 ? 'day' : 'days'}
            </p>
          </div>
          <SegmentedControl options={PERF_WINDOWS} value={win} onChange={setWin} />
        </div>

        {w.totalOrders === 0 ? (
          <div className="p-10 text-center">
            <Receipt size={22} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden="true" />
            <p className="font-medium">No orders in this window</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a wider period to see historical performance.</p>
          </div>
        ) : (
          <div className="p-4 md:p-5 space-y-5">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              <PerfTile
                icon={Receipt}
                label="Orders"
                value={String(w.totalOrders)}
                hint={`${metrics.ordersPerCalendarDay.toFixed(1)} per calendar day`}
                compare={
                  win === 'allTime' ? undefined : { value: metrics.ordersPerCalendarDay, baseline: displayedBaseline.ordersPerCalendarDay }
                }
              />
              <PerfTile
                icon={CircleDollarSign}
                label="Revenue"
                value={fmtMoney(w.totalRevenue)}
                hint={`${fmtMoney(metrics.revenuePerActiveDay)} per active day`}
                compare={
                  win === 'allTime'
                    ? undefined
                    : { value: metrics.revenuePerCalendarDay, baseline: displayedBaseline.revenuePerCalendarDay }
                }
              />
              <PerfTile
                icon={Store}
                label="Average order"
                value={fmtMoney(w.avgOrderValue)}
                hint="Revenue excluding cancelled orders"
                compare={win === 'allTime' ? undefined : { value: metrics.revenuePerOrder, baseline: displayedBaseline.revenuePerOrder }}
              />
              <PerfTile
                icon={Zap}
                label="Order velocity"
                value={w.avgOrdersPerActiveDay.toFixed(1)}
                hint="Orders per active day"
                compare={
                  win === 'allTime' ? undefined : { value: metrics.ordersPerActiveDay, baseline: displayedBaseline.ordersPerActiveDay }
                }
              />
              <PerfTile
                icon={CheckCircle2}
                label="Completion"
                value={fmtPct(metrics.completionRate)}
                hint={`${w.completedOrders} completed`}
                compare={win === 'allTime' ? undefined : { value: metrics.completionRate, baseline: displayedBaseline.completionRate }}
              />
              <PerfTile
                icon={Timer}
                label="Median prep"
                value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)}
                hint={`${w.prepTime.measuredOrders} measured orders`}
                compare={
                  win === 'allTime' || !w.prepTime.measuredOrders || !data.windows[baselineKey].prepTime.measuredOrders
                    ? undefined
                    : {
                        value: w.prepTime.medianMinutes,
                        baseline: data.windows[baselineKey].prepTime.medianMinutes,
                        lowerIsBetter: true,
                      }
                }
              />
            </div>
          </div>
        )}
      </section>

      {w.totalOrders > 0 && (
        <>
          <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Comparison</p>
                <p className="text-xs text-muted-foreground mt-1">{comparisonLabel}; volume is normalized per calendar day.</p>
              </div>
              <Activity size={18} className="text-primary" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <ComparisonMetric
                label="Order pace"
                value={compared.ordersPerCalendarDay}
                baseline={comparison.ordersPerCalendarDay}
                format={(value) => value.toFixed(1)}
              />
              <ComparisonMetric
                label="Revenue pace"
                value={compared.revenuePerCalendarDay}
                baseline={comparison.revenuePerCalendarDay}
                format={fmtMoney}
              />
              <ComparisonMetric
                label="Avg order"
                value={compared.revenuePerOrder}
                baseline={comparison.revenuePerOrder}
                format={fmtMoney}
              />
              <ComparisonMetric
                label="Cancellation"
                value={compared.cancellationRate}
                baseline={comparison.cancellationRate}
                format={fmtPct}
                lowerIsBetter
              />
              <ComparisonMetric
                label="Median prep"
                value={comparisonPrepAvailable ? comparisonWindow.prepTime.medianMinutes : 0}
                baseline={comparisonPrepAvailable ? comparisonBase.prepTime.medianMinutes : 0}
                format={(value) => (comparisonPrepAvailable ? fmtMins(1, value) : '—')}
                lowerIsBetter
              />
            </div>
          </section>

          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order outcomes</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Completion quality and exceptions in the selected window.</p>
              <BreakdownBar
                rows={[
                  { label: 'Completed', value: w.completedOrders, total: w.totalOrders, colour: 'bg-success' },
                  { label: 'Cancelled', value: w.cancelledOrders, total: w.totalOrders, colour: 'bg-destructive' },
                  { label: 'Other / open', value: otherOrders, total: w.totalOrders, colour: 'bg-warning' },
                ]}
              />
            </section>

            <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sales channels</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Where attributed orders originated.</p>
              <BreakdownBar
                rows={[
                  { label: 'POS', value: w.bySource.pos, total: w.totalOrders, colour: 'bg-primary' },
                  { label: 'Mobile', value: w.bySource.mobile, total: w.totalOrders, colour: 'bg-violet-500' },
                  { label: 'Other', value: otherSources, total: w.totalOrders, colour: 'bg-muted-foreground' },
                ]}
              />
            </section>
          </div>

          <div className="grid xl:grid-cols-2 gap-4 items-start">
            <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={16} className="text-primary" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fulfilment</p>
                  <p className="text-xs text-muted-foreground mt-1">Pending-to-ready timing on completed orders with status history.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <DetailRow icon={Timer} label="Average" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.avgMinutes)} />
                <DetailRow icon={Clock} label="Median" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)} />
                <DetailRow icon={ArrowDownRight} label="Fastest" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.minMinutes)} />
                <DetailRow icon={ArrowUpRight} label="Slowest" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.maxMinutes)} />
                <DetailRow icon={Target} label="Measured" value={`${w.prepTime.measuredOrders} orders`} />
                <DetailRow icon={Gauge} label="Coverage" value={fmtPct(Math.min(100, metrics.prepCoverage))} />
              </div>
              {w.prepTime.measuredOrders === 0 && (
                <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
                  No orders reached “ready” with measurable history, so prep-time statistics are unavailable.
                </p>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={16} className="text-primary" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activity & value</p>
                  <p className="text-xs text-muted-foreground mt-1">Work cadence and commercial contribution.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <DetailRow icon={CalendarDays} label="Active days" value={`${w.activeDays} of ${metrics.spanDays}`} />
                <DetailRow icon={Activity} label="Activity coverage" value={fmtPct(metrics.activityCoverage)} />
                <DetailRow icon={Receipt} label="Orders / active day" value={metrics.ordersPerActiveDay.toFixed(1)} />
                <DetailRow icon={Receipt} label="Orders / calendar day" value={metrics.ordersPerCalendarDay.toFixed(1)} />
                <DetailRow icon={CircleDollarSign} label="Revenue / active day" value={fmtMoney(metrics.revenuePerActiveDay)} />
                <DetailRow icon={CircleDollarSign} label="Revenue / calendar day" value={fmtMoney(metrics.revenuePerCalendarDay)} />
                <DetailRow icon={Store} label="First order" value={w.firstOrderAt ? fmtDate(w.firstOrderAt) : '—'} />
                <DetailRow icon={Store} label="Last order" value={w.lastOrderAt ? fmtDate(w.lastOrderAt) : '—'} />
              </div>
            </section>
          </div>

          <section className="bg-card border border-border rounded-2xl p-4 md:p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Insights</p>
                <p className="text-xs text-muted-foreground mt-1">Signals to investigate with the employee and operational context.</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Insight tone={paceImproved ? 'good' : 'neutral'}>
                Order pace is <strong className="text-foreground">{paceImproved ? 'above' : 'below'} the comparison baseline</strong> at{' '}
                {compared.ordersPerCalendarDay.toFixed(1)} versus {comparison.ordersPerCalendarDay.toFixed(1)} orders per calendar day.
              </Insight>
              <Insight tone={cancellationImproved ? 'good' : compared.cancellationRate > comparison.cancellationRate ? 'watch' : 'neutral'}>
                Cancellation rate is <strong className="text-foreground">{fmtPct(compared.cancellationRate)}</strong>, compared with{' '}
                {fmtPct(comparison.cancellationRate)} in the baseline.
              </Insight>
              <Insight tone={slowTail ? 'watch' : 'good'}>
                {slowTail
                  ? 'Average prep is materially slower than the median, suggesting a tail of delayed orders worth reviewing.'
                  : 'Average and median prep are close, indicating relatively consistent measured fulfilment times.'}
              </Insight>
              <Insight tone={metrics.prepCoverage < 70 ? 'watch' : 'neutral'}>
                Prep timing covers <strong className="text-foreground">{fmtPct(Math.min(100, metrics.prepCoverage))}</strong> of completed
                orders.{' '}
                {metrics.prepCoverage < 70
                  ? 'Treat timing conclusions cautiously until coverage improves.'
                  : 'Coverage is sufficient for a useful operational signal.'}
              </Insight>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              These are attributed operational metrics, not a standalone employee score. Review shift mix, staffing, location demand,
              equipment issues, refunds and customer context before making performance decisions.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon size={13} aria-hidden="true" />
        {label}
      </span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
