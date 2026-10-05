'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Info as InfoIcon,
  Mail,
  Timer,
} from '@/components/icons';
import { usePayrollSettings } from '@/components/payroll/usePayroll';
import { fmtDate, fmtHours } from '@/components/people/shared';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Badge } from '@/components/ui/badge';
import { Fact } from '@/components/settings/controls';
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

import { AccessCard, EmploymentPanel, PersonalPanel } from './OverviewPanels';
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
const SEVERITY_ICON: Record<RecordAttentionSeverity, typeof AlertTriangle> = {
  blocking: AlertTriangle,
  attention: Clock,
  info: InfoIcon,
};

const SHIFT_DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const SHIFT_TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

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
 * The record's front page, top to bottom: what needs someone, four facts that
 * say where this person stands, then the reference — employment, personal,
 * access and what they have asked HR.
 *
 * Nothing is said twice. The start date lives in the service tile, pay in the
 * employment panel, open requests in the requests panel; the tiles that used
 * to repeat them ("Monthly salary", "Open requests") are gone. There is one
 * edit for the employment record — the page header's — and Access keeps its
 * own because it writes a different record (the login, not the employment).
 */
export function OverviewSection({
  userId,
  member,
  employee,
  locations,
  access,
  onEdit,
  onOpenSection,
}: {
  userId: string;
  member: StaffProfile | null;
  employee: Employee | null;
  locations: { id: string; name: string }[];
  access: OverviewAccess;
  onEdit: () => void;
  onOpenSection: (section: 'time' | 'pay') => void;
}) {
  const { data: payroll } = usePayrollSettings(access.payroll);
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

  const [firstName = '', lastName = ''] = (member?.name ?? '').split(' ');
  const profileLine = employee ? [employee.jobTitle, employee.department].filter(Boolean).join(' · ') : 'No employment record';

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {member && (
        <motion.section variants={SECTION_RISE} aria-label="Needs you">
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
        </motion.section>
      )}

      {/* Laid out as a settings tab is — the same body, panels and read-outs —
          so a person's record and their own Profile read as one product: who
          they are in the main column, what the login can do and what they have
          asked for beside it. */}
      <SettingsTabBody
        aside={
          <>
            {employee && <PersonalPanel employee={employee} email={member?.email} onEdit={access.money ? onEdit : undefined} />}
            {member && <AccessCard member={member} locations={locations} canEdit={access.staffAccess} canManageRoles={access.staffAccess} />}
            {access.helpdesk && (
              <EmployeeRequestsCard
                tickets={tickets}
                loading={ticketsQuery.isPending}
                error={ticketsQuery.isError}
                onRetry={() => void ticketsQuery.refetch()}
              />
            )}
            {employee && access.privacy && <PrivacyRequestsPanel employeeUserId={userId} tenantId={employee.tenantId} />}
          </>
        }
      >
        <SettingsSection>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <InitialsAvatar
              firstName={firstName || '?'}
              lastName={lastName}
              email={member?.email}
              className="size-24 shrink-0 rounded-xl text-3xl shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{member?.name ?? employee?.jobTitle ?? 'Employee'}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{profileLine}</p>
              {member && (
                <p className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                  <Mail size={15} aria-hidden="true" />
                  <span className="truncate">{member.email}</span>
                  <Badge variant={member.isActive ? 'success' : 'muted'}>{member.isActive ? 'Active' : 'Can’t sign in'}</Badge>
                </p>
              )}
            </div>
          </div>
          {employee && (
            <div className="mt-6">
              <GlanceFacts userId={userId} employee={employee} access={access} currency={currency} onOpenSection={onOpenSection} />
            </div>
          )}
        </SettingsSection>

        {employee ? (
          <EmploymentPanel userId={userId} employee={employee} canSeePay={access.money} currency={currency} country={payroll?.payrollCountry ?? null} />
        ) : (
          <SettingsSection title="Account only">
            <p className="text-sm leading-relaxed text-muted-foreground">
              This login has no linked employment record. Don’t schedule or pay this person until onboarding is complete.
            </p>
          </SettingsSection>
        )}
      </SettingsTabBody>
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
  const reduceMotion = useReducedMotion();
  const [asOf] = useState(() => new Date());
  const [open, setOpen] = useState(false);

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
  const worst: RecordAttentionSeverity = items.some((item) => item.severity === 'blocking')
    ? 'blocking'
    : items.some((item) => item.severity === 'attention')
      ? 'attention'
      : 'info';

  if (canReadDocuments && documentsQuery.isPending) return <div className="h-16 animate-pulse rounded-lg bg-band/60" aria-hidden="true" />;

  if (canReadDocuments && documentsQuery.isError)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3" role="alert">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE.blocking)}>
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">The record checks couldn’t run</span>
          <span className="block text-xs text-muted-foreground">Documents didn’t load, so right-to-work and contract status are unknown.</span>
        </span>
        <Button variant="outline" size="sm" onClick={() => void documentsQuery.refetch()}>
          Try again
        </Button>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-momentum/10 text-momentum">
          <CheckCircle2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">This record is complete</span>
          <span className="block text-xs text-muted-foreground">
            All {checks.length} employment checks are done and nothing is waiting on a reply.
          </span>
        </span>
      </div>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-field">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE[worst])}>
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {items.length} {items.length === 1 ? 'thing needs' : 'things need'} you
            <span className="ml-2 font-normal text-muted-foreground">
              · {done.length} of {checks.length} checks done
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{items.map((item) => item.title).join(' · ')}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-rule/50"
          >
            <ul className="space-y-2 p-2">
              {items.map((item) => {
                const Icon = SEVERITY_ICON[item.severity];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onAction(item.target)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg border bg-background/60 px-3.5 py-3 text-left transition-colors hover:bg-band/40',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        item.severity === 'blocking' ? 'border-exception/35' : 'border-rule/60',
                      )}
                    >
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', SEVERITY_TILE[item.severity])}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-foreground sm:flex">
                        {item.actionLabel}
                        <ChevronRight
                          size={14}
                          className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {done.length > 0 && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule/45 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Done</span>
                {done.map((check) => (
                  <span key={check.id} className="inline-flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-momentum" aria-hidden="true" />
                    {check.label}
                  </span>
                ))}
              </p>
            )}
            <p className="border-t border-rule/45 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Operational checks only — tax registration, pension enrolment and starter paperwork are still done in payroll.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
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
      today: at.toISOString().slice(0, 10),
      horizon: new Date(at.getTime() + 28 * 86_400_000).toISOString().slice(0, 10),
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
    <dl className="grid gap-3 sm:grid-cols-2">
      <Fact
        icon={CalendarDays}
        label="Holiday left"
        value={
          entitlementsQuery.isPending ? '…' : entitlementsQuery.isError ? '—' : leave.hasEntitlement ? `${leave.remaining} days` : 'No allowance'
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
          value={rotaQuery.isPending ? '…' : rotaQuery.isError ? '—' : nextShift ? SHIFT_DAY.format(new Date(nextShift.startsAt)) : 'None planned'}
          hint={
            rotaQuery.isError
              ? 'Couldn’t be loaded'
              : nextShift
                ? `${SHIFT_TIME.format(new Date(nextShift.startsAt))}–${SHIFT_TIME.format(new Date(nextShift.endsAt))}${nextShift.location?.name ? ` · ${nextShift.location.name}` : ''}`
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
