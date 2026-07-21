'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmployeeRecordPage } from '@/components/people/EmployeeRecordPage';
import { OnboardingPage } from '@/components/people/OnboardingPage';
import { Avatar, EMPLOYMENT_CONFIG, ROLE_CONFIG, ROLES, canSeeMoney, fmtMoney, sel } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { type HrEmployee, getEmployees } from '@/lib/api/hr.service';
import { type StaffRole, getStaff, roleAtLeast } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export default function PeoplePage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const canManage = roleAtLeast(role, 'store_manager');
  const money = canSeeMoney(role);
  // store_manager out-ranks hr_manager, so onboarding is an explicit allowlist.
  const canOnboard = money;

  useEffect(() => {
    if (role && !canManage) router.replace('/dashboard');
  }, [role, canManage, router]);

  const { tenantId } = useWorkspaceStore();
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | StaffRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff', tenantId],
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId && canManage,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['hr-employees', tenantId],
    queryFn: getEmployees,
    enabled: !!tenantId && canManage,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId && canManage,
  });

  const empByUser = useMemo(() => new Map(employees.map((e) => [e.userId, e])), [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (statusFilter === 'active' && !m.isActive) return false;
      if (statusFilter === 'inactive' && m.isActive) return false;
      if (q && !(`${m.name ?? ''} ${m.email ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [staff, search, roleFilter, statusFilter]);

  if (!canManage) return null;

  const enrolledCount = staff.filter((s) => empByUser.has(s.userId)).length;
  const openMember = openUserId ? staff.find((s) => s.userId === openUserId) ?? null : null;

  // Employee record renders as in-page content so the app sidebar + header stay visible.
  if (openUserId) {
    return (
      <EmployeeRecordPage
        userId={openUserId}
        member={openMember}
        locations={locations}
        onClose={() => setOpenUserId(null)}
      />
    );
  }

  return (
    <PageLayout
      eyebrow="Management"
      title="Staff"
      fullHeight
      headerBorder={false}
      headerSlot={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex-1 max-w-xs">
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search size={14} />} placeholder="Search name or email…" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | StaffRole)} aria-label="Filter by role" className={cn(sel, 'w-auto')}>
              <option value="all">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Filter by status" className={cn(sel, 'w-auto')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          {canOnboard && (
            <button
              onClick={() => setOnboarding(true)}
              className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Plus size={15} />
              Onboard
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col h-full">
        <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Member</th>
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</th>
                  <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Employment</th>
                  {money && <th className="hidden lg:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pay</th>}
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Onboarding</th>
                  <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: money ? 6 : 5 }).map((_, j) => (
                        <td key={j} className="px-3 md:px-5 py-4">
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + ((i * 11 + j * 19) % 35)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !tenantId ? (
                  <tr><td colSpan={6} className="py-24"><EmptyState icon={Users} title="No workspace selected" description="Select a workspace to view people." /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-24"><EmptyState icon={staff.length === 0 ? Users : Search} title={staff.length === 0 ? 'No people yet' : 'No matches'} description={staff.length === 0 ? 'Click "Onboard" to add your first team member.' : 'Try a different search or filter.'} /></td></tr>
                ) : (
                  filtered.map((member) => {
                    const rc = ROLE_CONFIG[member.role];
                    const emp = empByUser.get(member.userId);
                    return (
                      <tr
                        key={member.userId}
                        onClick={() => setOpenUserId(member.userId)}
                        className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                      >
                        <td className="px-3 md:px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} email={member.email} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{member.name ?? '—'}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 md:px-5 py-3.5">
                          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide', rc.bg, rc.text, rc.border)}>{rc.label}</span>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3.5">
                          {emp ? (
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{emp.jobTitle}</p>
                              <p className="text-xs text-muted-foreground truncate">{EMPLOYMENT_CONFIG[emp.employmentType].label}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>
                        {money && (
                          <td className="hidden lg:table-cell px-5 py-3.5">
                            {emp?.payType ? (
                              <span className="text-sm text-foreground tabular-nums">
                                {emp.payType === 'hourly' ? `${fmtMoney(emp.hourlyRate)}/hr` : `${fmtMoney(emp.annualSalary)}/yr`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 md:px-5 py-3.5">
                          {emp ? <OnboardBadge emp={emp} money={money} /> : <Badge variant="warning">Account only</Badge>}
                        </td>
                        <td className="px-3 md:px-5 py-3.5">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide', member.isActive ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground border-border')}>
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', member.isActive ? 'bg-success' : 'bg-muted-foreground')} />
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {staff.length > 0 && (
            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-xs text-muted-foreground">
                {filtered.length !== staff.length && `${filtered.length} of `}
                {staff.length} {staff.length === 1 ? 'person' : 'people'} · {staff.filter((s) => s.isActive).length} active · {enrolledCount} onboarded
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen onboarding */}
      {onboarding && tenantId && (
        <OnboardingPage onClose={() => setOnboarding(false)} onCreated={(userId) => { setOnboarding(false); setOpenUserId(userId); }} />
      )}
    </PageLayout>
  );
}

// Onboarding completeness: account-only < details < + pay < + bank.
function OnboardBadge({ emp, money }: { emp: HrEmployee; money: boolean }) {
  const hasPay = emp.payType && (emp.payType === 'salaried' ? Number(emp.annualSalary) > 0 : Number(emp.hourlyRate) > 0);
  if (!money) return <Badge variant="success">Enrolled</Badge>;
  if (hasPay && emp.hasNiNumber) return <Badge variant="success">Complete</Badge>;
  if (hasPay) return <Badge variant="primary">Pay set</Badge>;
  return <Badge variant="warning">Needs pay</Badge>;
}
