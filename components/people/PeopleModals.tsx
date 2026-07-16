'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, UserMinus } from 'lucide-react';
import { useState } from 'react';

import {
  type CreateEmployeePayload,
  type EmploymentType,
  type HrEmployee,
  type UpdateEmployeePayload,
  createEmployee,
  offboardEmployee,
  updateEmployee,
} from '@/lib/api/hr.service';
import {
  type StaffProfile,
  type StaffRole,
  type StaffScope,
  type UpdateStaffPayload,
  createStaff,
  updateStaff,
} from '@/lib/api/staff.service';

import { Avatar, EMPLOYMENT_CONFIG, EMPLOYMENT_TYPES, ROLES, ROLE_CONFIG, SCOPES, inp, lbl, sel, toDateInput } from './shared';

// ── Create staff ──────────────────────────────────────────────────────────────

export function CreateStaffModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<StaffRole>('barista');
  const [scope, setScope] = useState<StaffScope>('location');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createStaff({ name, email, password, tenantId, role, scope }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={lbl}>Full name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Jane Smith"
          className={inp}
          autoFocus
        />
      </div>
      <div>
        <label className={lbl}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="jane@example.com"
          className={inp}
        />
      </div>
      <div>
        <label className={lbl}>Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
            className={inp + ' pr-10'}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={sel}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as StaffScope)} className={sel}>
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── Edit staff (access & role) ────────────────────────────────────────────────

export function EditStaffModal({
  member,
  locations,
  onClose,
}: {
  member: StaffProfile;
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [role, setRole] = useState<StaffRole>(member.role);
  const [scope, setScope] = useState<StaffScope>(member.scope);
  const [isActive, setIsActive] = useState(member.isActive);
  const [selectedLocs, setSelectedLocs] = useState<string[]>(member.locationIds ?? []);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: UpdateStaffPayload = { role, scope, isActive };
      if (scope === 'location') payload.locationIds = selectedLocs;
      return updateStaff(member.userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  const toggleLoc = (id: string) => setSelectedLocs((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 border border-border rounded-xl">
        <Avatar name={member.name} />
        <div>
          <p className="text-sm font-semibold text-foreground">{member.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{member.email ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={sel}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_CONFIG[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as StaffScope)} className={sel}>
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {scope === 'location' && locations.length > 0 && (
        <div>
          <label className={lbl}>Assigned locations</label>
          <div className="flex flex-col gap-1.5 mt-1">
            {locations.map((loc) => (
              <label
                key={loc.id}
                className="flex items-center gap-2.5 cursor-pointer select-none px-3 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedLocs.includes(loc.id)}
                  onChange={() => toggleLoc(loc.id)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm text-foreground">{loc.name}</span>
              </label>
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
        <span className="text-sm text-foreground">Active</span>
      </label>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

// ── Enroll as employee (create HR record for a specific person) ────────────────

export function EnrollEmployeeModal({ member, onClose }: { member: StaffProfile; onClose: () => void }) {
  const qc = useQueryClient();
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time');
  const [startDate, setStartDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: CreateEmployeePayload = {
        userId: member.userId,
        jobTitle,
        employmentType,
        startDate: new Date(startDate).toISOString(),
      };
      if (department) payload.department = department;
      if (dateOfBirth) payload.dateOfBirth = new Date(dateOfBirth).toISOString();
      return createEmployee(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 border border-border rounded-xl">
        <Avatar name={member.name} />
        <div>
          <p className="text-sm font-semibold text-foreground">{member.name ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{member.email ?? '—'}</p>
        </div>
      </div>

      <div>
        <label className={lbl}>Job title</label>
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          required
          placeholder="Store Manager"
          className={inp}
          autoFocus
        />
      </div>
      <div>
        <label className={lbl}>Department</label>
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Operations" className={inp} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Employment type</label>
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className={sel}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Date of birth</label>
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inp} />
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Enrolling…' : 'Enroll'}
        </button>
      </div>
    </form>
  );
}

// ── Edit employment ───────────────────────────────────────────────────────────

export function EditEmployeeModal({ employee, name, onClose }: { employee: HrEmployee; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [jobTitle, setJobTitle] = useState(employee.jobTitle);
  const [department, setDepartment] = useState(employee.department ?? '');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employee.employmentType);
  const [startDate, setStartDate] = useState(toDateInput(employee.startDate));
  const [dateOfBirth, setDateOfBirth] = useState(toDateInput(employee.dateOfBirth));
  // Offboarding is destructive — require a second click to confirm.
  const [confirmOffboard, setConfirmOffboard] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const payload: UpdateEmployeePayload = {
        jobTitle,
        department: department || undefined,
        employmentType,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : undefined,
      };
      return updateEmployee(employee.userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      onClose();
    },
  });

  const offboard = useMutation({
    mutationFn: () => offboardEmployee(employee.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      onClose();
    },
  });

  const error = save.error ?? offboard.error;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-4"
    >
      <div className="px-3 py-2.5 bg-muted/40 border border-border rounded-xl">
        <p className="text-sm font-semibold text-foreground">{name}</p>
      </div>

      <div>
        <label className={lbl}>Job title</label>
        <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required className={inp} />
      </div>
      <div>
        <label className={lbl}>Department</label>
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Operations" className={inp} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Employment type</label>
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className={sel}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EMPLOYMENT_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={lbl}>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Date of birth</label>
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inp} />
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => (confirmOffboard ? offboard.mutate() : setConfirmOffboard(true))}
          disabled={offboard.isPending}
          className={
            'h-10 px-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-1.5 ' +
            (confirmOffboard
              ? 'bg-destructive hover:bg-destructive/90 text-white font-semibold'
              : 'border border-destructive/30 text-destructive hover:bg-destructive/10')
          }
        >
          <UserMinus size={15} />
          {offboard.isPending ? 'Offboarding…' : confirmOffboard ? 'Confirm offboard?' : 'Offboard'}
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
