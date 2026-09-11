'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  Clock,
  HeartHandshake,
  Info as InfoIcon,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Shield,
  Users,
} from '@/components/icons';
import { type AttentionTone, AttentionList } from '@/components/shared/AttentionList';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';

import type { HelpdeskTicket } from '@/lib/api/people-ops.service';
import { type RecordAttentionItem, type RecordAttentionSeverity, buildRecordAttention } from '@/lib/utils/employee-record';

/** The checks that need the document list, and so need `hr.documents:read`. */
const DOCUMENT_DERIVED = ['right-to-work', 'contract'];

/** Consequence maps onto the shared panel's tones, as it does on My HR. */
const SEVERITY_TONE: Record<RecordAttentionSeverity, AttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'reference',
};
const SEVERITY_ICON: Record<RecordAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: InfoIcon,
};
import {
  EMPLOYMENT_CONFIG,
  ROLES,
  ROLE_CONFIG,
  SCOPES,
  fmtDate,
  fmtMoney,
  lbl,
  sel,
} from '@/components/people/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
} from '@/lib/api/hr.service';
import {
  getEmployeeDocuments,
} from '@/lib/api/people-ops.service';
import { type StaffProfile, type StaffRole, type StaffScope, type UpdateStaffPayload, updateStaff } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { employeeSetupChecks } from '@/lib/utils/employee-compliance';
import { toast } from '@/stores/toastStore';


import { type Employee, Info } from './shared';

export function ComplianceSummaryCard({
  member,
  employee,
  tickets,
  canReadDocuments,
  onAction,
}: {
  member: StaffProfile;
  employee: Employee | null;
  /** Already narrowed to this employee; `undefined` when not fetched. */
  tickets?: HelpdeskTicket[];
  canReadDocuments: boolean;
  onAction: (target: RecordAttentionItem['target']) => void;
}) {
  const [asOf] = useState(() => new Date());
  const [showAll, setShowAll] = useState(false);

  // Right-to-work and contract are derived from documents, so without the
  // capability those two would report "missing" when the truth is that they
  // were never read.
  const documentsQuery = useQuery({
    queryKey: ['employee-documents', member.userId],
    queryFn: () => getEmployeeDocuments(member.userId),
    enabled: canReadDocuments,
  });

  const checks = employeeSetupChecks(member, employee, documentsQuery.data ?? [], asOf).filter(
    (check) => canReadDocuments || !DOCUMENT_DERIVED.includes(check.id),
  );
  const items = buildRecordAttention({ now: asOf, checks, tickets });

  return (
    <div className="space-y-3">
      <AttentionList
        items={items.map((item) => ({
          key: item.id,
          tone: SEVERITY_TONE[item.severity],
          icon: SEVERITY_ICON[item.severity],
          label: item.title,
          detail: item.detail,
          actionLabel: item.actionLabel,
          onSelect: () => onAction(item.target),
        }))}
        loading={canReadDocuments && documentsQuery.isPending}
        error={canReadDocuments && documentsQuery.isError}
        onRetry={() => void documentsQuery.refetch()}
        clearTitle="This record is complete"
        clearDescription="Every check is done and nothing is waiting on a reply."
        errorTitle="The record checks could not be run"
        errorDescription="Documents did not load, so right-to-work and contract status are unknown."
      />

      {/* The full checklist stays reachable — during onboarding it is a form
          being completed, not only an exception feed — but it no longer spends
          the top of the page on six green badges. */}
      <details open={showAll} onToggle={(event) => setShowAll((event.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer list-none text-xs font-semibold text-muted-foreground hover:text-foreground">
          {showAll ? 'Hide' : 'Show'} all {checks.length} employment checks
        </summary>
        <div className="mt-2 grid gap-px overflow-hidden rounded-sm border border-rule bg-rule md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div key={check.id} className="bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{check.label}</p>
                <Badge variant={check.tone}>{check.complete ? 'Ready' : check.tone === 'destructive' ? 'Urgent' : 'Action'}</Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-label text-muted-foreground">
          Operational checks only — pension assessment and HMRC starter declarations still need completing in payroll.
        </p>
      </details>
    </div>
  );
}

export function EmploymentTab({ emp, canSeePay }: { emp: Employee; canSeePay: boolean }) {
  const pay =
    emp.payType === 'hourly'
      ? emp.hourlyRate
        ? `${fmtMoney(emp.hourlyRate)} / hour`
        : undefined
      : emp.annualSalary
        ? `${fmtMoney(emp.annualSalary)} / year`
        : undefined;

  return (
    <DetailCard title="Employment">
      <InfoRow icon={Building2} label="Job title" value={emp.jobTitle} />
      <InfoRow icon={Users} label="Department" value={emp.department} missingLabel="Not assigned" />
      <InfoRow icon={Clock} label="Employment type" value={EMPLOYMENT_CONFIG[emp.employmentType]?.label} />
      <InfoRow icon={CalendarCheck} label="Started" value={emp.startDate ? fmtDate(emp.startDate) : undefined} />
      {canSeePay && (
        <>
          <InfoRow icon={Banknote} label="Pay" value={pay} missingLabel="No rate set" />
          <InfoRow icon={Receipt} label="Tax code" value={emp.taxCode ?? undefined} missingLabel="Set by payroll" />
          <InfoRow
            icon={Shield}
            label="National Insurance"
            // Only whether one is held. Revealing the number is a separate,
            // audited request.
            value={emp.hasNiNumber ? 'Held' : undefined}
            missingLabel="Missing"
          />
        </>
      )}
    </DetailCard>
  );
}

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

export function PersonalTab({ emp, email }: { emp: Employee; email?: string }) {
  return (
    <DetailCard title="Personal details">
      <InfoRow icon={Mail} label="Email" value={email} copyable missingLabel="No account email" />
      <InfoRow icon={CalendarCheck} label="Date of birth" value={emp.dateOfBirth ? fmtDate(emp.dateOfBirth) : undefined} />
      <InfoRow icon={MapPin} label="Home address" value={emp.address} />
      <InfoRow
        icon={HeartHandshake}
        label="Emergency contact"
        value={emp.emergencyContactName}
        hint={emp.emergencyContactRelation ?? undefined}
        missingLabel="None recorded"
      />
      <InfoRow icon={Phone} label="Emergency phone" value={emp.emergencyContactPhone} copyable missingLabel="None recorded" />
    </DetailCard>
  );
}

/** The record's card shell — the same shape My HR's Overview uses. */
export function DetailCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 break-inside-avoid rounded-md border border-rule bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      <InfoGroup className="mt-3 border-0 bg-transparent px-0 py-0">{children}</InfoGroup>
    </section>
  );
}
