'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  TrendingUp,
  UserRound,
} from '@/components/icons';
import {
  Avatar,
  EMPLOYMENT_CONFIG,
  fmtDate,
  fmtHours,
  fmtMoney,
} from '@/components/people/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';

import {
  getEmployee,
  getEmployeeHours,
  offboardEmployee,
} from '@/lib/api/hr.service';
import {
} from '@/lib/api/people-ops.service';
import { type StaffProfile, updateStaff } from '@/lib/api/staff.service';
import { type Capability, hasCapability } from '@/lib/auth/capabilities';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { ComplianceSummaryCard, AccessCard, EmploymentTab, PersonalTab } from './record/OverviewSection';
import { BankTab, PayslipsCard } from './record/PaySection';
import { monthRange } from './record/shared';
import { AbsenceCard, EmployeeDocumentsCard, LeaveAllowanceCard, TimesheetCard, WorkPatternCard } from './record/TimeSection';

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
  // Owned here (not the parent) so the confirm dialog sits with this record view.
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [section, setSection] = useState<RecordSection>('overview');

  const offboard = useMutation({
    mutationFn: () => offboardEmployee(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      qc.invalidateQueries({ queryKey: ['staff'] });
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
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['hr-employees'] });
      toast('success', 'Employee account reactivated.');
    },
    onError: (err) => toast('error', (err as Error).message || 'The employee account wasn’t reactivated. Try again.'),
  });

  const { data: emp, isLoading, isError } = useQuery({ queryKey: ['hr-employee', userId], queryFn: () => getEmployee(userId) });
  const [monthOffset, setMonthOffset] = useState(0);
  const range = monthRange(monthOffset);
  const { data: hours } = useQuery({
    queryKey: ['employee-hours', userId, range.from, range.to],
    queryFn: () => getEmployeeHours(userId, range.from, range.to),
  });

  const name = member?.name ?? emp?.jobTitle ?? 'Employee';
  const estGross =
    emp?.payType === 'salaried' ? Number(emp.annualSalary ?? 0) / 12 : (hours?.totals.rawHours ?? 0) * Number(emp?.hourlyRate ?? 0);

  return (
    <EditorShell
      title={name}
      onClose={onClose}
      leading={<Avatar name={name} email={member?.email} size="lg" />}
      actions={
        member && (
          <>
            {/* Performance moved to Reports; the record keeps the way to it. */}
            <Link
              href={`/reports/staff/${userId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-rule px-3 text-xs font-semibold transition-colors hover:bg-band"
            >
              <TrendingUp size={14} aria-hidden="true" />
              <span className="hidden md:inline">Performance</span>
            </Link>
            {money &&
              (member.isActive ? (
                <Button variant="outline" onClick={() => setOffboardOpen(true)} className="h-9 text-destructive hover:text-destructive">
                  Offboard
                </Button>
              ) : (
                <Button onClick={() => reactivate.mutate()} disabled={reactivate.isPending} className="h-9 gap-2">
                  {reactivate.isPending && <Loader2 size={15} className="animate-spin" />}
                  Reactivate account
                </Button>
              ))}
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
      {/* Everything on one page: stat tiles, a 2-per-row card grid, then the full-width timesheet. */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : isError && !member ? (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="mx-auto text-destructive" />
            <h2 className="mt-3 font-semibold">Employee record unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed, or you may not have access to it.</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>
              Back to staff
            </Button>
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <>
                {member && <ComplianceSummaryCard member={member} employee={emp ?? null} />}
                {emp && (
                  <StatCardGrid>
                    <StatCard
                      size="sm"
                      icon={Clock}
                      accent="info"
                      label={`Clocked · ${range.label}`}
                      value={fmtHours(hours?.totals.rawHours ?? 0)}
                    />
                    {money && (
                      <StatCard
                        size="sm"
                        icon={Banknote}
                        accent="success"
                        label={emp.payType === 'hourly' ? 'Clocked value' : 'Monthly salary'}
                        value={fmtMoney(estGross)}
                      />
                    )}
                    <StatCard
                      size="sm"
                      icon={UserRound}
                      accent="primary"
                      label="Employment"
                      value={EMPLOYMENT_CONFIG[emp.employmentType].label}
                    />
                    <StatCard size="sm" icon={ShieldCheck} accent="neutral" label="Started" value={fmtDate(emp.startDate)} />
                  </StatCardGrid>
                )}
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  {member && <AccessCard member={member} locations={locations} canEdit={money} />}
                  {emp ? (
                    <>
                      <PersonalTab userId={userId} emp={emp} canEdit={money} email={member?.email} />
                      <EmploymentTab userId={userId} emp={emp} canEditPay={money} />
                    </>
                  ) : (
                    <div className="bg-card border border-dashed border-rule rounded-sm p-6">
                      <p className="font-medium">Account only</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This login has no linked employment record. Do not schedule or pay this person until onboarding is completed.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {section === 'time' && emp && (
              <>
                <div className="grid lg:grid-cols-2 gap-4 items-start">
                  <WorkPatternCard userId={userId} />
                  <LeaveAllowanceCard userId={userId} employmentType={emp.employmentType} />
                </div>
                <AbsenceCard userId={userId} />
                {canReadDocuments && <EmployeeDocumentsCard userId={userId} />}
                <TimesheetCard hours={hours} monthOffset={monthOffset} onMonthChange={setMonthOffset} />
              </>
            )}

            {section === 'pay' && emp && money && (
              <div className="grid lg:grid-cols-2 gap-4 items-start">
                <BankTab userId={userId} emp={emp} />
                <PayslipsCard userId={userId} />
              </div>
            )}


          </>
        )}
      </div>

      {/* Portaled modal — centers on the viewport above the record view. */}
      {member && offboardOpen && (
        <ConfirmModal
          title="Offboard this employee?"
          message={
            <div className="space-y-3">
              <p>
                Offboard <span className="font-semibold text-foreground">{member.name ?? member.email}</span>? Their HR history is retained
                and their account is marked inactive.
              </p>
              <div className="rounded-sm border border-warning/30 bg-warning/5 p-3 text-left text-xs text-muted-foreground">
                Before confirming, record the last working day and reason in the employment documents, approve final time and expenses,
                calculate unused holiday, arrange final payroll/P45, recover assets, and confirm when access must end.
              </div>
            </div>
          }
          confirmLabel="Offboard employee"
          pendingLabel="Offboarding…"
          isPending={offboard.isPending}
          onConfirm={() => offboard.mutate()}
          onClose={() => setOffboardOpen(false)}
        />
      )}
    </EditorShell>
  );
}
