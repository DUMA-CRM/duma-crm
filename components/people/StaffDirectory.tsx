'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Avatar, EMPLOYMENT_CONFIG, ROLES, ROLE_CONFIG, canSeeMoney, fmtMoney } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type HrEmployee, getEmployees } from '@/lib/api/hr.service';
import { type StaffProfile, type StaffRole, getStaff } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { employeeSetupChecks, setupProgress } from '@/lib/utils/employee-compliance';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type StatusFilter = 'all' | 'active' | 'inactive';
type RecordFilter = 'all' | 'ready' | 'action';

/** Core setup progress for a member, ignoring the checks HR does later. */
function coreProgress(member: StaffProfile, employee: HrEmployee | null, asOf: Date) {
  return setupProgress(
    employeeSetupChecks(member, employee, [], asOf).filter((check) => !['right-to-work', 'contract'].includes(check.id)),
  );
}

/** The team directory: who exists, what state their record is in, and a way in. */
export function StaffDirectory() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const money = canSeeMoney(role);
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
  } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: employees = [], isError: employeeError } = useQuery({
    queryKey: ['hr-employees', tenantId],
    queryFn: getEmployees,
    enabled: !!tenantId,
  });

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

  const filtersActive = !!search || roleFilter !== 'all' || statusFilter !== 'active' || departmentFilter !== 'all' || recordFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('active');
    setDepartmentFilter('all');
    setRecordFilter('all');
  }

  const columns: DataTableColumn<StaffProfile>[] = [
    {
      id: 'member',
      header: 'Member',
      minWidth: 220,
      cell: ({ row: member }) => (
        <div className="flex items-center gap-3">
          <Avatar name={member.name} email={member.email} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{member.name ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      width: 'fit',
      cell: ({ row: member }) => {
        const rc = ROLE_CONFIG[member.role];
        return (
          <span
            className={cn(
              'inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
              rc.bg,
              rc.text,
              rc.border,
            )}
          >
            {rc.label}
          </span>
        );
      },
    },
    {
      id: 'employment',
      header: 'Employment',
      visibility: 'md',
      minWidth: 150,
      cell: ({ row: member }) => {
        const emp = empByUser.get(member.userId);
        if (!emp) return <span className="text-xs text-muted-foreground/60">—</span>;
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{emp.jobTitle}</p>
            <p className="truncate text-xs text-muted-foreground">{EMPLOYMENT_CONFIG[emp.employmentType].label}</p>
          </div>
        );
      },
    },
    ...(money
      ? [
          {
            id: 'pay',
            header: 'Pay',
            visibility: 'lg' as const,
            width: 'fit' as const,
            wrap: 'nowrap' as const,
            cellClassName: 'tabular-nums text-sm',
            cell: ({ row: member }: { row: StaffProfile }) => {
              const emp = empByUser.get(member.userId);
              if (!emp?.payType) return <span className="text-xs text-muted-foreground/60">—</span>;
              return emp.payType === 'hourly' ? `${fmtMoney(emp.hourlyRate)}/hr` : `${fmtMoney(emp.annualSalary)}/yr`;
            },
          },
        ]
      : []),
    {
      id: 'readiness',
      header: 'Record readiness',
      width: 'fit',
      cell: ({ row: member }) => (
        <RecordReadinessBadge member={member} emp={empByUser.get(member.userId)} money={money} asOf={complianceAsOf} />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'fit',
      cell: ({ row: member }) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
            member.isActive ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground',
          )}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', member.isActive ? 'bg-success' : 'bg-muted-foreground')} />
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search and filters — one row, out of the page header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            placeholder="Search name or email…"
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
          options={[{ value: 'all', label: 'All roles' }, ...ROLES.map((r) => ({ value: r, label: ROLE_CONFIG[r].label }))]}
          ariaLabel="Filter by role"
          className="w-40"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All statuses' },
          ]}
          ariaLabel="Filter by status"
          className="w-36"
        />
        <Select
          value={recordFilter}
          onValueChange={(value) => setRecordFilter(value as RecordFilter)}
          options={[
            { value: 'all', label: 'All records' },
            { value: 'ready', label: 'Core setup ready' },
            { value: 'action', label: 'Action needed' },
          ]}
          ariaLabel="Filter by record readiness"
          className="w-44"
        />
        {departments.length > 0 && (
          <Select
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            options={[{ value: 'all', label: 'All departments' }, ...departments.map((d) => ({ value: d, label: d }))]}
            ariaLabel="Filter by department"
            className="hidden w-44 lg:flex"
          />
        )}
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5">
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      <DataTable
        aria-label="Staff directory"
        data={filtered}
        columns={columns}
        getRowKey={(member) => member.userId}
        isLoading={isLoading}
        isError={staffError || employeeError}
        stickyHeader
        minWidth={720}
        errorState={
          <div className="py-16 text-center">
            <p className="font-semibold text-destructive">Couldn’t load the staff directory</p>
            <p className="mt-1 text-sm text-muted-foreground">Refresh the page or try again shortly.</p>
          </div>
        }
        emptyState={
          !tenantId ? (
            <EmptyState icon={Users} title="No workspace selected" description="Select a workspace to view people." />
          ) : (
            <EmptyState
              icon={staff.length === 0 ? Users : Search}
              title={staff.length === 0 ? 'No people yet' : 'No matches'}
              description={staff.length === 0 ? 'Use “Onboard” to add your first team member.' : 'Try a different search or filter.'}
            />
          )
        }
        onRowClick={({ row }) => router.push(`/staff/${row.userId}`)}
        rowAriaLabel={({ row }) => `Open ${row.name ?? row.email ?? 'member'}`}
        footer={
          staff.length > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {filtered.length !== staff.length && `${filtered.length} of `}
                {staff.length} {staff.length === 1 ? 'person' : 'people'} · {activeCount} active · {enrolledCount} with HR records ·{' '}
                {actionCount} need core setup
              </p>
            </div>
          ) : null
        }
        footerClassName="p-0"
      />
    </div>
  );
}

function RecordReadinessBadge({
  member,
  emp,
  money,
  asOf,
}: {
  member: Parameters<typeof employeeSetupChecks>[0];
  emp?: HrEmployee;
  money: boolean;
  asOf: Date;
}) {
  if (!emp) return <Badge variant="warning">Account only</Badge>;
  if (!money) return <Badge variant="success">Record linked</Badge>;
  const checks = employeeSetupChecks(member, emp, [], asOf).filter((check) => !['right-to-work', 'contract'].includes(check.id));
  const progress = setupProgress(checks);
  if (checks.some((check) => check.tone === 'destructive')) return <Badge variant="destructive">Pay risk</Badge>;
  if (progress === 100) return <Badge variant="success">Core ready</Badge>;
  return <Badge variant="warning">{checks.filter((check) => !check.complete).length} actions</Badge>;
}
