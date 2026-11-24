'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  HeartHandshake,
  Info,
  Landmark,
  MapPin,
  Receipt,
  Shield,
  Timer,
  UserRound,
  Wallet,
} from '@/components/icons';
import { EMPLOYMENT_CONFIG } from '@/components/people/shared';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, Fact, ValueAside, ValueMissing } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';
import { SectionSkeleton, TileSkeleton } from '@/components/shared/TileSkeleton';

import type { Payslip } from '@/lib/modules/payroll/client';
import type { HrEmployee } from '@/lib/modules/people/client';
import type { LeaveEntitlement } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { ageOn } from '@/lib/utils/employee-compliance';
import { lengthOfService } from '@/lib/utils/employee-record';
import { type ActionSeverity, type MyHrAction, leaveBalance } from '@/lib/utils/my-hr';
import { formatInstant, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import { AddressForm, BankDetailsForm, EmergencyContactForm, NiNumberForm } from './forms';
import type { BankVisibility, EditRow, MyHrTab } from './shared';
import { fmt, money } from './shared';
import { useMonthAttendance } from './useMonthAttendance';

/**
 * How consequence maps onto the shared card's tones and glyphs — the staff
 * overview's mapping: something that stops you being paid is an exception, a
 * deadline is measured, the rest is information.
 */
const SEVERITY_TONE: Record<ActionSeverity, NeedsAttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'info',
};
const SEVERITY_ICON: Record<ActionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: Info,
};

const hrs = (hours: number) => `${Math.round(hours * 10) / 10}h`;

/**
 * The employee's home, laid out as Settings → Account: who you are over the
 * four figures you check first, then the record in two equal columns — what
 * you are employed as beside what HR holds about you, each changeable value a
 * row whose Change opens its form in place.
 *
 * Said once each: the job title is the identity line, so it is not a row; open
 * requests are the Requests tab's badge and the "needs you" list, so they are
 * not a tile; the account email is the Account page's row, not this one's.
 */
export function Overview({
  employee,
  loading,
  entitlements,
  latestPayslip,
  payrollEnabled,
  bank,
  actions,
  onAction,
  editRow,
  onEditRow,
  onEdited,
  go,
  canCreateOwnEmployeeRecord,
  onCreateOwnEmployeeRecord,
}: {
  employee?: HrEmployee;
  loading: boolean;
  entitlements: LeaveEntitlement[];
  latestPayslip?: Payslip;
  payrollEnabled: boolean;
  bank: BankVisibility;
  actions: MyHrAction[];
  onAction: (action: MyHrAction) => void;
  /** The row whose form is open — one at a time across the page, so a deep link can open one too. */
  editRow: EditRow | null;
  onEditRow: (row: EditRow | null) => void;
  /** A form saved: refetch the record and close the row. */
  onEdited: () => void;
  go: (tab: MyHrTab) => void;
  canCreateOwnEmployeeRecord: boolean;
  onCreateOwnEmployeeRecord: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const leave = leaveBalance(entitlements);
  const month = useMonthAttendance(0);
  const [asOf] = useState(() => new Date());

  if (loading)
    return (
      // The page as it lands: the folded "needs you" card, then the identity
      // card beside the first card of rows.
      <div role="status" aria-busy="true" aria-label="Loading your record" className="space-y-5">
        <TileSkeleton className="border-border bg-field px-4 py-3.5" />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <SectionSkeleton>
            <div className="flex items-center gap-4">
              <Bone className="size-24 shrink-0 rounded-md" />
              <div className="space-y-2">
                <Bone className="h-6 w-40" />
                <Bone className="h-3.5 w-56" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((tile) => (
                <FactSkeleton key={tile} surface="panel" />
              ))}
            </div>
          </SectionSkeleton>
          <SectionSkeleton fields={4} />
        </div>
      </div>
    );

  if (!employee)
    return (
      <EmptyState
        icon={UserRound}
        title="No employment record yet"
        description={
          canCreateOwnEmployeeRecord
            ? 'Your leave balances, payslips and documents appear here once your account is linked to an employment record.'
            : 'Your leave balances, payslips and documents appear here once your account is linked to an employment record. Ask your HR team to set it up.'
        }
        action={canCreateOwnEmployeeRecord ? { label: 'Add employee record', onClick: onCreateOwnEmployeeRecord } : undefined}
      />
    );

  const service = employee.startDate ? lengthOfService(employee.startDate, asOf) : null;
  const monthName = month.range.first.toLocaleDateString('en-GB', { month: 'long' });
  const age = employee.dateOfBirth ? ageOn(employee.dateOfBirth, asOf) : null;
  const toggle = (row: EditRow) => () => onEditRow(editRow === row ? null : row);
  const contact = employee.emergencyContactName;
  const contactDetail = [employee.emergencyContactRelation, employee.emergencyContactPhone].filter(Boolean).join(' · ');

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {/* The same folded card as the staff page and every workspace: one line
          saying how many and what, opening to a row per thing with its fix. */}
      <NeedsAttention
        label="Needs you"
        items={actions.map((action) => ({
          key: action.id,
          tone: SEVERITY_TONE[action.severity],
          icon: SEVERITY_ICON[action.severity],
          title: action.title,
          detail: action.detail,
          fix: { label: action.actionLabel, run: () => onAction(action) },
        }))}
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <SettingsTabBody>
            <SettingsSection>
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <Avatar name={user?.name} email={user?.email} size="xl" />
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{user?.name ?? 'Your record'}</p>
                  <p className="mt-1.5 flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                    <Building2 size={15} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{[employee.jobTitle, employee.department].filter(Boolean).join(' · ')}</span>
                  </p>
                </div>
              </div>
              {/* Where you stand — each tile a way into the tab that explains it. */}
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Fact
                  icon={CalendarDays}
                  label="Holiday left"
                  value={leave.hasEntitlement ? `${leave.remaining} days` : 'No allowance'}
                  hint={leave.hasEntitlement ? `${leave.used} of ${leave.total} used` : 'Ask HR to set one'}
                  onSelect={() => go('time-off')}
                />
                <NextShift />
                <Fact
                  icon={Timer}
                  label={`Worked · ${monthName}`}
                  value={month.isLoading ? '…' : month.isError ? '—' : hrs(month.totals.workedHours)}
                  hint={
                    month.isError
                      ? 'Couldn’t be loaded'
                      : month.totals.plannedHours > 0
                        ? `of ${hrs(month.totals.plannedHours)} rostered so far`
                        : 'Nothing rostered yet'
                  }
                  tone={month.isError ? 'warning' : 'default'}
                  onSelect={() => go('attendance')}
                />
                {payrollEnabled ? (
                  <Fact
                    icon={Wallet}
                    label="Last payslip"
                    value={latestPayslip ? money(latestPayslip.netPay, latestPayslip.currency) : 'None yet'}
                    hint={
                      latestPayslip ? `${fmt(latestPayslip.payPeriodStart)} – ${fmt(latestPayslip.payPeriodEnd)}` : 'Appears once issued'
                    }
                    onSelect={() => go('documents')}
                  />
                ) : (
                  <Fact
                    icon={CalendarCheck}
                    label="With us"
                    value={service ?? (employee.startDate ? `Starts ${fmt(employee.startDate)}` : 'No start date')}
                    hint={service && employee.startDate ? `Since ${fmt(employee.startDate)}` : undefined}
                  />
                )}
              </dl>
            </SettingsSection>

            <SettingsSection title="Employment">
              <div>
                <ChangeRow icon={Clock} label="Contract" value={EMPLOYMENT_CONFIG[employee.employmentType]?.label ?? '—'} />
                <ChangeRow
                  icon={CalendarCheck}
                  label="Started"
                  value={
                    employee.startDate ? (
                      <>
                        <span className="truncate">{fmt(employee.startDate)}</span>
                        {/* Length of service is the "With us" tile when payroll is off — said once. */}
                        {payrollEnabled && service && <ValueAside>· {service}</ValueAside>}
                      </>
                    ) : (
                      <ValueMissing>No start date</ValueMissing>
                    )
                  }
                />
              </div>
            </SettingsSection>
          </SettingsTabBody>
        </div>

        <div className="min-w-0">
          <SettingsTabBody>
            <SettingsSection title="Personal details">
              <div>
                <ChangeRow
                  icon={CalendarCheck}
                  label="Date of birth"
                  value={
                    employee.dateOfBirth ? (
                      <>
                        <span className="truncate">{fmt(employee.dateOfBirth)}</span>
                        {age !== null && <ValueAside>· age {age}</ValueAside>}
                      </>
                    ) : (
                      <ValueMissing>Not recorded</ValueMissing>
                    )
                  }
                />
                <ChangeRow
                  icon={MapPin}
                  label="Home address"
                  open={editRow === 'address'}
                  onToggle={toggle('address')}
                  value={employee.address ? <span className="truncate">{employee.address}</span> : <ValueMissing>Not set</ValueMissing>}
                >
                  <AddressForm key={employee.updatedAt} employee={employee} onDone={onEdited} />
                </ChangeRow>
                <ChangeRow
                  icon={HeartHandshake}
                  label="Emergency contact"
                  open={editRow === 'emergency'}
                  onToggle={toggle('emergency')}
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
                >
                  <EmergencyContactForm key={employee.updatedAt} employee={employee} onDone={onEdited} />
                </ChangeRow>
              </div>
            </SettingsSection>

            <SettingsSection title="Pay">
              <div>
                <ChangeRow
                  icon={Banknote}
                  label="Pay basis"
                  value={
                    employee.payType === 'hourly' ? (
                      'Hourly'
                    ) : employee.payType === 'salaried' ? (
                      'Salary'
                    ) : (
                      <ValueMissing>Not set</ValueMissing>
                    )
                  }
                />
                <ChangeRow icon={Receipt} label="Tax code" value={employee.taxCode ?? <ValueMissing>Set by payroll</ValueMissing>} />
                <ChangeRow
                  icon={Shield}
                  label="National Insurance number"
                  open={editRow === 'ni'}
                  onToggle={toggle('ni')}
                  value={employee.hasNiNumber ? 'On file' : <ValueMissing>Not on file</ValueMissing>}
                >
                  <NiNumberForm key={employee.updatedAt} employee={employee} onDone={onEdited} />
                </ChangeRow>
                <ChangeRow
                  icon={Landmark}
                  label="Bank account"
                  open={editRow === 'bank'}
                  onToggle={toggle('bank')}
                  // A refused read is "can't tell", never "none held".
                  value={
                    !bank.known ? (
                      <ValueMissing>Not shown here</ValueMissing>
                    ) : bank.hasBankDetails ? (
                      <>
                        <span className="truncate">On file</span>
                        {bank.bankName && <ValueAside>· {bank.bankName}</ValueAside>}
                      </>
                    ) : (
                      <ValueMissing>Not on file</ValueMissing>
                    )
                  }
                >
                  <BankDetailsForm onDone={onEdited} />
                </ChangeRow>
              </div>
            </SettingsSection>
          </SettingsTabBody>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Your next shift as a fact. The rota is My work's Rota tab, so this states it
 * and links there rather than redrawing it.
 */
function NextShift() {
  const [{ now, from, to }] = useState(() => {
    const at = new Date();
    return {
      now: at.getTime(),
      from: workspaceDateKey(at),
      to: workspaceDateKey(at.getTime() + 28 * 86400000),
    };
  });
  const {
    data = [],
    isPending,
    isError,
  } = useQuery({
    queryKey: moduleQueryKeys.workforce.key('my-scheduled-shifts', from, to),
    queryFn: () => getMyScheduledShifts({ from, to }),
    retry: false,
  });

  const next = [...data].filter((shift) => new Date(shift.endsAt).getTime() > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });

  return (
    <Fact
      icon={CalendarClock}
      label="Next shift"
      value={
        isPending
          ? '…'
          : isError
            ? '—'
            : next
              ? formatInstant(next.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })
              : 'None planned'
      }
      hint={
        isError
          ? 'Couldn’t be loaded'
          : next
            ? [`${time(next.startsAt)}–${time(next.endsAt)}`, next.location?.name].filter(Boolean).join(' · ')
            : 'Nothing in the next four weeks'
      }
      tone={isError ? 'warning' : 'default'}
      href="/my-work?tab=rota"
    />
  );
}
