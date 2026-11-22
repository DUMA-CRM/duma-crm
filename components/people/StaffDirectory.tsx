'use client';

import { useQuery } from '@tanstack/react-query';
import { Popover } from 'radix-ui';
import { type ReactNode, useMemo, useState } from 'react';

import { Search, SlidersHorizontal, Users, X } from '@/components/icons';
import { PendingInvitations } from '@/components/people/StaffInvitations';
import { Avatar, fmtMoney, roleConfig } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FilterChip } from '@/components/shared/FilterChip';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type StaffProfile, type StaffRole, getStaff } from '@/lib/modules/identity/client';
import { getRoles } from '@/lib/modules/identity/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { type HrEmployee, getEmployees } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { setupProgress } from '@/lib/utils/employee-compliance';
import { coreSetupChecks } from '@/lib/utils/staff-overview';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type StatusFilter = 'all' | 'active' | 'inactive';
type RecordFilter = 'all' | 'ready' | 'action';

const STATUS_LABEL: Record<StatusFilter, string> = { active: 'Active', inactive: 'Left', all: 'Everyone' };
const RECORD_LABEL: Record<RecordFilter, string> = { all: 'Any record', ready: 'Ready', action: 'Needs setup' };

/** Core setup progress for a member, ignoring the checks HR does later. */
function coreProgress(member: StaffProfile, employee: HrEmployee | null, asOf: Date) {
  return setupProgress(coreSetupChecks(member, employee, asOf));
}

/** Where someone works, in words: their scope, or the locations they're pinned to. */
function whereOf(member: StaffProfile, locationNames: Map<string, string>): string | null {
  if (member.scope === 'global') return 'Every location';
  if (member.scope === 'franchise') return 'Their franchise';
  const ids = member.locationIds ?? [];
  if (ids.length === 0) return null;
  const names = ids.map((id) => locationNames.get(id)).filter(Boolean) as string[];
  if (names.length === 0) return `${ids.length} location${ids.length === 1 ? '' : 's'}`;
  return ids.length > 1 ? `${names[0]} +${ids.length - 1}` : names[0]!;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>{label}</p>
      {children}
    </div>
  );
}

/**
 * The team directory: one list of people, one toolbar. Each row is a link to
 * the person's record.
 */
export function StaffDirectory() {
  // Pay and statutory identifiers, not "is this a senior account".
  const money = hasCapability(
    useAuthStore((s) => s.capabilities),
    'hr.sensitive:read',
  );
  const canInvite = hasCapability(
    useAuthStore((s) => s.capabilities),
    'staff:onboard',
  );
  const { tenantId } = useWorkspaceStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  // Names for the location column only — the same cached query the rest of the app reads. If it fails, rows say "N locations".
  const { data: locations } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });
  const roleNames = useMemo(() => new Map((roleCatalog?.roles ?? []).map((role) => [role.key, role.name])), [roleCatalog]);
  const locationNames = useMemo(() => new Map((locations ?? []).map((location) => [location.id, location.name])), [locations]);

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

  const actionCount = staff.filter((member) => coreProgress(member, empByUser.get(member.userId) ?? null, complianceAsOf) < 100).length;
  const activeCount = staff.filter((s) => s.isActive).length;
  const statusCounts: Record<StatusFilter, number> = { active: activeCount, inactive: staff.length - activeCount, all: staff.length };

  const roleLabel = (role: StaffRole) => roleConfig(role, roleNames.get(role)).label;

  // Active is the default view, so it isn't counted as a filter being on.
  const filterCount = [statusFilter !== 'active', roleFilter !== 'all', departmentFilter !== 'all', recordFilter !== 'all'].filter(
    Boolean,
  ).length;
  const filtersActive = !!search || filterCount > 0;

  function clearFilters() {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('active');
    setDepartmentFilter('all');
    setRecordFilter('all');
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 basis-full sm:min-w-56 sm:basis-auto sm:flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              placeholder="Name or email…"
              aria-label="Search the team by name or email"
              rightAction={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                ) : undefined
              }
            />
          </div>

          <Popover.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
            <Popover.Trigger asChild>
              <Button variant="outline" aria-label="Open team filters">
                <SlidersHorizontal data-icon="inline-start" />
                Filters
                {filterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-heading px-1 text-micro font-semibold tabular-nums text-background">
                    {filterCount}
                  </span>
                )}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              {/* The Orders page's filter panel: one plain select per row, on a card. */}
              <Popover.Content
                align="end"
                sideOffset={8}
                collisionPadding={16}
                className="z-90 max-h-[var(--radix-popover-content-available-height)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg outline-none"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 className="text-sm font-semibold text-heading">Filters</h2>
                  <Popover.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close filters">
                      <X />
                    </Button>
                  </Popover.Close>
                </div>
                <div className="space-y-4">
                  <FilterField label="Status">
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                      options={(['active', 'inactive', 'all'] as const).map((value) => ({
                        value,
                        label: `${STATUS_LABEL[value]} · ${statusCounts[value]}`,
                      }))}
                      ariaLabel="Filter by status"
                      className="w-full"
                    />
                  </FilterField>
                  <FilterField label="Role">
                    <Select
                      value={roleFilter}
                      onValueChange={(value) => setRoleFilter(value as 'all' | StaffRole)}
                      options={[
                        { value: 'all', label: 'Every role' },
                        ...(roleCatalog?.roles ?? []).map((role) => ({ value: role.key, label: role.name })),
                      ]}
                      ariaLabel="Filter by role"
                      className="w-full"
                    />
                  </FilterField>
                  {departments.length > 0 && (
                    <FilterField label="Department">
                      <Select
                        value={departmentFilter}
                        onValueChange={setDepartmentFilter}
                        options={[{ value: 'all', label: 'Every department' }, ...departments.map((d) => ({ value: d, label: d }))]}
                        ariaLabel="Filter by department"
                        className="w-full"
                      />
                    </FilterField>
                  )}
                  <FilterField label="Record">
                    <Select
                      value={recordFilter}
                      onValueChange={(value) => setRecordFilter(value as RecordFilter)}
                      options={[
                        { value: 'all', label: RECORD_LABEL.all },
                        { value: 'ready', label: RECORD_LABEL.ready },
                        { value: 'action', label: `${RECORD_LABEL.action} · ${actionCount}` },
                      ]}
                      ariaLabel="Filter by record setup"
                      className="w-full"
                    />
                  </FilterField>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {!isLoading && !staffError && (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {filtered.length === staff.length
                ? `${staff.length} ${staff.length === 1 ? 'person' : 'people'}`
                : `${filtered.length} of ${staff.length}`}
            </span>
          )}
        </div>

        {filtersActive && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
            {search && <FilterChip variant="tag" label={`Search: ${search}`} onRemove={() => setSearch('')} />}
            {statusFilter !== 'active' && (
              <FilterChip variant="tag" label={`Status: ${STATUS_LABEL[statusFilter]}`} onRemove={() => setStatusFilter('active')} />
            )}
            {roleFilter !== 'all' && (
              <FilterChip variant="tag" label={`Role: ${roleLabel(roleFilter)}`} onRemove={() => setRoleFilter('all')} />
            )}
            {departmentFilter !== 'all' && (
              <FilterChip variant="tag" label={`Department: ${departmentFilter}`} onRemove={() => setDepartmentFilter('all')} />
            )}
            {recordFilter !== 'all' && (
              <FilterChip variant="tag" label={RECORD_LABEL[recordFilter]} onRemove={() => setRecordFilter('all')} />
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {tenantId && canInvite && <PendingInvitations tenantId={tenantId} />}

      {isLoading ? (
        <ListSkeleton rows={6} avatar label="Loading the team" />
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
          kind={staff.length === 0 ? 'start' : 'search'}
          action={staff.length === 0 ? undefined : { label: 'Clear filters', onClick: clearFilters }}
        />
      ) : (
        <ListRowGroup aria-label="Team">
          {filtered.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              employee={empByUser.get(member.userId)}
              roleLabel={roleLabel(member.role)}
              where={whereOf(member, locationNames)}
              money={money}
              asOf={complianceAsOf}
            />
          ))}
        </ListRowGroup>
      )}
    </div>
  );
}

type Readiness = { label: string; tone: 'ok' | 'todo' | 'risk' | 'none' };

/** Where a member's record stands, in a word. Someone who has left says so instead. */
function readinessOf(member: StaffProfile, emp: HrEmployee | undefined, money: boolean, asOf: Date): Readiness {
  if (!member.isActive) return { label: 'Left', tone: 'none' };
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

/** Avatar · name · role and where they work · pay (with access) · status — one line to scan, one link to open. */
function MemberRow({
  member,
  employee,
  roleLabel,
  where,
  money,
  asOf,
}: {
  member: StaffProfile;
  employee?: HrEmployee;
  roleLabel: string;
  where: string | null;
  money: boolean;
  asOf: Date;
}) {
  const readiness = readinessOf(member, employee, money, asOf);
  const style = READINESS_STYLE[readiness.tone];
  const name = member.name ?? member.email ?? 'Unnamed';
  const role = employee?.jobTitle ? `${roleLabel} · ${employee.jobTitle}` : roleLabel;
  const pay =
    money && employee?.payType
      ? employee.payType === 'hourly'
        ? `${fmtMoney(employee.hourlyRate)}/hr`
        : `${fmtMoney(employee.annualSalary)}/yr`
      : null;

  return (
    <ListRow
      href={`/staff/${member.userId}`}
      muted={!member.isActive}
      leading={
        <span className={cn('shrink-0', !member.isActive && 'opacity-50 grayscale')}>
          <Avatar name={member.name} email={member.email} />
        </span>
      }
      title={name}
      titleExtra={!member.isActive ? <span className="sr-only">(left)</span> : undefined}
      meta={
        <>
          {role}
          {where && <span className="md:hidden"> · {where}</span>}
        </>
      }
      trailing={
        <>
          {where && <span className="hidden w-40 truncate text-sm text-muted-foreground md:inline">{where}</span>}
          {pay && <span className="hidden w-24 text-right text-sm tabular-nums text-foreground lg:inline">{pay}</span>}
          <span className={cn('flex w-28 items-center justify-end gap-1.5 text-xs font-semibold', style.text)}>
            <span className={cn('size-2 rounded-full', style.dot)} aria-hidden="true" />
            {readiness.label}
          </span>
        </>
      }
    />
  );
}
