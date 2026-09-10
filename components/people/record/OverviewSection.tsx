'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ClipboardCheck,
} from '@/components/icons';
import { AddressFields } from '@/components/people/AddressFields';
import {
  EMPLOYMENT_CONFIG,
  EMPLOYMENT_TYPES,
  PAY_CONFIG,
  PAY_TYPES,
  ROLES,
  ROLE_CONFIG,
  SCOPES,
  fmtDate,
  fmtMoney,
  inp,
  lbl,
  sel,
  toDateInput,
} from '@/components/people/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import {
  updateEmployee,
} from '@/lib/api/hr.service';
import {
  getEmployeeDocuments,
} from '@/lib/api/people-ops.service';
import { type StaffProfile, type StaffRole, type StaffScope, type UpdateStaffPayload, updateStaff } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { employeeSetupChecks, setupProgress } from '@/lib/utils/employee-compliance';
import { toast } from '@/stores/toastStore';


import { type Employee, Info } from './shared';

export function ComplianceSummaryCard({ member, employee }: { member: StaffProfile; employee: Employee | null }) {
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
    <section className="rounded-sm border border-rule bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-rule flex flex-wrap items-center justify-between gap-3">
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
          <p className="text-micro uppercase tracking-micro text-muted-foreground">
            {urgent ? `${urgent} urgent` : outstanding ? `${outstanding} outstanding` : 'Core checks ready'}
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3">
        {checks.map((check) => (
          <div key={check.id} className="p-4 border-b border-rule md:border-r last:border-r-0">
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


// ── Employment & Pay (inline edit) ────────────────────────────────────────────

export function EmploymentTab({ userId, emp, canEditPay }: { userId: string; emp: Employee; canEditPay: boolean }) {
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
    onError: (err) => toast('error', (err as Error).message || 'Employment details weren’t updated. Review the fields and try again.'),
  });

  if (!edit) {
    return (
      <div className="bg-card border border-rule rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Employment & Pay</p>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            Edit
          </Button>
        </div>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <Info label="Job title" value={emp.jobTitle} />
          <Info label="Department" value={emp.department} />
          <div>
            <dt className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Employment type</dt>
            <dd className="mt-1">
              <Badge variant={EMPLOYMENT_CONFIG[emp.employmentType].variant}>{EMPLOYMENT_CONFIG[emp.employmentType].label}</Badge>
            </dd>
          </div>
          <Info label="Start date" value={fmtDate(emp.startDate)} />
          {canEditPay && emp.payType && (
            <>
              <div>
                <dt className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Pay</dt>
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
    <div className="bg-card border border-rule rounded-sm p-5 space-y-4">
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
        <DatePicker label="Start date" value={f.startDate} onValueChange={(startDate) => setF({ ...f, startDate })} />
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
                  'flex-1 h-10 rounded-sm border text-sm font-medium transition-colors',
                  f.payType === p
                    ? 'border-primary bg-band text-primary'
                    : 'border-rule text-muted-foreground hover:text-foreground',
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
          <p className="rounded-sm border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
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

// ── Access & Role (staff profile: role, scope, locations, status) ─────────────

export function AccessCard({ member, locations, canEdit }: { member: StaffProfile; locations: { id: string; name: string }[]; canEdit: boolean }) {
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
    onError: (err) => toast('error', (err as Error).message || 'Access wasn’t updated. Review the role and locations, then try again.'),
  });

  const locNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name ?? id);

  if (edit) {
    return (
      <div className="bg-card border border-rule rounded-sm p-5 space-y-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Access & Role</p>
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
                    'px-3 h-9 rounded-sm border text-xs font-medium transition-colors',
                    locs.includes(l.id)
                      ? 'border-primary bg-band text-primary'
                      : 'border-rule text-muted-foreground hover:text-foreground',
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
    <div className="bg-card border border-rule rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Access & Role</p>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            Edit
          </Button>
        )}
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Role</dt>
          <dd className="mt-1">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded text-micro font-semibold uppercase tracking-micro',
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
          <dt className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Account</dt>
          <dd className="mt-1">
            <Badge variant={member.isActive ? 'success' : 'muted'}>{member.isActive ? 'Active' : 'Inactive'}</Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ── Personal (view + inline edit for HR/owner) ────────────────────────────────

export function PersonalTab({ userId, emp, canEdit, email }: { userId: string; emp: Employee; canEdit: boolean; email?: string }) {
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
    onError: (err) => toast('error', (err as Error).message || 'Personal details weren’t updated. Review the fields and try again.'),
  });

  if (edit) {
    return (
      <div className="bg-card border border-rule rounded-sm p-5 space-y-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Personal details</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <DatePicker
            label="Date of birth"
            value={f.dateOfBirth}
            onValueChange={(dateOfBirth) => setF({ ...f, dateOfBirth })}
            max={new Date().toISOString().slice(0, 10)}
          />
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
    <div className="bg-card border border-rule rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Personal details</p>
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
      {!canEdit && <p className="text-label text-muted-foreground mt-4">Employees can also edit these from their own profile.</p>}
    </div>
  );
}

