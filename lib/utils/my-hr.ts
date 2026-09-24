import type { HrEmployee } from '@/lib/modules/people/client';
import type { AttendanceDay, EmployeeDocument, HelpdeskTicket, LeaveEntitlement, Payslip } from '@/lib/modules/people/client';

// Relative, not aliased: `node --experimental-strip-types` erases type-only
// imports but resolves value ones, and the test runner has no path mapping.
import { formatDate } from './date.ts';

/**
 * Employee-facing counterpart to `employee-compliance.ts`, which reads the same
 * UK obligations from the employer's side. Everything here is pure so the rules
 * that decide what an employee is told can be tested without a browser.
 */

// ── The "needs you" feed ──────────────────────────────────────────────────────

/** `blocking` stops something happening to the employee (pay, safety); `attention` is a deadline; `info` is a receipt. */
export type ActionSeverity = 'blocking' | 'attention' | 'info';

/** Where the action sends you: a tab, or a form to open. */
export type ActionTarget = 'details' | 'bank' | 'documents' | 'requests' | 'time' | 'pay';

export interface MyHrAction {
  id: string;
  severity: ActionSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  target: ActionTarget;
}

const SEVERITY_ORDER: Record<ActionSeverity, number> = { blocking: 0, attention: 1, info: 2 };

/** Documents whose absence or expiry has legal weight, matched on type or title. */
const matchDocument = (documents: EmployeeDocument[], needle: string) =>
  documents.find((document) => `${document.documentType} ${document.title}`.toLowerCase().includes(needle));

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000);

/**
 * What the employee has to do something about, most urgent first.
 *
 * Ordered by consequence, not by section: an employee who cannot be paid should
 * read that before a leave request that is merely waiting on a manager.
 */
export function myHrActions(input: {
  employee?: HrEmployee | null;
  hasBankDetails?: boolean;
  documents?: EmployeeDocument[];
  tickets?: HelpdeskTicket[];
  /** Injected so the rules are testable and stable across a render. */
  now?: Date;
}): MyHrAction[] {
  const { employee, hasBankDetails, documents = [], tickets = [], now = new Date() } = input;
  const actions: MyHrAction[] = [];

  if (employee && hasBankDetails === false)
    actions.push({
      id: 'bank',
      severity: 'blocking',
      title: 'Add your bank details',
      detail: 'Payroll has no account to pay into. Your next payslip cannot be paid without them.',
      actionLabel: 'Add bank details',
      target: 'bank',
    });

  if (employee && !employee.hasNiNumber)
    actions.push({
      id: 'ni',
      severity: 'blocking',
      title: 'Add your National Insurance number',
      detail: 'Without it your tax code may default to an emergency rate and you could be overtaxed.',
      actionLabel: 'Add NI number',
      target: 'bank',
    });

  if (employee && !(employee.emergencyContactName && employee.emergencyContactPhone))
    actions.push({
      id: 'emergency-contact',
      severity: 'blocking',
      title: 'Add an emergency contact',
      detail: 'Nobody can be reached on your behalf if something happens to you at work.',
      actionLabel: 'Add contact',
      target: 'details',
    });

  if (employee && !employee.address)
    actions.push({
      id: 'address',
      severity: 'attention',
      title: 'Add your home address',
      detail: 'Your employer needs a current address for payroll records and post.',
      actionLabel: 'Add address',
      target: 'details',
    });

  // Right to work: expiry is a hard stop on continued employment, so it outranks
  // every other document.
  const rightToWork = matchDocument(documents, 'right to work');
  if (rightToWork?.expiresAt) {
    const days = daysBetween(now, new Date(rightToWork.expiresAt));
    if (days < 0)
      actions.push({
        id: 'right-to-work-expired',
        severity: 'blocking',
        title: 'Your right-to-work evidence has expired',
        detail: `It expired on ${formatDate(rightToWork.expiresAt)}. Speak to HR straight away to complete a follow-up check.`,
        actionLabel: 'Message HR',
        target: 'requests',
      });
    else if (days <= 60)
      actions.push({
        id: 'right-to-work-expiring',
        severity: 'attention',
        title: 'Your right-to-work evidence expires soon',
        detail: `It expires on ${formatDate(rightToWork.expiresAt)} — ${days} day${days === 1 ? '' : 's'} away.`,
        actionLabel: 'Message HR',
        target: 'requests',
      });
  }

  // ERA 1996 s.1: a written statement of particulars is a day-one right.
  if (employee && !matchDocument(documents, 'contract') && !matchDocument(documents, 'statement'))
    actions.push({
      id: 'written-particulars',
      severity: 'attention',
      title: 'No employment contract on file',
      detail: 'You have a legal right to a written statement of your employment particulars. Ask HR for a copy.',
      actionLabel: 'Request a copy',
      target: 'requests',
    });

  // Any other document running out — certificates, training, DBS.
  documents
    .filter((document) => document.id !== rightToWork?.id && document.expiresAt)
    .forEach((document) => {
      const days = daysBetween(now, new Date(document.expiresAt!));
      if (days > 60) return;
      actions.push({
        id: `document-${document.id}`,
        severity: days < 0 ? 'attention' : 'info',
        title: days < 0 ? `${document.title} has expired` : `${document.title} expires soon`,
        detail:
          days < 0
            ? `Expired ${formatDate(document.expiresAt!)}. You may not be able to work shifts that require it.`
            : `Expires ${formatDate(document.expiresAt!)} — ${days} day${days === 1 ? '' : 's'} away.`,
        actionLabel: 'View documents',
        target: 'documents',
      });
    });

  tickets
    .filter((ticket) => ticket.status === 'waiting_employee')
    .forEach((ticket) =>
      actions.push({
        id: `ticket-${ticket.id}`,
        severity: 'attention',
        title: 'HR is waiting for your reply',
        detail: ticket.subject,
        actionLabel: 'Open request',
        target: 'requests',
      }),
    );

  return actions.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// ── Payslips ──────────────────────────────────────────────────────────────────

export interface PayslipLine {
  label: string;
  amount: number;
}

/**
 * The itemised deductions ERA 1996 s.8 requires a pay statement to show.
 * Zero-value deductions are dropped — an empty line is not an itemisation.
 */
export function payslipDeductions(payslip: Payslip): PayslipLine[] {
  const lines: PayslipLine[] = [
    { label: 'Income tax (PAYE)', amount: Number(payslip.taxDeducted ?? 0) },
    { label: 'National Insurance', amount: Number(payslip.nationalInsurance ?? 0) },
    { label: 'Pension', amount: Number(payslip.pensionDeduction ?? 0) },
    { label: 'Other deductions', amount: Number(payslip.otherDeductions ?? 0) },
  ];
  return lines.filter((line) => Number.isFinite(line.amount) && line.amount > 0);
}

/**
 * True when gross minus the itemised deductions does not reconcile to net.
 * Surfaced to the employee rather than hidden: a statement that does not add up
 * is exactly what they should be querying with payroll.
 */
export function payslipReconciles(payslip: Payslip): boolean {
  const deducted = payslipDeductions(payslip).reduce((sum, line) => sum + line.amount, 0);
  const expected = Number(payslip.grossPay ?? 0) - deducted;
  return Math.abs(expected - Number(payslip.netPay ?? 0)) < 0.01;
}

/**
 * Hours worked inside a pay period, from the employee's own attendance record.
 *
 * ERA 1996 s.9 requires the number of hours to be shown where pay varies with
 * hours worked. Derived from `/hr/attendance/me`, which an employee can always
 * read — the richer `/hr/employees/{userId}/hours` endpoint is manager-scoped.
 */
export function payPeriodHours(attendance: AttendanceDay[], start: string, end: string): number {
  const from = start.slice(0, 10);
  const to = end.slice(0, 10);
  const minutes = attendance
    .filter((day) => day.date >= from && day.date <= to)
    .reduce((sum, day) => sum + (Number(day.workedMinutes) || 0), 0);
  return Math.round((minutes / 60) * 100) / 100;
}

/** Pay varies with hours for anyone not on a fixed salary — they get the s.9 breakdown. */
export const payVariesWithHours = (employee?: HrEmployee | null): boolean =>
  !!employee && (employee.payType === 'hourly' || employee.employmentType === 'zero_hours');

// ── Attendance ────────────────────────────────────────────────────────────────

export interface AttendanceWeek {
  /** ISO date of the Monday. */
  weekStart: string;
  /** ISO date of the Sunday. */
  weekEnd: string;
  days: AttendanceDay[];
  workedHours: number;
  plannedHours: number;
}

const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
// Midday, so a DST boundary can never roll the date back or forward a day.
const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const isoOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The Monday on or before a date. Weeks start Monday — the rota does too. */
export function weekStartOf(iso: string): string {
  const date = atNoon(iso);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoOf(date);
}

/**
 * A shift that has not happened yet cannot be counted as hours owed or missed.
 * Totals therefore describe what has already run — otherwise a rota published
 * to the end of the month reads as though the employee is dozens of hours short.
 */
const isElapsed = (day: AttendanceDay) => day.status !== 'scheduled';

/**
 * Attendance grouped into rota weeks, oldest first.
 *
 * Days with no shift are dropped rather than rendered: an attendance record is
 * the days you were meant to work, and listing the other twenty tells the
 * employee nothing while burying the ones that matter.
 */
export function groupAttendanceByWeek(days: AttendanceDay[]): AttendanceWeek[] {
  const weeks = new Map<string, AttendanceWeek>();

  for (const day of [...days].filter((d) => d.status !== 'no_shift').sort((a, b) => a.date.localeCompare(b.date))) {
    const weekStart = weekStartOf(day.date);
    let week = weeks.get(weekStart);
    if (!week) {
      const end = atNoon(weekStart);
      end.setDate(end.getDate() + 6);
      week = { weekStart, weekEnd: isoOf(end), days: [], workedHours: 0, plannedHours: 0 };
      weeks.set(weekStart, week);
    }
    week.days.push(day);
    if (isElapsed(day)) {
      week.workedHours += Number(day.workedMinutes) || 0;
      week.plannedHours += Number(day.plannedMinutes) || 0;
    }
  }

  return [...weeks.values()]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((week) => ({ ...week, workedHours: toHours(week.workedHours), plannedHours: toHours(week.plannedHours) }));
}

/** Worked against rostered across the days that have already run, in hours. */
export function attendanceTotals(days: AttendanceDay[]) {
  const elapsed = days.filter(isElapsed);
  const worked = elapsed.reduce((sum, day) => sum + (Number(day.workedMinutes) || 0), 0);
  const planned = elapsed.reduce((sum, day) => sum + (Number(day.plannedMinutes) || 0), 0);
  return { workedHours: toHours(worked), plannedHours: toHours(planned), varianceHours: toHours(worked - planned) };
}

/** Just enough of a scheduled shift to place it on a calendar. */
export interface RosterSlot {
  startsAt: string;
  endsAt: string;
}

/** Just enough of an absence log to place it on a calendar. */
export interface AbsenceMark {
  date: string;
  isHalfDay?: boolean;
  reason?: string | null;
}

/** An attendance day, plus whether absence was logged against it. */
export interface AttendanceDayWithAbsence extends AttendanceDay {
  absence?: { isHalfDay: boolean; reason?: string | null };
}

/**
 * Tags the days an absence was logged against, so the calendar can show them.
 *
 * The mark rides alongside the attendance status rather than replacing it: a
 * day somebody worked short while unwell is still a day they worked, and the
 * hours are what they will be paid on. Days with no attendance record at all
 * get an entry so the absence is visible rather than falling through a gap.
 */
export function mergeAbsenceDays(days: AttendanceDay[], absences: AbsenceMark[]): AttendanceDayWithAbsence[] {
  if (absences.length === 0) return days;

  const marks = new Map(absences.map((a) => [a.date.slice(0, 10), { isHalfDay: !!a.isHalfDay, reason: a.reason ?? null }]));
  const merged: AttendanceDayWithAbsence[] = days.map((day) => {
    const mark = marks.get(day.date);
    return mark ? { ...day, absence: mark } : day;
  });

  const known = new Set(days.map((day) => day.date));
  for (const [date, mark] of marks) {
    if (known.has(date)) continue;
    merged.push({ date, status: 'no_shift', plannedMinutes: 0, workedMinutes: 0, absence: mark });
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Folds the published rota into the attendance record so upcoming shifts show
 * on the calendar too.
 *
 * The attendance endpoint describes what happened; days still to come may not
 * appear in it at all. A rostered day is only added where attendance has
 * nothing to say — a real record of the day always wins, so a shift somebody
 * missed never gets overwritten by the plan that says they should be there.
 */
export function mergeRosteredDays(attendance: AttendanceDay[], roster: RosterSlot[]): AttendanceDay[] {
  const recorded = new Map(attendance.map((day) => [day.date, day]));
  const planned = new Map<string, number>();

  for (const slot of roster) {
    const date = isoOf(new Date(slot.startsAt));
    const minutes = Math.max(0, (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000);
    planned.set(date, (planned.get(date) ?? 0) + minutes);
  }

  const merged = [...attendance];
  for (const [date, plannedMinutes] of planned) {
    const existing = recorded.get(date);
    if (existing && existing.status !== 'no_shift') continue;
    merged.push({ date, status: 'scheduled', plannedMinutes, workedMinutes: 0 });
  }

  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Leave ─────────────────────────────────────────────────────────────────────

export function leaveBalance(entitlements: LeaveEntitlement[]) {
  const holiday = entitlements[0];
  const total = Number(holiday?.totalDays ?? 0);
  const used = Number(holiday?.usedDays ?? 0);
  return { total, used, remaining: Math.round((total - used) * 100) / 100, hasEntitlement: !!holiday };
}

// ── Validation for the fields an employee edits about themselves ──────────────

/** Wrong bank details mean unpaid wages, so these are checked before submit, not after. */
export const normaliseSortCode = (value: string) => value.replace(/\D/g, '').slice(0, 6);
export const formatSortCode = (value: string) => {
  const digits = normaliseSortCode(value);
  return digits.replace(/(\d{2})(?=\d)/g, '$1-');
};
export const isValidSortCode = (value: string) => normaliseSortCode(value).length === 6;

export const normaliseAccountNumber = (value: string) => value.replace(/\D/g, '').slice(0, 8);
export const isValidAccountNumber = (value: string) => normaliseAccountNumber(value).length === 8;

/**
 * HMRC's National Insurance number format: two prefix letters (excluding D, F,
 * I, Q, U, V, plus O in second place), six digits, and a final letter A–D.
 * The listed prefixes are administratively reserved and never issued.
 */
const RESERVED_NI_PREFIXES = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ'];
export const normaliseNiNumber = (value: string) => value.replace(/\s/g, '').toUpperCase().slice(0, 9);
export const formatNiNumber = (value: string) => {
  const ni = normaliseNiNumber(value);
  return [ni.slice(0, 2), ni.slice(2, 4), ni.slice(4, 6), ni.slice(6, 8), ni.slice(8, 9)].filter(Boolean).join(' ');
};
export function isValidNiNumber(value: string): boolean {
  const ni = normaliseNiNumber(value);
  if (!/^[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(ni)) return false;
  return !RESERVED_NI_PREFIXES.includes(ni.slice(0, 2));
}
