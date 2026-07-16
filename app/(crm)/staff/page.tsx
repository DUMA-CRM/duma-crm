'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { CreateStaffModal, EditEmployeeModal, EditStaffModal, EnrollEmployeeModal } from '@/components/people/PeopleModals';
import { PersonSidebar } from '@/components/people/PersonSidebar';
import { Avatar, EMPLOYMENT_CONFIG, ROLE_CONFIG, fmtDate } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';

import { type HrEmployee, getEmployees } from '@/lib/api/hr.service';
import { type StaffProfile, getStaff, roleAtLeast } from '@/lib/api/staff.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { usePageSidebarStore } from '@/stores/pageSidebarStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Secondary columns hide on smaller screens so the table stays usable on mobile.
const STAFF_COLUMNS = [
  { label: 'Member', className: '' },
  { label: 'Role', className: '' },
  { label: 'Employment', className: 'hidden md:table-cell' },
  { label: 'Type', className: 'hidden lg:table-cell' },
  { label: 'Status', className: '' },
  { label: 'Joined', className: 'hidden lg:table-cell' },
];

type ModalState =
  | { type: 'createStaff' }
  | { type: 'editStaff'; member: StaffProfile }
  | { type: 'enroll'; member: StaffProfile }
  | { type: 'editEmployee'; employee: HrEmployee; name: string };

export default function PeoplePage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const canManage = roleAtLeast(role, 'store_manager');

  useEffect(() => {
    if (role && !canManage) router.replace('/dashboard');
  }, [role, canManage, router]);

  const { tenantId } = useWorkspaceStore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const close = () => setModal(null);

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
  const selectedMember = useMemo(() => staff.find((s) => s.userId === selectedUserId) ?? null, [staff, selectedUserId]);
  const selectedEmployee = selectedUserId ? empByUser.get(selectedUserId) : undefined;

  if (!canManage) return null;

  const enrolledCount = staff.filter((s) => empByUser.has(s.userId)).length;

  const sidebar = (
    <PersonSidebar
      member={selectedMember}
      employee={selectedMember ? empByUser.get(selectedMember.userId) : undefined}
      locations={locations}
      onClose={() => {
        setSelectedUserId(null);
        usePageSidebarStore.getState().setOpen(false);
      }}
      onEditAccess={(m) => setModal({ type: 'editStaff', member: m })}
      onEnroll={(m) => setModal({ type: 'enroll', member: m })}
      onEditEmployment={(emp) =>
        setModal({ type: 'editEmployee', employee: emp, name: selectedMember?.name ?? selectedMember?.email ?? emp.userId })
      }
    />
  );

  return (
    <PageLayout
      eyebrow="Management"
      title="Staff"
      fullHeight
      headerBorder={true}
      sidebar={sidebar}
      headerSlot={
        tenantId ? (
          <button
            onClick={() => setModal({ type: 'createStaff' })}
            className="h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Plus size={15} />
            New Staff
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col h-full">
        <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  {STAFF_COLUMNS.map(({ label, className }, i) => (
                    <th
                      key={label}
                      className={cn(
                        'px-3 md:px-5 py-3.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest',
                        i === STAFF_COLUMNS.length - 1 ? 'text-right pr-4 md:pr-6' : 'text-left',
                        className,
                      )}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className={cn('px-3 md:px-5 py-4', STAFF_COLUMNS[j].className)}>
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${50 + ((i * 11 + j * 19) % 35)}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !tenantId ? (
                  <tr>
                    <td colSpan={6} className="py-24">
                      <EmptyState icon={Users} title="No workspace selected" description="Select a workspace to view people." />
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24">
                      <EmptyState icon={Users} title="No people yet" description='Click "New Staff" to add your first team member.' />
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => {
                    const rc = ROLE_CONFIG[member.role];
                    const emp = empByUser.get(member.userId);
                    const selected = selectedUserId === member.userId;
                    return (
                      <tr
                        key={member.userId}
                        onClick={() => {
                          const next = selected ? null : member.userId;
                          setSelectedUserId(next);
                          // On small screens the panel is a drawer — open it with the selection.
                          usePageSidebarStore.getState().setOpen(next !== null);
                        }}
                        className={cn(
                          'group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer',
                          selected && 'bg-primary/5 hover:bg-primary/5',
                        )}
                      >
                        <td className="px-3 md:px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{member.name ?? '—'}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email ?? '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 md:px-5 py-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
                              rc.bg,
                              rc.text,
                              rc.border,
                            )}
                          >
                            {rc.label}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3.5">
                          {emp ? (
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{emp.jobTitle}</p>
                              {emp.department && <p className="text-xs text-muted-foreground truncate">{emp.department}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">Not enrolled</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-5 py-3.5">
                          {emp ? (
                            <Badge variant={EMPLOYMENT_CONFIG[emp.employmentType].variant}>
                              {EMPLOYMENT_CONFIG[emp.employmentType].label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 md:px-5 py-3.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
                              member.isActive
                                ? 'bg-success/10 text-success border-success/30'
                                : 'bg-muted text-muted-foreground border-border',
                            )}
                          >
                            <span
                              className={cn('w-1.5 h-1.5 rounded-full shrink-0', member.isActive ? 'bg-success' : 'bg-muted-foreground')}
                            />
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-5 py-3.5 pr-6 text-right">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(member.createdAt)}</span>
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
                {staff.length} {staff.length === 1 ? 'person' : 'people'} · {staff.filter((s) => s.isActive).length} active ·{' '}
                {enrolledCount} enrolled
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'createStaff' && tenantId && (
        <Modal title="New Staff Member" onClose={close}>
          <CreateStaffModal tenantId={tenantId} onClose={close} />
        </Modal>
      )}
      {modal?.type === 'editStaff' && (
        <Modal title="Edit Access & Role" onClose={close}>
          <EditStaffModal member={modal.member} locations={locations} onClose={close} />
        </Modal>
      )}
      {modal?.type === 'enroll' && (
        <Modal title="Enroll as Employee" onClose={close}>
          <EnrollEmployeeModal member={modal.member} onClose={close} />
        </Modal>
      )}
      {modal?.type === 'editEmployee' && (
        <Modal title="Edit Employment" onClose={close}>
          <EditEmployeeModal employee={modal.employee} name={modal.name} onClose={close} />
        </Modal>
      )}
    </PageLayout>
  );
}
