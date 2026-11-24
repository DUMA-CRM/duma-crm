'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info as InfoIcon,
  Mail,
  Timer,
} from '@/components/icons';
import { usePayrollSettings } from '@/components/payroll/usePayroll';
import { fmtDate, fmtHours } from '@/components/people/shared';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { MiniBar } from '@/components/shared/MiniBar';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Button } from '@/components/ui/button';

import type { StaffProfile } from '@/lib/modules/identity/client';
import { getEmployeeDocuments, getEmployeeEntitlements, getEmployeeHours, getManagedTickets } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getScheduledShifts } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { employeeSetupChecks } from '@/lib/utils/employee-compliance';
import {
  type RecordAttentionItem,
  type RecordAttentionSeverity,
  buildRecordAttention,
  lengthOfService,
  ticketsForEmployee,
} from '@/lib/utils/employee-record';
import { leaveBalance } from '@/lib/utils/my-hr';
import { formatMoney } from '@/lib/utils/payroll-totals';
import { workspaceDateKey, workspaceFormatter } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';

import { AccessCard, EmploymentPanel, PayPanel, PersonalPanel } from './OverviewPanels';
import { EmployeeRequestsCard } from './RequestsCard';
import { type Employee, monthRange } from './shared';

/** The checks that need the document list, and so need `hr.documents:read`. */
const DOCUMENT_DERIVED = ['right-to-work', 'contract'];

/** Consequence as colour — the same tiles the staff overview uses. */
const SEVERITY_TILE: Record<RecordAttentionSeverity, string> = {
  blocking: 'bg-exception/8 text-exception',
  attention: 'bg-measured/10 text-measured',
  info: 'bg-primary/8 text-primary',
};
const SEVERITY_TONE: Record<RecordAttentionSeverity, NeedsAttentionTone> = {
  blocking: 'exception',
  attention: 'measured',
  info: 'info',
};
const SEVERITY_ICON: Record<RecordAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: InfoIcon,
};

const SHIFT_DAY = () => workspaceFormatter({ weekday: 'short', day: 'numeric', month: 'short' });
const SHIFT_TIME = () => workspaceFormatter({ hour: '2-digit', minute: '2-digit' });

export interface OverviewAccess {
  /** `hr.sensitive:read` — pay, tax code, statutory ID. */
  money: boolean;
  documents: boolean;
  rota: boolean;
  helpdesk: boolean;
  privacy: boolean;
  payroll: boolean;
  /** `staff:access` — what `PATCH /staff/:userId` checks, and what guards `/settings/roles`. */
  staffAccess: boolean;
}

/**
 * The record's front page, laid out as Settings → Account: what needs someone
 * across the top, then two equal columns — who they are (the identity card
 * over four facts, then employment and pay) beside how to reach them, what
 * their login can do and what they have asked for.
 *
 * Nothing is said twice. The header keeps the name only as the way back; the
 * job title and department are the identity line, the start date the service
 * tile, pay the Pay card, open requests the Requests card. There is one edit
 * for the employment record — the page header's — and Access keeps its own
 * because it writes a different record (the login, not the employment).
 */
export function OverviewSection({
  userId,
  name,
  member,
  employee,
  locations,
  access,
  onEdit,
  onOpenSection,
}: {
  userId: string;
  name: string;
  member: StaffProfile | null;
  employee: Employee | null;
  locations: { id: string; name: string }[];
  access: OverviewAccess;
  onEdit: () => void;
  onOpenSection: (section: 'time' | 'pay') => void;
}) {
  const { data: payroll } = usePayrollSettings(access.payroll);
  // Settings → Roles admits only a super admin (its layout), so the link follows that gate.
  const canManageRoles = useAuthStore((state) => state.role === 'super_admin');
  const currency = payroll?.currency ?? 'GBP';

  // `/helpdesk/manage` has no userId filter — only status, category and a
  // search that also matches subject text — so the queue is narrowed here.
  const ticketsQuery = useQuery({
    queryKey: moduleQueryKeys.support.key('helpdesk-managed', '', '', ''),
    queryFn: () => getManagedTickets({}),
    enabled: access.helpdesk,
  });
  const tickets = useMemo(
    () => (ticketsQuery.data ? ticketsForEmployee(ticketsQuery.data, userId) : undefined),
    [ticketsQuery.data, userId],
  );

  const role = employee ? [employee.jobTitle, employee.department].filter(Boolean).join(' · ') : '';

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {member && (
        <RecordAttention
          member={member}
          employee={employee}
          country={payroll?.payrollCountry ?? null}
          tickets={tickets}
          canReadDocuments={access.documents}
          onAction={(target) => {
            if (target === 'edit') return onEdit();
            if (target === 'documents') return onOpenSection('time');
            if (target === 'pay') return onOpenSection('pay');
            // Access and requests are both further down this page.
            document.getElementById(`record-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <SettingsTabBody>
            <SettingsSection>
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <Avatar name={name} email={member?.email} size="xl" />
                <div className="min-w-0">
                  <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{name}</p>
                  {/* With no employment record there is no Personal card, so the sign-in email is the line. */}
                  {(role || (!employee && member?.email)) && (
                    <p className="mt-1.5 flex items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                      {role ? (
                        <Building2 size={15} className="shrink-0" aria-hidden="true" />
                      ) : (
                        <Mail size={15} className="shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{role || member?.email}</span>
                    </p>
                  )}
                </div>
              </div>
              {employee && (
                <GlanceFacts userId={userId} employee={employee} access={access} currency={currency} onOpenSection={onOpenSection} />
              )}
            </SettingsSection>

            {employee ? (
              <>
                <EmploymentPanel userId={userId} employee={employee} />
                {access.money && <PayPanel employee={employee} currency={currency} country={payroll?.payrollCountry ?? null} />}
              </>
            ) : (
              <SettingsSection title="Account only">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This login has no linked employment record. Don’t schedule or pay this person until onboarding is complete.
                </p>
              </SettingsSection>
            )}
          </SettingsTabBody>
        </div>

        <div className="min-w-0">
          <SettingsTabBody>
            {employee && <PersonalPanel employee={employee} email={member?.email} onEdit={access.money ? onEdit : undefined} />}
            {member && (
              <AccessCard member={member} locations={locations} canEdit={access.staffAccess} canManageRoles={canManageRoles} />
            )}
            {access.helpdesk && (
              <EmployeeRequestsCard
                tickets={tickets}
                loading={ticketsQuery.isPending}
                error={ticketsQuery.isError}
                onRetry={() => void ticketsQuery.refetch()}
              />
            )}
            {/* A shared panel that draws its own heading over its list — a titled list, so no card around it. */}
            {employee && access.privacy && <PrivacyRequestsPanel employeeUserId={userId} tenantId={employee.tenantId} />}
          </SettingsTabBody>
        </div>
      </div>
    </motion.div>
  );
}

// ── Needs you ────────────────────────────────────────────────────────────────

/**
 * Folded by default to one line that says how much and what. Opened, the
 * outstanding checks come first and the completed ones follow as a single
 * line of ticks — during onboarding the checklist is a form being completed,
 * so what is already done stays visible, but it never takes a row each.
 */
function RecordAttention({
  member,
  employee,
  country,
  tickets,
  canReadDocuments,
  onAction,
}: {
  member: StaffProfile;
  employee: Employee | null;
  country: string | null;
  /** Already narrowed to this employee; `undefined` when not fetched. */
  tickets?: Parameters<typeof buildRecordAttention>[0]['tickets'];
  canReadDocuments: boolean;
  onAction: (target: RecordAttentionItem['target']) => void;
}) {
  const [asOf] = useState(() => new Date());

  // Right-to-work and contract are derived from documents, so without the
  // capability those two would report "missing" when the truth is that they
  // were never read.
  const documentsQuery = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-documents', member.userId),
    queryFn: () => getEmployeeDocuments(member.userId),
    enabled: canReadDocuments,
  });

  const checks = employeeSetupChecks(member, employee, documentsQuery.data ?? [], asOf, country).filter(
    (check) => canReadDocuments || !DOCUMENT_DERIVED.includes(check.id),
  );
  const items = buildRecordAttention({ now: asOf, checks, tickets });
  const done = checks.filter((check) => check.complete);

  if (canReadDocuments && documentsQuery.isPending)
    return <TilesSkeleton count={1} label="Checking the record" tileClassName="border-border bg-card px-4 py-3" />;

  if (canReadDocuments && documentsQuery.isError)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-field px-4 py-3" role="alert">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE.blocking)}>
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">The record checks couldn’t run</span>
          <span className="block text-xs text-muted-foreground">
            Documents didn’t load, so right-to-work and contract status are unknown.
          </span>
        </span>
        <Button variant="outline" size="sm" onClick={() => void documentsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );

  if (items.length === 0) return null;

  return (
    // The shared strips, like every other "needs you"; the checks already done and the scope note follow quietly.
    <div className="space-y-2">
      <NeedsAttention
        label="Needs you"
        items={items.map((item) => ({
          key: item.id,
          tone: SEVERITY_TONE[item.severity],
          icon: SEVERITY_ICON[item.severity],
          title: item.title,
          detail: item.detail,
          fix: { label: item.actionLabel, run: () => onAction(item.target) },
        }))}
      />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-muted-foreground">
        <span>
          {done.length} of {checks.length} checks done
        </span>
        {done.map((check) => (
          <span key={check.id} className="inline-flex items-center gap-1">
            <CheckCircle2 size={13} className="text-momentum" aria-hidden="true" />
            {check.label}
          </span>
        ))}
      </p>
      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Operational checks only — tax registration, pension enrolment and starter paperwork are still done in payroll.
      </p>
    </div>
  );
}

// ── At a glance ──────────────────────────────────────────────────────────────

function GlanceFacts({
  userId,
  employee,
  access,
  currency,
  onOpenSection,
}: {
  userId: string;
  employee: Employee;
  access: OverviewAccess;
  currency: string;
  onOpenSection: (section: 'time' | 'pay') => void;
}) {
  // Fixed once per mount: reading the clock during render is impure, and a
  // date that moves every render would churn the query keys with it.
  const [{ now, today, horizon, month }] = useState(() => {
    const at = new Date();
    return {
      now: at,
      today: workspaceDateKey(at),
      horizon: workspaceDateKey(at.getTime() + 28 * 86_400_000),
      month: monthRange(0),
    };
  });

  // Same keys as the Time tab's cards, deliberately: keys here are hand-written
  // literals, so a second spelling would be a second network call that the
  // mutations on that tab then fail to invalidate.
  const year = now.getFullYear();
  const entitlementsQuery = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-entitlements', userId, year),
    queryFn: () => getEmployeeEntitlements(userId, year),
  });
  const hoursQuery = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-hours', userId, month.from, month.to),
    queryFn: () => getEmployeeHours(userId, month.from, month.to),
  });
  const rotaQuery = useQuery({
    queryKey: moduleQueryKeys.workforce.key('scheduled-shifts', userId, today, horizon),
    queryFn: () => getScheduledShifts({ userId, from: today, to: horizon }),
    enabled: access.rota,
  });

  const leave = leaveBalance(entitlementsQuery.data ?? []);
  const nextShift = [...(rotaQuery.data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const rawHours = hoursQuery.data?.totals.rawHours ?? 0;
  const service = employee.startDate ? lengthOfService(employee.startDate, now) : null;
  // Only for hourly pay: a salary is the same every month, and it is already
  // on the employment panel below.
  const hourlyValue = access.money && employee.payType === 'hourly' && employee.hourlyRate ? rawHours * Number(employee.hourlyRate) : null;

  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-2">
      <Fact
        icon={CalendarDays}
        label="Holiday left"
        value={
          entitlementsQuery.isPending ? (
            '…'
          ) : entitlementsQuery.isError ? (
            '—'
          ) : leave.hasEntitlement ? (
            <>
              {leave.remaining} days
              <MiniBar
                value={leave.used}
                max={leave.total}
                tone={leave.remaining <= 0 ? 'warning' : 'primary'}
                label={`${leave.used} of ${leave.total} days used`}
                className="mt-1.5 w-28"
              />
            </>
          ) : (
            'No allowance'
          )
        }
        hint={
          entitlementsQuery.isError
            ? 'Couldn’t be loaded'
            : leave.hasEntitlement
              ? `${leave.used} of ${leave.total} used in ${year}`
              : 'Set one on Time & leave'
        }
        tone={entitlementsQuery.isError ? 'warning' : 'default'}
        onSelect={() => onOpenSection('time')}
      />
      {access.rota && (
        <Fact
          icon={CalendarClock}
          label="Next shift"
          value={
            rotaQuery.isPending
              ? '…'
              : rotaQuery.isError
                ? '—'
                : nextShift
                  ? SHIFT_DAY().format(new Date(nextShift.startsAt))
                  : 'None planned'
          }
          hint={
            rotaQuery.isError
              ? 'Couldn’t be loaded'
              : nextShift
                ? `${SHIFT_TIME().format(new Date(nextShift.startsAt))}–${SHIFT_TIME().format(new Date(nextShift.endsAt))}${nextShift.location?.name ? ` · ${nextShift.location.name}` : ''}`
                : 'Nothing in the next four weeks'
          }
          tone={rotaQuery.isError ? 'warning' : 'default'}
          href="/staff/rota"
        />
      )}
      <Fact
        icon={Timer}
        label={`Clocked · ${month.label.split(' ')[0]}`}
        value={hoursQuery.isPending ? '…' : hoursQuery.isError ? '—' : fmtHours(rawHours)}
        hint={
          hoursQuery.isError
            ? 'Couldn’t be loaded'
            : hourlyValue !== null
              ? `≈ ${formatMoney(hourlyValue, currency)} before deductions`
              : `${hoursQuery.data?.totals.shiftCount ?? 0} shifts`
        }
        tone={hoursQuery.isError ? 'warning' : 'default'}
        onSelect={() => onOpenSection('time')}
      />
      <Fact
        icon={CalendarCheck}
        label="With you"
        value={service ?? (employee.startDate ? `Starts ${fmtDate(employee.startDate)}` : 'No start date')}
        hint={service && employee.startDate ? `Since ${fmtDate(employee.startDate)}` : undefined}
      />
    </dl>
  );
}
