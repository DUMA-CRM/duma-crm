'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Clock,
  HeartHandshake,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  Receipt,
  Shield,
  Users,
} from '@/components/icons';
import { EMPLOYMENT_CONFIG, fmtDate, lbl, sel } from '@/components/people/shared';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { StatusDot } from '@/components/shared/StatusDot';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  type StaffProfile,
  type StaffRole,
  type StaffScope,
  type UpdateStaffPayload,
  getRoles,
  updateStaff,
} from '@/lib/modules/identity/client';
import { getWorkPattern } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { ageOn } from '@/lib/utils/employee-compliance';
import { statutoryIdLabel, workingDaysLabel } from '@/lib/utils/employee-record';
import { formatMoney } from '@/lib/utils/payroll-totals';
import { toast } from '@/stores/toastStore';

import { CopyButton, type Employee, RecordBlock, RecordList, RecordListRow } from './shared';

// ── Employment ───────────────────────────────────────────────────────────────

/** What they do and on what terms, in the audit log's row style. */
export function EmploymentPanel({
  userId,
  employee,
  canSeePay,
  currency,
  country,
}: {
  userId: string;
  employee: Employee;
  canSeePay: boolean;
  currency: string;
  country: string | null;
}) {
  // Same key as the Time tab's pattern card, so an edit there refreshes this.
  const pattern = useQuery({ queryKey: moduleQueryKeys.workforce.key('work-pattern', userId), queryFn: () => getWorkPattern(userId) });
  const days = pattern.data ? workingDaysLabel(pattern.data.workingDays) : null;
  const hours = pattern.data?.contractedWeeklyHours;

  const rate =
    employee.payType === 'hourly'
      ? employee.hourlyRate && `${formatMoney(employee.hourlyRate, currency)} an hour`
      : employee.annualSalary && `${formatMoney(employee.annualSalary, currency)} a year`;
  const monthly = employee.payType === 'salaried' && employee.annualSalary ? Number(employee.annualSalary) / 12 : null;

  return (
    <RecordBlock
      id="record-employment"
      label="Employment"
      note={canSeePay ? 'Bank details and the ID number itself are on Pay & statutory — revealing them is audited.' : undefined}
    >
      <RecordList>
        <RecordListRow icon={Users} label="Department" value={employee.department} missing="No department" />
        <RecordListRow icon={Clock} label="Contract" value={EMPLOYMENT_CONFIG[employee.employmentType]?.label} />
        <RecordListRow
          icon={CalendarDays}
          label="Contracted hours"
          detail={days ?? undefined}
          value={pattern.isPending ? '…' : hours ? `${hours}h a week` : undefined}
          missing={pattern.isError ? 'Couldn’t be loaded' : 'No work pattern'}
        />
        {canSeePay && (
          <>
            <RecordListRow
              icon={Banknote}
              tone="money"
              label={employee.payType === 'salaried' ? 'Salary' : 'Hourly rate'}
              value={rate || undefined}
              missing="No rate set"
              trailing={monthly !== null ? `${formatMoney(monthly, currency)} / month` : undefined}
            />
            <RecordListRow icon={Receipt} tone="reference" label="Tax code" value={employee.taxCode} placeholder="Set by payroll" />
            <RecordListRow
              icon={Shield}
              tone="reference"
              label={statutoryIdLabel(country)}
              value={employee.hasNiNumber ? 'On file' : undefined}
              missing="Not recorded"
            />
          </>
        )}
      </RecordList>
    </RecordBlock>
  );
}

// ── Personal ─────────────────────────────────────────────────────────────────

/** How to reach them, and who to call if something happens at work. */
export function PersonalPanel({
  employee,
  email,
  onEdit,
}: {
  employee: Employee;
  email?: string;
  /** Present when the reader can edit the record — offers to fill a gap. */
  onEdit?: () => void;
}) {
  const [asOf] = useState(() => new Date());
  const age = employee.dateOfBirth ? ageOn(employee.dateOfBirth, asOf) : null;
  const phone = employee.emergencyContactPhone;
  const noContact = !employee.emergencyContactName;

  const call = phone && (
    <Button asChild variant="ghost" size="sm">
      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
        <Phone data-icon="inline-start" />
        Call
      </a>
    </Button>
  );

  return (
    <RecordBlock id="record-personal" label="Personal details">
      <RecordList>
        <RecordListRow
          icon={Mail}
          label="Email"
          value={
            email && (
              <a href={`mailto:${email}`} className="hover:underline hover:underline-offset-2">
                {email}
              </a>
            )
          }
          placeholder="No account email"
          trailing={email && <CopyButton value={email} label="email" />}
        />
        <RecordListRow
          icon={CalendarCheck}
          label="Date of birth"
          detail={age !== null ? `age ${age}` : undefined}
          value={employee.dateOfBirth && fmtDate(employee.dateOfBirth)}
        />
        <RecordListRow
          icon={MapPin}
          label="Home address"
          value={employee.address}
          trailing={employee.address && <CopyButton value={employee.address} label="address" />}
        />
        <RecordListRow
          icon={HeartHandshake}
          label="Emergency contact"
          detail={[employee.emergencyContactRelation, noContact ? null : phone].filter(Boolean).join(' · ') || undefined}
          value={employee.emergencyContactName}
          missing="Nobody to call"
          trailing={
            noContact
              ? onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Plus data-icon="inline-start" />
                    Add
                  </Button>
                )
              : call
          }
        />
      </RecordList>
    </RecordBlock>
  );
}

// ── Access ───────────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { value: StaffScope; label: string }[] = [
  { value: 'global', label: 'The whole workspace' },
  { value: 'franchise', label: 'Their franchise' },
  { value: 'location', label: 'Chosen locations' },
];

/**
 * The login, not the employment: which role, where it applies, and whether it
 * can sign in. Keeps its own edit because it writes the staff record through
 * `updateStaff`, which the employment drawer does not touch — and it is gated
 * on `staff:access`, the capability that route actually checks.
 */
export function AccessCard({
  member,
  locations,
  canEdit,
  canManageRoles,
}: {
  member: StaffProfile;
  locations: { id: string; name: string }[];
  canEdit: boolean;
  /** `staff:access` also guards `/settings/roles`; without it the link would bounce. */
  canManageRoles: boolean;
}) {
  const qc = useQueryClient();
  const { data: roleCatalog } = useQuery({
    queryKey: moduleQueryKeys.identity.key('roles', member.tenantId),
    queryFn: () => getRoles(member.tenantId),
  });
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
      qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff-member', member.userId) });
      setEdit(false);
      toast('success', 'Access updated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Access wasn’t updated. Review the role and locations, then try again.'),
  });

  const roleEntry = roleCatalog?.roles.find((entry) => entry.key === member.role);
  const roleName = roleEntry?.name ?? member.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const locNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name ?? 'Unknown location');
  const where =
    member.scope === 'location' ? locNames : [member.scope === 'franchise' ? 'Every location in their franchise' : 'Every location'];

  const startEdit = () => {
    setRole(member.role);
    setScope(member.scope);
    setIsActive(member.isActive);
    setLocs(member.locationIds ?? []);
    setEdit(true);
  };

  return (
    <RecordBlock
      id="record-access"
      title="Access"
      action={
        canEdit &&
        !edit && (
          <Button type="button" variant="ghost" size="icon-sm" title="Edit access" aria-label="Edit access" onClick={startEdit}>
            <Pencil aria-hidden="true" />
          </Button>
        )
      }
      note="Changes apply the next time they sign in."
    >
      {edit ? (
        <div className="space-y-4 rounded-lg border border-rule/60 bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>Role</label>
              <Select
                className={sel}
                value={role}
                onValueChange={(value) => setRole(value as StaffRole)}
                options={(roleCatalog?.roles ?? []).map((nextRole) => ({ value: nextRole.key, label: nextRole.name }))}
                ariaLabel="Role"
              />
            </div>
            <div>
              <label className={lbl}>Applies to</label>
              <Select
                className={sel}
                value={scope}
                onValueChange={(value) => setScope(value as StaffScope)}
                options={SCOPE_OPTIONS}
                ariaLabel="Applies to"
              />
            </div>
          </div>
          {scope === 'location' && locations.length > 0 && (
            <div>
              <label className={lbl}>Locations</label>
              <div className="flex flex-wrap gap-1.5">
                {locations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={locs.includes(l.id)}
                    onClick={() => toggleLoc(l.id)}
                    className={cn(
                      'h-9 rounded-md border px-3 text-xs font-medium transition-colors',
                      locs.includes(l.id)
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-rule/60 bg-background/60 text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-rule/40 pt-4">
            <SettingRows>
              <SettingRow icon={Power} title="Can sign in" description="Off keeps their history but stops the login working.">
                <Switch label="Can sign in" checked={isActive} onChange={setIsActive} />
              </SettingRow>
            </SettingRows>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(false)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || (scope === 'location' && locs.length === 0)}>
              {save.isPending ? 'Saving…' : 'Save access'}
            </Button>
          </div>
        </div>
      ) : (
        <RecordList>
          <RecordListRow
            icon={KeyRound}
            tone="reference"
            label="Role"
            detail={
              roleEntry
                ? `${roleEntry.capabilities.length} ${roleEntry.capabilities.length === 1 ? 'permission' : 'permissions'} · ${roleEntry.isBuiltIn ? 'built-in' : 'custom'}`
                : undefined
            }
            value={roleName}
            trailing={
              canManageRoles && (
                <Link href="/settings/roles" className="flex items-center gap-0.5 font-semibold transition-colors hover:text-foreground">
                  Roles
                  <ChevronRight size={13} aria-hidden="true" />
                </Link>
              )
            }
          />
          <RecordListRow
            icon={MapPin}
            tone="reference"
            label="Where"
            value={where.join(', ')}
            missing="No location — they can’t open any"
          />
          <RecordListRow
            icon={Power}
            tone="reference"
            label="Sign-in"
            value={
              <span className="inline-flex items-center gap-2">
                <StatusDot tone={member.isActive ? 'success' : 'exception'} label={member.isActive ? 'Active' : 'Off'} />
                {member.isActive ? 'Can sign in' : 'Switched off'}
              </span>
            }
            detail={member.isActive ? undefined : 'history kept'}
          />
        </RecordList>
      )}
    </RecordBlock>
  );
}
