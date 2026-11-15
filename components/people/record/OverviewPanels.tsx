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
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  Receipt,
  Shield,
} from '@/components/icons';
import { EMPLOYMENT_CONFIG, fmtDate, sel } from '@/components/people/shared';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, SettingRow, SettingRows, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { StatusDot } from '@/components/shared/StatusDot';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/label';
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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { ageOn } from '@/lib/utils/employee-compliance';
import { statutoryIdLabel, workingDaysLabel } from '@/lib/utils/employee-record';
import { formatMoney } from '@/lib/utils/payroll-totals';

import { CopyButton, type Employee } from './shared';

// ── Employment ───────────────────────────────────────────────────────────────

/**
 * What they do and on what terms. Read-only rows: the employment record has
 * one edit, the header's drawer. The department is the identity line's, and
 * the start date the "With you" tile's — said once each.
 */
export function EmploymentPanel({ userId, employee }: { userId: string; employee: Employee }) {
  // Same key as the Time tab's pattern card, so an edit there refreshes this.
  const pattern = useQuery({ queryKey: moduleQueryKeys.workforce.key('work-pattern', userId), queryFn: () => getWorkPattern(userId) });
  const days = pattern.data ? workingDaysLabel(pattern.data.workingDays) : null;
  const hours = pattern.data?.contractedWeeklyHours;

  return (
    <SettingsSection id="record-employment" title="Employment">
      <div>
        <ChangeRow
          icon={Clock}
          label="Contract"
          value={EMPLOYMENT_CONFIG[employee.employmentType]?.label ?? <ValueMissing>Not set</ValueMissing>}
        />
        <ChangeRow
          icon={CalendarDays}
          label="Contracted hours"
          value={
            pattern.isPending ? (
              '…'
            ) : hours ? (
              <>
                <span className="truncate">{hours}h a week</span>
                {days && <ValueAside>· {days}</ValueAside>}
              </>
            ) : (
              <ValueMissing>{pattern.isError ? 'Couldn’t be loaded' : 'No work pattern'}</ValueMissing>
            )
          }
        />
      </div>
    </SettingsSection>
  );
}

// ── Pay ──────────────────────────────────────────────────────────────────────

/** The terms payroll reads. Only rendered with `hr.sensitive:read`. */
export function PayPanel({ employee, currency, country }: { employee: Employee; currency: string; country: string | null }) {
  const rate =
    employee.payType === 'hourly'
      ? employee.hourlyRate && `${formatMoney(employee.hourlyRate, currency)} an hour`
      : employee.annualSalary && `${formatMoney(employee.annualSalary, currency)} a year`;
  const monthly = employee.payType === 'salaried' && employee.annualSalary ? Number(employee.annualSalary) / 12 : null;

  return (
    <SettingsSection id="record-pay" title="Pay">
      <div>
        <ChangeRow
          icon={Banknote}
          label={employee.payType === 'salaried' ? 'Salary' : 'Hourly rate'}
          value={
            rate ? (
              <>
                <span className="truncate">{rate}</span>
                {monthly !== null && <ValueAside>· {formatMoney(monthly, currency)} a month</ValueAside>}
              </>
            ) : (
              <ValueMissing>No rate set</ValueMissing>
            )
          }
        />
        <ChangeRow icon={Receipt} label="Tax code" value={employee.taxCode || <ValueMissing>Set by payroll</ValueMissing>} />
        <ChangeRow
          icon={Shield}
          label={statutoryIdLabel(country)}
          value={employee.hasNiNumber ? 'On file' : <ValueMissing>Not recorded</ValueMissing>}
        />
      </div>
    </SettingsSection>
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
  const contact = employee.emergencyContactName;
  const contactDetail = [employee.emergencyContactRelation, contact ? phone : null].filter(Boolean).join(' · ');

  return (
    <SettingsSection id="record-personal" title="Personal details">
      <div>
        <ChangeRow
          icon={Mail}
          label="Email"
          value={
            email ? (
              <a href={`mailto:${email}`} className="truncate hover:underline hover:underline-offset-2">
                {email}
              </a>
            ) : (
              <ValueMissing>No account email</ValueMissing>
            )
          }
          trailing={email && <CopyButton value={email} label="email" />}
        />
        <ChangeRow
          icon={CalendarCheck}
          label="Date of birth"
          value={
            employee.dateOfBirth ? (
              <>
                <span className="truncate">{fmtDate(employee.dateOfBirth)}</span>
                {age !== null && <ValueAside>· age {age}</ValueAside>}
              </>
            ) : (
              <ValueMissing>Not set</ValueMissing>
            )
          }
        />
        <ChangeRow
          icon={MapPin}
          label="Home address"
          value={employee.address ? <span className="truncate">{employee.address}</span> : <ValueMissing>Not set</ValueMissing>}
          trailing={employee.address && <CopyButton value={employee.address} label="address" />}
        />
        <ChangeRow
          icon={HeartHandshake}
          label="Emergency contact"
          value={
            contact ? (
              <>
                <span className="truncate">{contact}</span>
                {contactDetail && <ValueAside>· {contactDetail}</ValueAside>}
              </>
            ) : (
              <ValueMissing>Nobody to call</ValueMissing>
            )
          }
          trailing={
            contact
              ? phone && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                      <Phone data-icon="inline-start" />
                      Call
                    </a>
                  </Button>
                )
              : onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Plus data-icon="inline-start" />
                    Add
                  </Button>
                )
          }
        />
      </div>
    </SettingsSection>
  );
}

// ── Access ───────────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: { value: StaffScope; label: string }[] = [
  { value: 'global', label: 'The whole workspace' },
  { value: 'franchise', label: 'Their franchise' },
  { value: 'location', label: 'Chosen locations' },
];

type AccessRow = 'role' | 'where' | 'sign-in';

/**
 * The login, not the employment: which role, where it applies, and whether it
 * can sign in. Keeps its own edit because it writes the staff record through
 * `updateStaff`, which the employment drawer does not touch — and it is gated
 * on `staff:access`, the capability that route actually checks.
 *
 * Each row's Change opens just its own control; all three share one draft and
 * one save, so the payload is the whole access record as before — the rows not
 * opened still hold the member's current values.
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
    queryFn: () => getRoles(member.tenantId ?? undefined),
  });
  const [open, setOpen] = useState<AccessRow | null>(null);
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
      setOpen(null);
      toast('success', 'Access updated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Access wasn’t updated. Review the role and locations, then try again.'),
  });

  const roleEntry = roleCatalog?.roles.find((entry) => entry.key === member.role);
  const roleName = roleEntry?.name ?? member.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const locNames = (member.locationIds ?? []).map((id) => locations.find((l) => l.id === id)?.name ?? 'Unknown location');
  const where =
    member.scope === 'location' ? locNames : [member.scope === 'franchise' ? 'Every location in their franchise' : 'Every location'];

  // Opening a row starts the draft from the member as they are now.
  const toggle = (row: AccessRow) =>
    canEdit
      ? () => {
          if (open !== row) {
            setRole(member.role);
            setScope(member.scope);
            setIsActive(member.isActive);
            setLocs(member.locationIds ?? []);
          }
          setOpen((current) => (current === row ? null : row));
        }
      : undefined;

  const saveButton = (
    <div className="flex justify-end">
      <Button onClick={() => save.mutate()} disabled={save.isPending || (scope === 'location' && locs.length === 0)}>
        {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Save access
      </Button>
    </div>
  );

  return (
    <SettingsSection
      id="record-access"
      title="Access"
      actions={
        canManageRoles && (
          <Link
            href="/settings/roles"
            className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Roles
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        )
      }
      footnote="Changes apply the next time they sign in."
    >
      <div>
        <ChangeRow
          icon={KeyRound}
          label="Role"
          open={open === 'role'}
          onToggle={toggle('role')}
          value={
            <>
              <span className="truncate">{roleName}</span>
              {roleEntry && (
                <ValueAside>
                  · {roleEntry.capabilities.length} {roleEntry.capabilities.length === 1 ? 'permission' : 'permissions'} ·{' '}
                  {roleEntry.isBuiltIn ? 'built-in' : 'custom'}
                </ValueAside>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <FieldLabel as="span" className="mb-1.5">
                Role
              </FieldLabel>
              <Select
                className={sel}
                value={role}
                onValueChange={(value) => setRole(value as StaffRole)}
                options={(roleCatalog?.roles ?? []).map((nextRole) => ({ value: nextRole.key, label: nextRole.name }))}
                ariaLabel="Role"
              />
            </div>
            {saveButton}
          </div>
        </ChangeRow>
        <ChangeRow
          icon={MapPin}
          label="Where"
          open={open === 'where'}
          onToggle={toggle('where')}
          value={
            where.length > 0 ? (
              <span className="truncate">{where.join(', ')}</span>
            ) : (
              <ValueMissing>No location — they can’t open any</ValueMissing>
            )
          }
        >
          <div className="space-y-4">
            <div>
              <FieldLabel as="span" className="mb-1.5">
                Applies to
              </FieldLabel>
              <Select
                className={sel}
                value={scope}
                onValueChange={(value) => setScope(value as StaffScope)}
                options={SCOPE_OPTIONS}
                ariaLabel="Applies to"
              />
            </div>
            {scope === 'location' && locations.length > 0 && (
              <div>
                <FieldLabel as="span" className="mb-1.5">
                  Locations
                </FieldLabel>
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
                          : 'border-border bg-background/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {saveButton}
          </div>
        </ChangeRow>
        <ChangeRow
          icon={Power}
          label="Sign-in"
          open={open === 'sign-in'}
          onToggle={toggle('sign-in')}
          value={
            <>
              <StatusDot tone={member.isActive ? 'success' : 'exception'} label={member.isActive ? 'Active' : 'Off'} />
              <span className="truncate">{member.isActive ? 'Can sign in' : 'Switched off'}</span>
              {!member.isActive && <ValueAside>· history kept</ValueAside>}
            </>
          }
        >
          <div className="space-y-4">
            <SettingRows>
              <SettingRow icon={Power} title="Can sign in" description="Off keeps their history but stops the login working.">
                <Switch label="Can sign in" checked={isActive} onChange={setIsActive} />
              </SettingRow>
            </SettingRows>
            {saveButton}
          </div>
        </ChangeRow>
      </div>
    </SettingsSection>
  );
}
