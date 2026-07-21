'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Timer,
  TrendingUp,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import {
  Avatar,
  EMPLOYMENT_CONFIG,
  EMPLOYMENT_TYPES,
  PAY_CONFIG,
  PAY_TYPES,
  ROLE_CONFIG,
  ROLES,
  SCOPES,
  canManageTeam,
  canSeeMoney,
  fmtDate,
  fmtHours,
  fmtMoney,
  inp,
  lbl,
  sel,
  toDateInput,
} from '@/components/people/shared';
import { AddressFields } from '@/components/people/AddressFields';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type BankDetailsPayload,
  type EmployeeHours,
  type TimesheetShift,
  getEmployee,
  getEmployeeBank,
  getEmployeeHours,
  offboardEmployee,
  setEmployeeBank,
  updateEmployee,
} from '@/lib/api/hr.service';
import {
  type StaffPerfWindowKey,
  type StaffProfile,
  type StaffRole,
  type StaffScope,
  type UpdateStaffPayload,
  getStaffPerformance,
  updateStaff,
} from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
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
  const canManage = canManageTeam(role);
  // Owned here (not the parent) so the confirm dialog sits with this record view.
  const [offboardOpen, setOffboardOpen] = useState(false);

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
      toast('success', 'Employee re-onboarded.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Failed to re-onboard.'),
  });

  const { data: emp, isLoading } = useQuery({ queryKey: ['hr-employee', userId], queryFn: () => getEmployee(userId) });
  const [monthOffset, setMonthOffset] = useState(0);
  const range = monthRange(monthOffset);
  const { data: hours } = useQuery({
    queryKey: ['employee-hours', userId, range.from, range.to],
    queryFn: () => getEmployeeHours(userId, range.from, range.to),
  });

  const name = member?.name ?? emp?.jobTitle ?? 'Employee';
  const estGross =
    emp?.payType === 'salaried'
      ? Number(emp.annualSalary ?? 0) / 12
      : (hours?.totals.paidHours ?? 0) * Number(emp?.hourlyRate ?? 0);

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
                <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded', ROLE_CONFIG[member.role].bg, ROLE_CONFIG[member.role].text)}>
                  {ROLE_CONFIG[member.role].label}
                </span>
              )}
              {member && !member.isActive && <Badge variant="muted">Inactive</Badge>}
              {emp && <span className="text-xs text-muted-foreground">{emp.jobTitle}</span>}
            </div>
          </div>
        </div>
        {member && (
          <div className="flex items-center gap-2 shrink-0">
            {member.isActive ? (
              <Button variant="outline" onClick={() => setOffboardOpen(true)} className="h-10 text-destructive hover:text-destructive">
                Offboard
              </Button>
            ) : (
              <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="h-10 gap-2">
                {reactivate.isPending && <Loader2 size={15} className="animate-spin" />}
                Onboard
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Body — everything on one page: stat tiles, a 2-per-row card grid, then the full-width timesheet. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-8xl mx-auto p-4 md:p-8 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* At-a-glance stats (need an employee record) */}
              {emp && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat icon={Clock} label={`Paid hours · ${range.label}`} value={fmtHours(hours?.totals.paidHours ?? 0)} />
                  {money && <Stat icon={Banknote} label="Est. gross (month)" value={fmtMoney(estGross)} />}
                  <Stat icon={UserRound} label="Employment" value={EMPLOYMENT_CONFIG[emp.employmentType].label} />
                  <Stat icon={ShieldCheck} label="Started" value={fmtDate(emp.startDate)} />
                </div>
              )}

              {/* Detail cards, two per row. Access & Role comes from the staff
                  profile so it shows even before an employee record exists. */}
              <div className="grid lg:grid-cols-2 gap-4 items-start">
                {member && <AccessCard member={member} locations={locations} canEdit={canManage} />}
                {emp ? (
                  <>
                    <PersonalTab userId={userId} emp={emp} canEdit={money} email={member?.email} />
                    <EmploymentTab userId={userId} emp={emp} canEditPay={money} />
                    {money && <BankTab userId={userId} emp={emp} />}
                  </>
                ) : (
                  <div className="bg-card border border-dashed border-border rounded-2xl p-6">
                    <p className="text-sm text-muted-foreground">
                      Account only — no employee record yet. Employment, pay, bank and timesheet appear here once onboarded.
                    </p>
                  </div>
                )}
              </div>

              {/* Performance — sales & throughput this member has driven */}
              {member && <PerformanceCard userId={userId} />}

              {/* Timesheet — one row per day; click a day for its shift segments */}
              {emp && <TimesheetCard hours={hours} monthOffset={monthOffset} onMonthChange={setMonthOffset} />}
            </>
          )}
        </div>
      </div>

      {/* Portaled modal — centers on the viewport above the record view. */}
      {member && offboardOpen && (
        <ConfirmModal
          title="Offboard Employee"
          message={
            <>
              Offboard <span className="font-semibold text-foreground">{member.name ?? member.email}</span>? Their record is retained
              (leave &amp; pay history kept) but marked inactive.
            </>
          }
          isPending={offboard.isPending}
          onConfirm={() => offboard.mutate()}
          onClose={() => setOffboardOpen(false)}
        />
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
            <dd className="mt-1"><Badge variant={EMPLOYMENT_CONFIG[emp.employmentType].variant}>{EMPLOYMENT_CONFIG[emp.employmentType].label}</Badge></dd>
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
              <Info label="Unpaid break" value={`${emp.unpaidBreakMins ?? 0} min over ${emp.breakThresholdMins ?? 0} min`} />
            </>
          )}
        </dl>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={lbl}>Job title</label><input className={inp} value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></div>
        <div><label className={lbl}>Department</label><input className={inp} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
        <div>
          <label className={lbl}>Employment type</label>
          <select className={sel} value={f.employmentType} onChange={(e) => setF({ ...f, employmentType: e.target.value as typeof f.employmentType })}>
            {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_CONFIG[t].label}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Start date</label><input type="date" className={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
      </div>
      {canEditPay && (
        <>
          <div className="flex gap-1.5">
            {PAY_TYPES.map((p) => (
              <button key={p} type="button" onClick={() => setF({ ...f, payType: p })}
                className={cn('flex-1 h-10 rounded-lg border text-sm font-medium transition-colors', f.payType === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                {PAY_CONFIG[p].label}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {f.payType === 'hourly' ? (
              <div><label className={lbl}>Hourly rate (£)</label><input className={inp} inputMode="decimal" value={f.hourlyRate} onChange={(e) => setF({ ...f, hourlyRate: e.target.value })} /></div>
            ) : (
              <div><label className={lbl}>Annual salary (£)</label><input className={inp} inputMode="decimal" value={f.annualSalary} onChange={(e) => setF({ ...f, annualSalary: e.target.value })} /></div>
            )}
            <div><label className={lbl}>Unpaid break (mins)</label><input className={inp} inputMode="numeric" value={f.unpaidBreakMins} onChange={(e) => setF({ ...f, unpaidBreakMins: Number(e.target.value) })} /></div>
            <div><label className={lbl}>Break after (mins)</label><input className={inp} inputMode="numeric" value={f.breakThresholdMins} onChange={(e) => setF({ ...f, breakThresholdMins: Number(e.target.value) })} /></div>
          </div>
          <div className="sm:w-1/3"><label className={lbl}>Tax code</label><input className={inp} value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value.toUpperCase() })} /></div>
        </>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">{save.isPending ? 'Saving…' : 'Save'}</Button>
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
            <select className={sel} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Scope</label>
            <select className={sel} value={scope} onChange={(e) => setScope(e.target.value as StaffScope)}>
              {SCOPES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
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
                    locs.includes(l.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm text-foreground">Account active (can sign in)</span>
        </label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">{save.isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Access & Role</p>
        {canEdit && <Button variant="outline" size="sm" onClick={() => setEdit(true)}>Edit</Button>}
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</dt>
          <dd className="mt-1">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide', ROLE_CONFIG[member.role].bg, ROLE_CONFIG[member.role].text)}>
              {ROLE_CONFIG[member.role].label}
            </span>
          </dd>
        </div>
        <Info label="Scope" value={member.scope[0].toUpperCase() + member.scope.slice(1)} />
        <Info label="Locations" value={member.scope === 'location' ? (locNames.length ? locNames.join(', ') : 'None assigned') : 'All in workspace'} />
        <div>
          <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account</dt>
          <dd className="mt-1"><Badge variant={member.isActive ? 'success' : 'muted'}>{member.isActive ? 'Active' : 'Inactive'}</Badge></dd>
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
          <div><label className={lbl}>Date of birth</label><input type="date" className={inp} value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} /></div>
        </div>
        <div><label className={lbl}>Home address</label><AddressFields value={f.address} onChange={(v) => setF({ ...f, address: v })} /></div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Emergency name</label><input className={inp} value={f.emergencyContactName} onChange={(e) => setF({ ...f, emergencyContactName: e.target.value })} /></div>
          <div><label className={lbl}>Emergency phone</label><input className={inp} value={f.emergencyContactPhone} onChange={(e) => setF({ ...f, emergencyContactPhone: e.target.value })} /></div>
          <div><label className={lbl}>Relationship</label><input className={inp} value={f.emergencyContactRelation} onChange={(e) => setF({ ...f, emergencyContactRelation: e.target.value })} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">{save.isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Personal details</p>
        {canEdit && <Button variant="outline" size="sm" onClick={() => setEdit(true)}>Edit</Button>}
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
          <div><label className={lbl}>Account holder</label><input className={inp} value={f.accountHolder ?? ''} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} /></div>
          <div><label className={lbl}>Bank name</label><input className={inp} value={f.bankName ?? ''} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></div>
          <div><label className={lbl}>Sort code</label><input className={inp} value={f.sortCode ?? ''} onChange={(e) => setF({ ...f, sortCode: e.target.value })} placeholder="Leave blank to keep" /></div>
          <div><label className={lbl}>Account number</label><input className={inp} value={f.accountNumber ?? ''} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="Leave blank to keep" /></div>
          <div><label className={lbl}>National Insurance no.</label><input className={inp} value={f.niNumber} onChange={(e) => setF({ ...f, niNumber: e.target.value.toUpperCase() })} placeholder="Leave blank to keep" /></div>
          <div><label className={lbl}>Tax code</label><input className={inp} value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">{save.isPending ? 'Saving…' : 'Save'}</Button>
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
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>Edit</Button>
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
            {fmtHours(t?.paidHours ?? 0)} paid
            {(t?.overtimeHours ?? 0) > 0 && <span className="text-warning"> · {fmtHours(t!.overtimeHours)} overtime</span>} ·{' '}
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={cn(TH, 'text-left')}>Date</th>
              <th className={cn(TH, 'text-left')}>Location</th>
              <th className={cn(TH, 'text-left hidden sm:table-cell')}>Shifts</th>
              <th className={cn(TH, 'text-right')}>Clocked</th>
              <th className={cn(TH, 'text-right')}>Overtime</th>
              <th className={cn(TH, 'text-right')}>Paid</th>
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
                    {d.overtimeHours > 0 ? <Badge variant="warning">+{fmtHours(d.overtimeHours)}</Badge> : <span className="text-muted-foreground/60">—</span>}
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
              {openDay.overtimeHours > 0 && <Badge variant="warning">{fmtHours(openDay.overtimeHours)} overtime (unpaid)</Badge>}
              <Badge variant="success">{fmtHours(openDay.paidHours)} paid</Badge>
            </div>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <th className="px-3 py-2 text-left">Clocked</th>
                    <th className="px-3 py-2 text-left">Scheduled</th>
                    <th className="px-3 py-2 text-right">Clocked</th>
                    <th className="px-3 py-2 text-right">OT</th>
                    <th className="px-3 py-2 text-right">Paid</th>
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
                        {s.scheduled ? `${fmtTime(s.scheduled.startsAt)} – ${fmtTime(s.scheduled.endsAt)}` : 'No rota'}
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
              Pay follows the scheduled shift — time clocked beyond the rota shows as overtime and isn&apos;t paid, and a shift with no
              rota slot (&ldquo;No rota&rdquo;) earns nothing.
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

const fmtMins = (measured: number, mins: number) => (measured === 0 ? '—' : mins < 1 ? `${Math.round(mins * 60)}s` : `${mins} min`);

function PerfTile({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon size={13} aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-bold text-foreground leading-none tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
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
  const cancelPct = w ? Math.round(w.cancellationRate * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-border flex-wrap">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Performance</p>
        <SegmentedControl options={PERF_WINDOWS} value={win} onChange={setWin} />
      </div>

      <div className="p-4 md:p-5">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[76px] rounded-xl border border-border bg-background animate-pulse" />
            ))}
          </div>
        ) : isError || !w ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <TrendingUp size={20} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Couldn&apos;t load performance stats.</p>
          </div>
        ) : w.totalOrders === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Receipt size={20} className="mx-auto mb-2 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No orders in this window.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Headline metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PerfTile icon={Receipt} label="Orders" value={String(w.totalOrders)} hint={`${w.activeDays} active ${w.activeDays === 1 ? 'day' : 'days'}`} />
              <PerfTile icon={TrendingUp} label="Revenue" value={fmtMoney(w.totalRevenue)} hint="excl. cancelled" />
              <PerfTile icon={Store} label="Avg order" value={fmtMoney(w.avgOrderValue)} />
              <PerfTile icon={CalendarDays} label="Orders / day" value={String(w.avgOrdersPerActiveDay)} hint="per active day" />
            </div>

            {/* Throughput + quality detail */}
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
              <DetailRow icon={Timer} label="Avg prep (pending → ready)" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.avgMinutes)} />
              <DetailRow icon={Clock} label="Median prep" value={fmtMins(w.prepTime.measuredOrders, w.prepTime.medianMinutes)} />
              <DetailRow icon={CheckCircle2} label="Completed" value={String(w.completedOrders)} />
              <DetailRow
                icon={XCircle}
                label="Cancelled"
                value={
                  <span className="flex items-center gap-2">
                    {w.cancelledOrders}
                    <Badge variant={cancelPct === 0 ? 'success' : cancelPct <= 10 ? 'warning' : 'destructive'}>{cancelPct}%</Badge>
                  </span>
                }
              />
              <DetailRow icon={Store} label="POS orders" value={String(w.bySource.pos)} />
              <DetailRow icon={Smartphone} label="Mobile orders" value={String(w.bySource.mobile)} />
            </div>

            {w.prepTime.measuredOrders === 0 && (
              <p className="text-[11px] text-muted-foreground">No orders reached “ready” in this window, so prep time can’t be measured.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} aria-hidden="true" />
        {label}
      </span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
