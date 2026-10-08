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
  Info,
  Landmark,
  Receipt,
  Shield,
  Timer,
  UserRound,
  Users,
  Wallet,
} from '@/components/icons';
import { PersonalPanel } from '@/components/people/record/OverviewPanels';
import { RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact } from '@/components/settings/controls';
import { FramedRows, TileSkeleton } from '@/components/shared/TileSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';

import type { Payslip } from '@/lib/modules/payroll/client';
import type { HrEmployee } from '@/lib/modules/people/client';
import type { LeaveEntitlement } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyScheduledShifts } from '@/lib/modules/workforce/client';
import { lengthOfService } from '@/lib/utils/employee-record';
import { type ActionSeverity, type MyHrAction, leaveBalance } from '@/lib/utils/my-hr';
import { formatInstant, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import type { BankVisibility, MyHrTab } from './shared';
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
 * The employee's home, laid out as a settings tab and as their manager sees
 * their record — the same rows, so the two read as one product.
 *
 * Top to bottom: what needs you; four facts that say where you stand, each a
 * way into the tab behind it; then the record — employment and pay in the main
 * column, personal details (the staff record's own panel) beside them.
 *
 * Said once each: your name is the page title, so it is not a row; open
 * requests are the Requests tab's badge and the "needs you" list, so they are
 * not a tile. Editing is the header's one button and the personal panel's
 * "Add" for a missing contact — both open the same drawer.
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
  onEdit,
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
  onEdit: () => void;
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
      // The page as it lands: the folded "needs you" card, four facts, then
      // employment beside personal details.
      <div role="status" aria-busy="true" aria-label="Loading your record" className="space-y-5">
        <TileSkeleton className="border-rule/60 bg-field px-4 py-3.5" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((tile) => (
            <FactSkeleton key={tile} surface="page" />
          ))}
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          {[4, 4].map((rows, index) => (
            <div key={index} className="min-w-0" aria-hidden="true">
              <div className="mb-3 flex min-h-8 items-center">
                <Bone className="h-3.5 w-28" />
              </div>
              <FramedRows rows={rows} trailing={false} />
            </div>
          ))}
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
        clear={{ title: 'Nothing needs you', detail: 'Your record is complete and no requests are waiting on a reply.' }}
      />

      {/* Where you stand — each tile a way into the tab that explains it. */}
      <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={CalendarDays}
          label="Holiday left"
          value={leave.hasEntitlement ? `${leave.remaining} days` : 'No allowance'}
          hint={leave.hasEntitlement ? `${leave.used} of ${leave.total} used` : 'Ask HR to set one'}
          onSelect={() => go('time-off')}
        />
        <NextShift />
        <Fact
          surface="page"
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
            surface="page"
            icon={Wallet}
            label="Last payslip"
            value={latestPayslip ? money(latestPayslip.netPay, latestPayslip.currency) : 'None yet'}
            hint={latestPayslip ? `${fmt(latestPayslip.payPeriodStart)} – ${fmt(latestPayslip.payPeriodEnd)}` : 'Appears once issued'}
            onSelect={() => go('documents')}
          />
        ) : (
          <Fact
            surface="page"
            icon={CalendarCheck}
            label="With us"
            value={service ?? (employee.startDate ? `Starts ${fmt(employee.startDate)}` : 'No start date')}
            hint={service && employee.startDate ? `Since ${fmt(employee.startDate)}` : undefined}
          />
        )}
      </motion.dl>

      {/* The record in the audit log's rows: a tinted tile, the value in bold,
          what it is beneath, a pill only when something's off, any action on
          the right — one hairline list each. Personal details is the staff
          record's own panel, so you and your manager see one drawing of it. */}
      <SettingsTabBody aside={<PersonalPanel employee={employee} email={user?.email} onEdit={onEdit} />}>
        <RecordBlock id="my-employment" label="Employment">
          <RecordList>
            <RecordListRow icon={Building2} label="Job title" value={employee.jobTitle} />
            <RecordListRow icon={Users} label="Department" value={employee.department} placeholder="No department" />
            <RecordListRow
              icon={Clock}
              label="Employment type"
              value={employee.employmentType ? capitalise(employee.employmentType.replaceAll('_', ' ')) : undefined}
            />
            <RecordListRow
              icon={CalendarCheck}
              label="Started"
              // Length of service is the "With us" tile when payroll is off — said once.
              detail={payrollEnabled && service ? service : undefined}
              value={employee.startDate && fmt(employee.startDate)}
            />
          </RecordList>
        </RecordBlock>

        <RecordBlock
          id="my-pay"
          label="Pay details"
          note="Stored values are never shown back to you — these say whether each is on file. Change them with Edit your details."
        >
          <RecordList>
            <RecordListRow
              icon={Banknote}
              tone="money"
              label="Pay basis"
              value={employee.payType === 'hourly' ? 'Hourly' : employee.payType === 'salaried' ? 'Salary' : undefined}
            />
            <RecordListRow
              icon={Shield}
              tone="money"
              label="National Insurance number"
              value={employee.hasNiNumber ? 'On file' : undefined}
              missing="Not on file"
            />
            <RecordListRow
              icon={Receipt}
              tone="money"
              label="Tax code"
              value={employee.taxCode ?? undefined}
              placeholder="Set by payroll"
            />
            <RecordListRow
              icon={Landmark}
              tone="money"
              label="Bank account"
              // A refused read is "can't tell", never "none held".
              value={
                bank.known ? (bank.hasBankDetails ? `On file${bank.bankName ? ` · ${bank.bankName}` : ''}` : undefined) : 'Not shown here'
              }
              missing={bank.known ? 'Not on file' : undefined}
            />
          </RecordList>
        </RecordBlock>
      </SettingsTabBody>
    </motion.div>
  );
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Your next shift as a fact. The rota lives at /scheduling, so this states it
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
      surface="page"
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
      href="/scheduling"
    />
  );
}
