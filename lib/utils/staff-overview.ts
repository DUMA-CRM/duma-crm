// ---------------------------------------------------------------------------
// What the staff workspace should put in front of a manager before anything
// else: the things that are wrong, ordered by what they cost.
//
// The rows are deliberately *aggregated* rather than one-per-person. A sixty
// person team with a stale rota would otherwise push sixty rows into a panel
// whose whole job is to be readable at a glance — the count is the signal, and
// the tab behind it is where the detail lives.
//
// Everything here is pure so it can be tested without a query client. The
// components fetch; this module decides what is worth saying.
// ---------------------------------------------------------------------------

import type { HrEmployee } from '@/lib/api/hr.service';
import type { PayrollRun } from '@/lib/api/payroll.service';
import type { HelpdeskTicket, LeaveRequest } from '@/lib/api/people-ops.service';
import type { ScheduledShift, VarianceRow } from '@/lib/api/scheduling.service';
import type { StaffProfile } from '@/lib/api/staff.service';
import type { ComplianceCheck } from '@/lib/utils/employee-compliance';
// Relative, not aliased: see the note in `employee-compliance.ts`.
import { ageBasedMinimumWage, employeeSetupChecks } from './employee-compliance.ts';

/** Consequence, not urgency: blocking means somebody cannot be paid or covered. */
export type StaffAttentionSeverity = 'blocking' | 'attention' | 'info';

export interface StaffAttentionItem {
  id: string;
  severity: StaffAttentionSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
}

const DAY_MS = 86_400_000;

/** Whole days between two instants, floored — "2 days" means at least 48 hours. */
export const daysBetween = (from: string | Date, to: Date): number =>
  Math.floor((to.getTime() - new Date(from).getTime()) / DAY_MS);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Record completeness ──────────────────────────────────────────────────────

/**
 * The setup checks that can be answered from the team list alone.
 *
 * `right-to-work` and `contract` are dropped because they are derived from an
 * employee's documents, and the API exposes documents only per-user
 * (`GET /hr/documents/user/:userId`). Asking for them across the team would be
 * one request per head, so the team-level view answers the questions it can and
 * the record page answers the rest. → UI-TD-024.
 */
const DOCUMENT_DERIVED = ['right-to-work', 'contract'];

export function coreSetupChecks(member: StaffProfile | null, employee: HrEmployee | null, asOf: Date): ComplianceCheck[] {
  return employeeSetupChecks(member, employee, [], asOf).filter((check) => !DOCUMENT_DERIVED.includes(check.id));
}

export interface TeamRecordState {
  /** Nobody can run payroll for these: no employment record, or no pay basis. */
  unpayable: StaffProfile[];
  /** Holds a rate, but one below the age-based statutory minimum. */
  belowMinimumWage: StaffProfile[];
  /** Complete enough to pay, but still missing something (NI, location scope). */
  incomplete: StaffProfile[];
  /** Mean completeness across the active team, 0–100. */
  averageProgress: number;
}

/**
 * Classify every active member by what their record is missing.
 *
 * Only active accounts are considered — a leaver with a half-finished record is
 * not a thing anyone needs to act on, and counting them would make the figure
 * grow forever.
 */
export function teamRecordState(staff: StaffProfile[], employees: HrEmployee[], asOf: Date): TeamRecordState {
  const byUserId = new Map(employees.map((employee) => [employee.userId, employee]));
  const active = staff.filter((member) => member.isActive);

  const unpayable: StaffProfile[] = [];
  const belowMinimumWage: StaffProfile[] = [];
  const incomplete: StaffProfile[] = [];
  let completed = 0;
  let total = 0;

  for (const member of active) {
    const employee = byUserId.get(member.userId) ?? null;
    const checks = coreSetupChecks(member, employee, asOf);
    total += checks.length;
    completed += checks.filter((check) => check.complete).length;

    const blocked = checks.some((check) => (check.id === 'profile' || check.id === 'pay') && !check.complete);
    if (blocked) unpayable.push(member);
    else if (checks.some((check) => !check.complete)) incomplete.push(member);

    // Read straight from the rate rather than inferring it from the check's
    // tone: this one is a legal exposure, and it should not depend on how a
    // shared helper happens to colour a row.
    const wage = employee?.payType === 'hourly' ? ageBasedMinimumWage(employee.dateOfBirth, asOf) : null;
    if (wage && Number(employee?.hourlyRate ?? 0) > 0 && Number(employee?.hourlyRate ?? 0) < wage.rate) {
      belowMinimumWage.push(member);
    }
  }

  return {
    unpayable,
    belowMinimumWage,
    incomplete,
    averageProgress: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
}

// ── Queue ageing ─────────────────────────────────────────────────────────────

/** A request nobody has decided yet, and how long it has waited. */
export const pendingLeave = (requests: LeaveRequest[]) => requests.filter((request) => request.status === 'pending');

export const openTickets = (tickets: HelpdeskTicket[]) =>
  tickets.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed');

/** Age in days of the longest-waiting item, or 0 when the queue is empty. */
export function oldestAgeDays(items: { createdAt: string }[], now: Date): number {
  return items.reduce((oldest, item) => Math.max(oldest, daysBetween(item.createdAt, now)), 0);
}

// ── Rota ─────────────────────────────────────────────────────────────────────

/** Rostered but never published, so nobody has been told to turn up. */
export const unpublishedShifts = (rota: ScheduledShift[]) => rota.filter((shift) => shift.status === 'draft');

export const noShows = (variance: VarianceRow[]) => variance.filter((row) => row.status === 'no_show');

// ── Payroll ──────────────────────────────────────────────────────────────────

/**
 * Runs that are frozen but not yet in employees' hands.
 *
 * This is the state the platform deliberately cannot leave on its own: gross
 * pay is settled, and someone has to key in the tax and National Insurance
 * from whatever actually runs payroll before anyone can see a payslip
 * (UI-ADR-011). Left unattended it is invisible — the run looks done on the
 * payroll tab, and the employee simply never receives anything.
 */
export const awaitingIssue = (runs: PayrollRun[]) => runs.filter((run) => run.status === 'finalised');

/** Lines on those runs still missing tax, National Insurance or net pay. */
export function linesAwaitingDeductions(runs: PayrollRun[]): number {
  return awaitingIssue(runs).reduce(
    (total, run) =>
      total + run.lines.filter((line) => line.taxDeducted === null || line.nationalInsurance === null || line.netPay === null).length,
    0,
  );
}

// ── Assembly ─────────────────────────────────────────────────────────────────

/**
 * Leave waiting longer than this reads as a decision nobody is making, rather
 * than a queue in motion. Staff need an answer to book anything.
 */
export const LEAVE_STALE_DAYS = 5;
/** A helpdesk ticket older than a working week has been forgotten. */
export const TICKET_STALE_DAYS = 7;

export interface StaffAttentionInput {
  now: Date;
  records?: TeamRecordState;
  coverGapCount?: number;
  unpublishedCount?: number;
  noShowCount?: number;
  leave?: LeaveRequest[];
  tickets?: HelpdeskTicket[];
  payrollRuns?: PayrollRun[];
}

/**
 * Build the attention list, worst first.
 *
 * Every input is optional because the panel is assembled per capability: a
 * store manager who cannot reach payroll never fetches the records, and a row
 * about them must not appear as "0" — it must not appear at all. `undefined`
 * therefore means "not asked", which is different from an empty array.
 */
export function buildStaffAttention(input: StaffAttentionInput): StaffAttentionItem[] {
  const { now, records, coverGapCount, unpublishedCount, noShowCount, leave, tickets, payrollRuns } = input;
  const items: StaffAttentionItem[] = [];

  if (coverGapCount) {
    items.push({
      id: 'cover-gaps',
      severity: 'blocking',
      title: `${plural(coverGapCount, 'shift')} uncovered right now`,
      detail: 'Someone rostered has not clocked in, or the slot was never assigned.',
      actionLabel: 'Open the rota',
      href: '/staff/rota',
    });
  }

  if (records?.belowMinimumWage.length) {
    const count = records.belowMinimumWage.length;
    items.push({
      id: 'below-minimum-wage',
      severity: 'blocking',
      title: `${plural(count, 'person', 'people')} paid below the statutory minimum`,
      detail: 'The hourly rate is under the age-based National Minimum Wage. Correct it before the next run.',
      actionLabel: 'Review pay',
      href: '/staff/team',
    });
  }

  if (records?.unpayable.length) {
    const count = records.unpayable.length;
    items.push({
      id: 'records-unpayable',
      severity: 'blocking',
      title: `${plural(count, 'person', 'people')} cannot be paid yet`,
      detail: 'An employment record or a pay basis is missing, so payroll will skip them.',
      actionLabel: 'Finish setup',
      href: '/staff/team',
    });
  }

  const waiting = leave ? pendingLeave(leave) : [];
  if (waiting.length) {
    const oldest = oldestAgeDays(waiting, now);
    items.push({
      id: 'leave-pending',
      severity: oldest >= LEAVE_STALE_DAYS ? 'blocking' : 'attention',
      title: `${plural(waiting.length, 'leave request')} awaiting a decision`,
      detail: oldest > 0 ? `The oldest has waited ${plural(oldest, 'day')}.` : 'Raised today.',
      actionLabel: 'Review leave',
      href: '/staff/requests',
    });
  }

  const unissued = payrollRuns ? awaitingIssue(payrollRuns) : [];
  if (unissued.length) {
    const pending = linesAwaitingDeductions(payrollRuns!);
    items.push(
      pending > 0
        ? {
            id: 'payroll-deductions',
            severity: 'blocking',
            title: `${plural(pending, 'payslip')} waiting on tax and NI figures`,
            detail: 'A run is finalised but cannot be issued until the deductions are entered.',
            actionLabel: 'Open payroll',
            href: '/staff/payroll',
          }
        : {
            id: 'payroll-unissued',
            severity: 'attention',
            title: `${plural(unissued.length, 'payroll run')} ready to issue`,
            detail: 'Every line is complete. Issuing publishes the payslips to employees.',
            actionLabel: 'Issue payslips',
            href: '/staff/payroll',
          },
    );
  }

  if (unpublishedCount) {
    items.push({
      id: 'rota-unpublished',
      severity: 'attention',
      title: `${plural(unpublishedCount, 'shift')} rostered but not published`,
      detail: 'Draft shifts are invisible to staff until the rota is published.',
      actionLabel: 'Publish the rota',
      href: '/staff/rota',
    });
  }

  const open = tickets ? openTickets(tickets) : [];
  const stale = open.filter((ticket) => daysBetween(ticket.createdAt, now) >= TICKET_STALE_DAYS);
  if (stale.length) {
    items.push({
      id: 'tickets-stale',
      severity: 'attention',
      title: `${plural(stale.length, 'request')} open for over a week`,
      detail: 'Nobody has closed these out.',
      actionLabel: 'Open the helpdesk',
      href: '/staff/helpdesk',
    });
  } else if (open.length) {
    items.push({
      id: 'tickets-open',
      severity: 'info',
      title: `${plural(open.length, 'open request')}`,
      detail: 'Waiting on a reply from the team.',
      actionLabel: 'Open the helpdesk',
      href: '/staff/helpdesk',
    });
  }

  if (noShowCount) {
    items.push({
      id: 'no-shows',
      severity: 'attention',
      title: `${plural(noShowCount, 'no-show')} in the last week`,
      detail: 'A rostered shift nobody worked. Check whether the record needs correcting.',
      actionLabel: 'Open the rota',
      href: '/staff/rota',
    });
  }

  if (records?.incomplete.length) {
    const count = records.incomplete.length;
    items.push({
      id: 'records-incomplete',
      severity: 'info',
      title: `${plural(count, 'record')} still incomplete`,
      detail: 'Payable, but missing an NI number or a location assignment.',
      actionLabel: 'Review the team',
      href: '/staff/team',
    });
  }

  const ORDER: Record<StaffAttentionSeverity, number> = { blocking: 0, attention: 1, info: 2 };
  return items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
