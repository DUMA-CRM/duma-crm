'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ChevronRight, Search, Users, X } from '@/components/icons';
import { Avatar, EMPLOYMENT_CONFIG, fmtMoney, roleConfig } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type StaffProfile, type StaffRole, getStaff } from '@/lib/modules/identity/client';
import { getRoles } from '@/lib/modules/identity/client';
import { type HrEmployee, getEmployees } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { setupProgress } from '@/lib/utils/employee-compliance';
import { coreSetupChecks } from '@/lib/utils/staff-overview';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type StatusFilter = 'all' | 'active' | 'inactive';
type RecordFilter = 'all' | 'ready' | 'action';

/** Core setup progress for a member, ignoring the checks HR does later. */
function coreProgress(member: StaffProfile, employee: HrEmployee | null, asOf: Date) {
  return setupProgress(coreSetupChecks(member, employee, asOf));
}

/**
 * The team directory: who exists, what state their record is in, and a way in —
 * one row per person, each a link to their record.
 */
export function StaffDirectory() {
  // Pay and statutory identifiers, not "is this a senior account".
  const money = hasCapability(
    useAuthStore((s) => s.capabilities),
    'hr.sensitive:read',
  );
  const { tenantId } = useWorkspaceStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [complianceAsOf] = useState(() => new Date());

  const {
    data: staff = [],
    isLoading,
    isError: staffError,
    refetch: refetchStaff,
  } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const {
    data: employees = [],
    isError: employeeError,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employees', tenantId),
    queryFn: getEmployees,
    enabled: !!tenantId,
  });
  const { data: roleCatalog } = useQuery({
    queryKey: moduleQueryKeys.identity.key('roles', tenantId),
    queryFn: () => getRoles(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const roleNames = useMemo(() => new Map((roleCatalog?.roles ?? []).map((role) => [role.key, role.name])), [roleCatalog]);

  const empByUser = useMemo(() => new Map(employees.map((e) => [e.userId, e])), [employees]);
  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employee.department).filter(Boolean) as string[])].sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter((m) => {
        if (roleFilter !== 'all' && m.role !== roleFilter) return false;
        if (statusFilter === 'active' && !m.isActive) return false;
        if (statusFilter === 'inactive' && m.isActive) return false;
        if (departmentFilter !== 'all' && empByUser.get(m.userId)?.department !== departmentFilter) return false;
        if (recordFilter !== 'all') {
          const progress = coreProgress(m, empByUser.get(m.userId) ?? null, complianceAsOf);
          if (recordFilter === 'ready' && progress < 100) return false;
          if (recordFilter === 'action' && progress === 100) return false;
        }
        if (q && !`${m.name ?? ''} ${m.email ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''));
  }, [staff, search, roleFilter, statusFilter, departmentFilter, recordFilter, empByUser, complianceAsOf]);

  const enrolledCount = staff.filter((s) => empByUser.has(s.userId)).length;
  const actionCount = staff.filter((member) => coreProgress(member, empByUser.get(member.userId) ?? null, complianceAsOf) < 100).length;
  const activeCount = staff.filter((s) => s.isActive).length;

  const filtersActive =
    !!search || roleFilter !== 'all' || statusFilter !== 'active' || departmentFilter !== 'all' || recordFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('active');
    setDepartmentFilter('all');
    setRecordFilter('all');
  }

  const statusCounts = { active: activeCount, inactive: staff.length - activeCount, all: staff.length };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            placeholder="Search name or email…"
            aria-label="Search the team"
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X size={14} />
                </button>
              ) : undefined
            }
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as 'all' | StaffRole)}
          options={[
            { value: 'all', label: 'Every role' },
            ...(roleCatalog?.roles ?? []).map((role) => ({ value: role.key, label: role.name })),
          ]}
          ariaLabel="Filter by role"
          className="w-40"
        />
        {departments.length > 0 && (
          <Select
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            options={[{ value: 'all', label: 'Every department' }, ...departments.map((d) => ({ value: d, label: d }))]}
            ariaLabel="Filter by department"
            className="w-44"
          />
        )}
        <SegmentedControl
          options={[
            { value: 'active', label: `Active · ${statusCounts.active}` },
            { value: 'inactive', label: `Left · ${statusCounts.inactive}` },
            { value: 'all', label: 'All' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filter by status"
        />
        <button
          type="button"
          aria-pressed={recordFilter === 'action'}
          onClick={() => setRecordFilter((current) => (current === 'action' ? 'all' : 'action'))}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            recordFilter === 'action'
              ? 'border-measured/40 bg-measured/10 text-measured'
              : 'border-rule/60 bg-field text-muted-foreground hover:text-foreground',
          )}
        >
          <span className={cn('size-1.5 rounded-full', actionCount > 0 ? 'bg-measured' : 'bg-muted-foreground/50')} aria-hidden="true" />
          Needs setup · {actionCount}
        </button>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-label="Loading the team">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-band/60" />
          ))}
        </div>
      ) : staffError || employeeError ? (
        <ErrorState
          icon={Users}
          title="The team couldn’t be loaded"
          description="Nobody has been read, so this is not an empty team."
          onRetry={() => {
            void refetchStaff();
            void refetchEmployees();
          }}
        />
      ) : !tenantId ? (
        <EmptyState icon={Users} title="No workspace selected" description="Select a workspace to view people." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={staff.length === 0 ? Users : Search}
          title={staff.length === 0 ? 'No people yet' : 'No one matches'}
          description={staff.length === 0 ? 'Use “Onboard” to add your first team member.' : 'Try a different search or filter.'}
        />
      ) : (
        <>
          <ul className="space-y-2" aria-label="Team">
            {filtered.map((member, index) => (
              <MemberRow
                key={member.userId}
                index={index}
                member={member}
                employee={empByUser.get(member.userId)}
                roleLabel={roleConfig(member.role, roleNames.get(member.role)).label}
                money={money}
                asOf={complianceAsOf}
              />
            ))}
          </ul>
          <p className="px-1 text-xs text-muted-foreground">
            {filtered.length !== staff.length && `Showing ${filtered.length} of `}
            {staff.length} {staff.length === 1 ? 'person' : 'people'} · {activeCount} active · {enrolledCount} with HR records ·{' '}
            {actionCount} need setup
          </p>
        </>
      )}
    </div>
  );
}

type Readiness = { label: string; tone: 'ok' | 'todo' | 'risk' | 'none' };

/** Where a member's record stands, in a word — the table's badge, as a dot and a label. */
function readinessOf(member: StaffProfile, emp: HrEmployee | undefined, money: boolean, asOf: Date): Readiness {
  if (!emp) return { label: 'Account only', tone: 'none' };
  if (!money) return { label: 'Record linked', tone: 'ok' };
  const checks = coreSetupChecks(member, emp, asOf);
  if (checks.some((check) => check.tone === 'destructive')) return { label: 'Pay risk', tone: 'risk' };
  const open = checks.filter((check) => !check.complete).length;
  return setupProgress(checks) === 100 ? { label: 'Ready', tone: 'ok' } : { label: `${open} to do`, tone: 'todo' };
}

const READINESS_STYLE: Record<Readiness['tone'], { dot: string; text: string }> = {
  ok: { dot: 'bg-momentum', text: 'text-momentum' },
  todo: { dot: 'bg-measured', text: 'text-measured' },
  risk: { dot: 'bg-exception', text: 'text-exception' },
  none: { dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
};

function MemberRow({
  member,
  employee,
  roleLabel,
  money,
  asOf,
  index,
}: {
  member: StaffProfile;
  employee?: HrEmployee;
  roleLabel: string;
  money: boolean;
  asOf: Date;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const readiness = readinessOf(member, employee, money, asOf);
  const style = READINESS_STYLE[readiness.tone];
  const detail = [employee?.jobTitle, employee ? EMPLOYMENT_CONFIG[employee.employmentType]?.label : null, employee?.department]
    .filter(Boolean)
    .join(' · ');
  const pay =
    money && employee?.payType
      ? employee.payType === 'hourly'
        ? `${fmtMoney(employee.hourlyRate)}/hr`
        : `${fmtMoney(employee.annualSalary)}/yr`
      : null;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 10) * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/staff/${member.userId}`}
        aria-label={`Open ${member.name ?? member.email ?? 'member'}`}
        className={cn(
          'group flex items-center gap-3 rounded-lg border bg-field px-4 py-3 transition-colors hover:border-rule hover:bg-band/40',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          member.isActive ? 'border-rule/60' : 'border-dashed border-rule/60',
        )}
      >
        <span className={cn(!member.isActive && 'opacity-50 grayscale')}>
          <Avatar name={member.name} email={member.email} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm font-semibold', member.isActive ? 'text-foreground' : 'text-muted-foreground')}>
              {member.name ?? member.email ?? 'Unnamed'}
            </span>
            {!member.isActive && <Badge variant="muted">Left</Badge>}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail || member.email || 'No HR record yet'}</span>
        </span>
        <span className="hidden shrink-0 rounded-md bg-band px-2 py-1 text-xs font-medium text-foreground md:inline">{roleLabel}</span>
        {pay && <span className="hidden w-24 shrink-0 text-right text-sm text-foreground lg:inline">{pay}</span>}
        <span className={cn('flex w-28 shrink-0 items-center justify-end gap-1.5 text-xs font-semibold', style.text)}>
          <span className={cn('size-2 rounded-full', style.dot)} aria-hidden="true" />
          {readiness.label}
        </span>
        <ChevronRight
          size={15}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </motion.li>
  );
}
