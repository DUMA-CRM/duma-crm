'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { AlertTriangle, Banknote, CalendarDays, Clock, LayoutDashboard, Loader2, Pencil, TrendingUp } from '@/components/icons';
import { Avatar } from '@/components/people/shared';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EditorShell } from '@/components/shared/EditorShell';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import { type StaffProfile, updateStaff } from '@/lib/modules/identity/client';
import { getEmployee, getEmployeeHours, offboardEmployee } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { EmployeeAttendanceCard } from './record/AttendanceCard';
import { EditDetailsDrawer } from './record/EditDetailsDrawer';
import { OffboardModal } from './record/OffboardModal';
import { OverviewSection } from './record/OverviewSection';
import { BankTab, PayslipsCard } from './record/PaySection';
import { AbsenceCard, EmployeeDocumentsCard, LeaveAllowanceCard, TimesheetCard, WorkPatternCard } from './record/TimeSection';
import { monthRange } from './record/shared';

type RecordSection = 'overview' | 'time' | 'pay';

/**
 * Three sections, down from five (2026-09-10).
 *
 * **Documents** merged into **Time & leave**: both are the paperwork of this
 * employment, and the documents section was one card on a tab of its own.
 * It was also gated on `money` in the body while its tab was not, so a
 * `store_manager` saw a Documents tab that rendered nothing at all.
 *
 * **Performance** moved to `/reports/staff/:userId` — 400 lines of order pace,
 * cancellation rate and prep-time medians is trading analysis, and Reports owns
 * every other comparison in the product.
 */
const RECORD_SECTIONS: { value: RecordSection; label: string; icon: typeof Clock; capability?: Capability }[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'time', label: 'Time, leave & documents', icon: CalendarDays },
  { value: 'pay', label: 'Pay & statutory', icon: Banknote, capability: 'hr.sensitive:read' },
];

export function EmployeeRecordPage({
  userId,
  member,
  locations,
  onClose,
}: {
  userId: string;
  member: StaffProfile | null;
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // The last two role checks in the people components. `hr.sensitive:read`
  // guards pay, bank and statutory identifiers; `hr.documents:read` guards the
  // document list. Both resolve to the same three roles the old
  // `canSeeMoney(role)` did, so no access changes — but the documents section
  // now hides its tab instead of rendering an empty one.
  const capabilities = useAuthStore((s) => s.capabilities);
  const money = hasCapability(capabilities, 'hr.sensitive:read');
  const canReadDocuments = hasCapability(capabilities, 'hr.documents:read');
  const canEditPay = hasCapability(capabilities, 'hr.sensitive:write');
  const canReadHelpdesk = hasCapability(capabilities, 'helpdesk:manage');
  // Granted to hr_manager on 2026-09-11 — before that, the role most likely to
  // be reading this page was the one that could not see the rota.
  const canReadRota = hasCapability(capabilities, 'scheduling:read');
  const canReadAttendance = hasCapability(capabilities, 'hr.attendance:read');
  const canReadPrivacy = hasCapability(capabilities, 'privacy:read');
  const canReadPayroll = hasCapability(capabilities, 'hr.payroll:read');
  // Reactivating and the Access panel's edit both call `PATCH /staff/:userId`,
  // which checks `staff:access` — not the `hr.sensitive:read` they were gated on.
  const canChangeAccess = hasCapability(capabilities, 'staff:access');
  const [editing, setEditing] = useState(false);
  // Owned here (not the parent) so the confirm dialog sits with this record view.
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [section, setSection] = useState<RecordSection>('overview');

  const offboard = useMutation({
    mutationFn: () => offboardEmployee(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employees') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff') });
      setOffboardOpen(false);
      toast('success', 'Employee offboarded.');
      // Stay on the record (now inactive) so it can be re-onboarded from here.
    },
    onError: (err) => toast('error', (err as Error).message || 'The employee wasn’t offboarded. Review their record and try again.'),
  });

  // Re-activate a previously offboarded member — flips the staff record back to
  // active. Invalidating ['staff'] refreshes the `member` prop so the view (and
  // this button) reflects the active state without closing.
  const reactivate = useMutation({
    mutationFn: () => updateStaff(userId, { isActive: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employees') });
      toast('success', 'Employee account reactivated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'The employee account wasn’t reactivated. Try again.'),
  });

  const {
    data: emp,
    isLoading,
    isError,
  } = useQuery({ queryKey: moduleQueryKeys.people.key('hr-employee', userId), queryFn: () => getEmployee(userId) });
  const [monthOffset, setMonthOffset] = useState(0);
  const range = monthRange(monthOffset);
  const { data: hours } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-hours', userId, range.from, range.to),
    queryFn: () => getEmployeeHours(userId, range.from, range.to),
  });

  const name = member?.name ?? emp?.jobTitle ?? 'Employee';

  return (
    <EditorShell
      title={name}
      onClose={onClose}
      leading={<Avatar name={name} email={member?.email} />}
      meta={<>{emp?.jobTitle && member?.name && <span className="truncate text-sm text-muted-foreground">{emp.jobTitle}</span>}</>}
      actions={
        member && (
          <>
            {emp && money && (
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setEditing(true)}>
                <Pencil size={14} />
                <span className="hidden md:inline">Edit details</span>
              </Button>
            )}
            {/* Performance moved to Reports; the record keeps the way to it. */}
            <Button asChild variant="outline" className="h-9 gap-1.5">
              <Link href={`/reports/staff/${userId}`}>
                <TrendingUp size={14} aria-hidden="true" />
                <span className="hidden md:inline">Performance</span>
              </Link>
            </Button>
            {member.isActive
              ? money && (
                  <Button variant="outline" onClick={() => setOffboardOpen(true)} className="h-9 text-destructive hover:text-destructive">
                    Offboard
                  </Button>
                )
              : canChangeAccess && (
                  <Button type="button" onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="h-9 gap-2">
                    {reactivate.isPending && <Loader2 size={15} className="animate-spin" />}
                    Reactivate account
                  </Button>
                )}
          </>
        )
      }
      subheader={
        <SectionTabs
          tabs={RECORD_SECTIONS.filter((item) => !item.capability || hasCapability(capabilities, item.capability)).map((item) => ({
            value: item.value,
            label: item.label,
            icon: item.icon,
          }))}
          value={section}
          onChange={setSection}
          ariaLabel="Employee record sections"
        />
      }
    >
      <div className="space-y-4">
        {isLoading ? (
          <LoadingState label="Loading the employee record" />
        ) : isError && !member ? (
          <div className="rounded-lg border border-rule/60 bg-field p-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-md bg-exception/8 text-exception">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-sm font-semibold">Employee record unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed, or you may not have access to it.</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Back to staff
            </Button>
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <OverviewSection
                userId={userId}
                member={member}
                employee={emp ?? null}
                locations={locations}
                access={{
                  money,
                  documents: canReadDocuments,
                  rota: canReadRota,
                  helpdesk: canReadHelpdesk,
                  privacy: canReadPrivacy,
                  payroll: canReadPayroll,
                  staffAccess: canChangeAccess,
                }}
                onEdit={() => setEditing(true)}
                onOpenSection={setSection}
              />
            )}

            {section === 'time' && emp && (
              // The Overview's frame: the calendar across the page (a month
              // doesn't reflow into a column), then what they worked and the
              // paperwork in the main column, the standing terms beside it.
              <motion.div
                className="space-y-5"
                initial="hidden"
                animate="shown"
                variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
              >
                {canReadAttendance && <EmployeeAttendanceCard userId={userId} canReadRota={canReadRota} />}
                <SettingsTabBody
                  aside={
                    <>
                      <WorkPatternCard userId={userId} />
                      <LeaveAllowanceCard userId={userId} employmentType={emp.employmentType} />
                      <AbsenceCard userId={userId} />
                    </>
                  }
                >
                  <TimesheetCard hours={hours} monthOffset={monthOffset} onMonthChange={setMonthOffset} />
                  {canReadDocuments && <EmployeeDocumentsCard userId={userId} />}
                </SettingsTabBody>
              </motion.div>
            )}

            {section === 'pay' && emp && money && (
              // The other tabs' frame: payslips in the main column, where
              // their pay goes and the identifiers payroll needs beside them.
              <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
                {canReadPayroll ? (
                  <SettingsTabBody aside={<BankTab userId={userId} emp={emp} onEdit={canEditPay ? () => setEditing(true) : undefined} />}>
                    <PayslipsCard userId={userId} />
                  </SettingsTabBody>
                ) : (
                  <BankTab userId={userId} emp={emp} onEdit={canEditPay ? () => setEditing(true) : undefined} />
                )}
              </motion.div>
            )}
          </>
        )}
      </div>

      {editing && emp && <EditDetailsDrawer userId={userId} employee={emp} canEditPay={canEditPay} onClose={() => setEditing(false)} />}

      {/* Portaled modal — centers on the viewport above the record view. */}
      {member && offboardOpen && (
        <OffboardModal
          userId={userId}
          name={member.name ?? member.email ?? 'this employee'}
          isPending={offboard.isPending}
          onConfirm={() => offboard.mutate()}
          onClose={() => setOffboardOpen(false)}
        />
      )}
    </EditorShell>
  );
}
