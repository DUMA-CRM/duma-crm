'use client';
import { useQuery } from '@tanstack/react-query';

import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleHelp,
  Clock,
  HeartHandshake,
  Info,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Shield,
  UserRound,
  Users,
  Wallet,
} from '@/components/icons';
import { type AttentionTone, AttentionList } from '@/components/shared/AttentionList';
import { InfoGroup, InfoRow } from '@/components/shared/InfoRow';
import { StatCard } from '@/components/shared/StatCard';

import type { HrEmployee } from '@/lib/api/hr.service';
import type { LeaveEntitlement, Payslip } from '@/lib/api/people-ops.service';
import { getMyScheduledShifts } from '@/lib/api/scheduling.service';
import { type ActionSeverity, type MyHrAction, leaveBalance } from '@/lib/utils/my-hr';
import { useAuthStore } from '@/stores/authStore';

import type { BankVisibility, MyHrTab } from './shared';
import { fmt, money } from './shared';

/**
 * How consequence maps onto the shared panel's tones and glyphs: something that
 * stops you being paid is an exception, a deadline is measured, a receipt is
 * reference.
 */
const SEVERITY_TONE: Record<ActionSeverity, AttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'reference',
};
const SEVERITY_ICON: Record<ActionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: Info,
};

/**
 * The employee's home: what needs them, where they stand, what happens next,
 * then the record itself.
 *
 * Editing lives in the page header rather than on each card — one way in, one
 * drawer, instead of four buttons that all open the same form.
 */
export function Overview({
  employee,
  loading,
  entitlements,
  latestPayslip,
  openTickets,
  bank,
  actions,
  onAction,
  go,
}: {
  employee?: HrEmployee;
  loading: boolean;
  entitlements: LeaveEntitlement[];
  latestPayslip?: Payslip;
  openTickets: number;
  bank: BankVisibility;
  actions: MyHrAction[];
  onAction: (action: MyHrAction) => void;
  go: (tab: MyHrTab) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const leave = leaveBalance(entitlements);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );

  if (!employee)
    return (
      <div className="rounded-md border border-rule bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground">No employment record yet</p>
        <p className="mx-auto mt-1.5 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          Your account isn&rsquo;t linked to an employment record, so there are no leave balances, payslips or documents to show. HR can set
          this up for you.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <AttentionList
        items={actions.map((action) => ({
          key: action.id,
          tone: SEVERITY_TONE[action.severity],
          icon: SEVERITY_ICON[action.severity],
          label: action.title,
          detail: action.detail,
          actionLabel: action.actionLabel,
          onSelect: () => onAction(action),
        }))}
        clearDescription="Your record is complete and no requests are waiting on a reply."
      />

      {/* Where you stand, then what's next — the standing figures earn the width. */}
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
          <StatCard
            label="Holiday left"
            value={leave.hasEntitlement ? leave.remaining : '—'}
            unit={leave.hasEntitlement ? 'days' : undefined}
            caption={leave.hasEntitlement ? `${leave.used} of ${leave.total} used` : 'No allowance set'}
            icon={CalendarDays}
            accent="primary"
            size="sm"
            onSelect={() => go('time-off')}
          />
          <StatCard
            label="Last payslip"
            value={latestPayslip ? money(latestPayslip.netPay, latestPayslip.currency) : '—'}
            caption={latestPayslip ? `${fmt(latestPayslip.payPeriodStart)} – ${fmt(latestPayslip.payPeriodEnd)}` : 'None issued yet'}
            icon={Wallet}
            accent="success"
            size="sm"
            onSelect={() => go('documents')}
          />
          <StatCard
            label="Open requests"
            value={openTickets}
            caption={openTickets === 0 ? 'Nothing outstanding' : 'With HR now'}
            icon={CircleHelp}
            accent="info"
            size="sm"
            onSelect={() => go('requests')}
          />
        </div>
        <NextShift />
      </div>

      {/* Columns, not a grid: these cards hold different numbers of fields, and
          a grid row reserves the height of its tallest card — leaving a hole
          under the short one. Flowing them fills the column instead.
          `-mb-4` cancels the trailing margin the last card in each column adds. */}
      <div className="columns-1 gap-4 lg:columns-2 -mb-4">
        <DetailCard title="Personal details">
          <InfoRow icon={UserRound} label="Name" value={user?.name} />
          <InfoRow icon={Mail} label="Email" value={user?.email} copyable />
          <InfoRow icon={CalendarCheck} label="Date of birth" value={employee.dateOfBirth ? fmt(employee.dateOfBirth) : undefined} />
          <InfoRow icon={MapPin} label="Home address" value={employee.address} />
        </DetailCard>

        <DetailCard title="Emergency contact">
          <InfoRow icon={HeartHandshake} label="Name" value={employee.emergencyContactName} />
          <InfoRow icon={Phone} label="Phone" value={employee.emergencyContactPhone} copyable />
        </DetailCard>

        <DetailCard title="Pay details">
          <InfoRow icon={Shield} label="National Insurance number" value={employee.hasNiNumber ? 'Held' : undefined} missingLabel="Missing" />
          <InfoRow icon={Receipt} label="Tax code" value={employee.taxCode ?? undefined} missingLabel="Set by payroll" />
          <InfoRow
            icon={Landmark}
            label="Bank account"
            // Stored values are never returned to the employee, so the row
            // reports whether one is on file — never a partial number.
            value={bank.known ? (bank.hasBankDetails ? `Held${bank.bankName ? ` · ${bank.bankName}` : ''}` : undefined) : 'Not shown here'}
            missingLabel="None on file"
            hint={bank.known ? undefined : 'Use Edit details to set or replace them.'}
          />
          <InfoRow
            icon={Banknote}
            label="Pay basis"
            value={employee.payType === 'hourly' ? 'Hourly' : employee.payType === 'salaried' ? 'Salary' : undefined}
          />
        </DetailCard>

        <DetailCard title="Your employment">
          <InfoRow icon={Building2} label="Job title" value={employee.jobTitle} />
          <InfoRow icon={Users} label="Department" value={employee.department} />
          <InfoRow icon={Clock} label="Employment type" value={employee.employmentType?.replaceAll('_', ' ')} />
          <InfoRow icon={CalendarCheck} label="Started" value={employee.startDate ? fmt(employee.startDate) : undefined} />
        </DetailCard>
      </div>
    </div>
  );
}

function DetailCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 break-inside-avoid rounded-md border border-rule bg-card p-4 shadow-sm md:p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <InfoGroup className="mt-3 border-0 bg-transparent px-0 py-0">{children}</InfoGroup>
    </section>
  );
}

/**
 * The fourth tile in the row, and the same component as the other three — the
 * rota already exists at /scheduling, so this states the next shift and links
 * there rather than redrawing it.
 */
function NextShift() {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 28 * 86400000).toISOString().slice(0, 10);
  const { data = [], isLoading } = useQuery({
    queryKey: ['my-scheduled-shifts', from, to],
    queryFn: () => getMyScheduledShifts({ from, to }),
    retry: false,
  });

  const next = [...data]
    .filter((shift) => new Date(shift.endsAt).getTime() > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const caption = next
    ? [`${time(next.startsAt)}–${time(next.endsAt)}`, next.location?.name].filter(Boolean).join(' · ')
    : 'Nothing in the next four weeks';

  return (
    <StatCard
      label="Next shift"
      // The day answers "when am I in?"; the hours and site follow beneath it.
      value={next ? new Date(next.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
      caption={caption}
      icon={CalendarClock}
      accent="neutral"
      size="sm"
      loading={isLoading}
      href="/scheduling"
    />
  );
}
