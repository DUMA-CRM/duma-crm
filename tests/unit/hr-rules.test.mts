// Some of these helpers read the runtime's local calendar; pin it to the UK's.
process.env.TZ = 'Europe/London';

import assert from 'node:assert/strict';
import test from 'node:test';

import type { PayrollRun } from '../../lib/api/payroll.service.ts';
import type { AttendanceDay, Payslip } from '../../lib/api/people-ops.service.ts';
import { findAttendanceIssues, findCoverGaps } from '../../lib/utils/attendance.ts';
import { UK_MINIMUM_WAGE_2026, ageBasedMinimumWage, ageOn, employeeSetupChecks } from '../../lib/utils/employee-compliance.ts';
import {
  attendanceTotals,
  formatNiNumber,
  formatSortCode,
  groupAttendanceByWeek,
  isValidAccountNumber,
  isValidNiNumber,
  isValidSortCode,
  leaveBalance,
  leaveKind,
  payPeriodHours,
  payslipDeductions,
  payslipReconciles,
  payslipYearSummary,
  splitLeaveRequests,
  weekStartOf,
} from '../../lib/utils/my-hr.ts';
import { combineBlockedReason, groupByPeriod, hasDuplicates, suggestSurvivor } from '../../lib/utils/payroll-duplicates.ts';
import { reconcileClockEntries } from '../../lib/utils/shift-reconciliation.ts';
import type { TradingDay } from '../../lib/utils/trading-day.ts';

type Loose<T> = Parameters<(value: T) => void>[0];
const as = <T,>(value: unknown) => value as Loose<T>;

// ── Payroll duplicates ───────────────────────────────────────────────────────

const run = (id: string, patch: Record<string, unknown> = {}) =>
  as<PayrollRun>({
    id,
    period: 'weekly',
    periodStart: '2026-11-16',
    periodEnd: '2026-11-22',
    status: 'finalised',
    finalisedAt: null,
    createdAt: '2026-11-23T09:00:00Z',
    lines: [{ netPay: null, items: [] }],
    ...patch,
  });

test('payroll runs group by the period they cover, newest first, superseded kept as history', () => {
  const groups = groupByPeriod([
    run('old', { periodStart: '2026-11-09', periodEnd: '2026-11-15' }),
    run('a', { finalisedAt: '2026-11-23T10:00:00Z' }),
    run('b', { finalisedAt: '2026-11-23T12:00:00Z' }),
    run('gone', { status: 'superseded' }),
  ]);
  assert.deepEqual(
    groups.map((group) => [group.periodEnd, group.runs.map((r) => r.id), group.active.map((r) => r.id)]),
    [
      ['2026-11-22', ['b', 'a', 'gone'], ['b', 'a']],
      ['2026-11-15', ['old'], ['old']],
    ],
  );
  assert.equal(hasDuplicates(groups[0]!), true);
  assert.equal(hasDuplicates(groups[1]!), false);
});

test('the run suggested to survive: issued, then the one with deductions entered, then the newest', () => {
  const [newest] = groupByPeriod([run('a', { finalisedAt: '2026-11-23T10:00:00Z' }), run('b', { finalisedAt: '2026-11-23T12:00:00Z' })]);
  assert.equal(suggestSurvivor(newest!)?.id, 'b');

  const [entered] = groupByPeriod([
    run('a', { finalisedAt: '2026-11-23T10:00:00Z', lines: [{ netPay: '400.00', items: [] }] }),
    run('b', { finalisedAt: '2026-11-23T12:00:00Z' }),
  ]);
  assert.equal(suggestSurvivor(entered!)?.id, 'a');

  const [issued] = groupByPeriod([
    run('a', { finalisedAt: '2026-11-23T10:00:00Z', lines: [{ netPay: '400.00', items: [] }] }),
    run('b', { status: 'issued', finalisedAt: '2026-11-22T12:00:00Z' }),
  ]);
  assert.equal(suggestSurvivor(issued!)?.id, 'b');
  assert.match(combineBlockedReason(issued!) ?? '', /issued to employees/);
  assert.equal(combineBlockedReason(newest!), null);

  const [allIssued] = groupByPeriod([run('a', { status: 'issued' }), run('b', { status: 'issued' })]);
  assert.match(combineBlockedReason(allIssued!) ?? '', /^Every run/);
  const [onlySuperseded] = groupByPeriod([run('a', { status: 'superseded' })]);
  assert.equal(suggestSurvivor(onlySuperseded!), null);
});

// ── Employee compliance ──────────────────────────────────────────────────────

test('age turns on the birthday itself, and a 29 February birthday turns on 1 March', () => {
  assert.equal(ageOn('2008-11-24', new Date('2026-11-24T10:00:00Z')), 18);
  assert.equal(ageOn('2008-11-25', new Date('2026-11-24T10:00:00Z')), 17);
  assert.equal(ageOn('2008-02-29', new Date('2026-02-28T10:00:00Z')), 17);
  assert.equal(ageOn('2008-02-29', new Date('2026-03-01T10:00:00Z')), 18);
});

test('the UK minimum wage band follows age at the date, and only applies to UK payroll', () => {
  const on = new Date('2026-11-24T10:00:00Z');
  assert.deepEqual(ageBasedMinimumWage('2005-11-24', on), { age: 21, rate: UK_MINIMUM_WAGE_2026.age21AndOver, label: 'Age 21+', effectiveFrom: '2026-04-01' });
  assert.deepEqual(ageBasedMinimumWage('2005-11-25', on), { age: 20, rate: UK_MINIMUM_WAGE_2026.age18To20, label: 'Age 18–20', effectiveFrom: '2026-04-01' });
  assert.equal(ageBasedMinimumWage('2008-11-24', on)?.rate, 10.85);
  assert.equal(ageBasedMinimumWage('2008-11-25', on)?.rate, 8);
  assert.equal(ageBasedMinimumWage('2008-11-25', on, 'GB')?.label, 'Under 18');
  assert.equal(ageBasedMinimumWage('1990-01-01', on, 'PL'), null);
  // Before 1 April 2026 the 2025 rates apply, not next year's.
  assert.equal(ageBasedMinimumWage('1990-01-01', new Date(2026, 2, 31, 12))?.rate, 12.21);
  assert.equal(ageBasedMinimumWage('1990-01-01', new Date(2026, 3, 1, 12))?.rate, 12.71);
  assert.equal(ageBasedMinimumWage(undefined, on), null);
});

test('an hourly rate under the age band fails the pay check; salaried staff are not held to an hourly band', () => {
  const on = new Date('2026-11-24T10:00:00Z');
  const pay = (employee: Record<string, unknown>, country: string | null = 'GB') =>
    employeeSetupChecks(null, as<Parameters<typeof employeeSetupChecks>[1]>(employee), [], on, country).find((check) => check.id === 'pay')!;
  const under = pay({ payType: 'hourly', hourlyRate: '12.70', dateOfBirth: '2000-01-01' });
  assert.equal(under.complete, false);
  assert.equal(under.tone, 'destructive');
  assert.match(under.detail, /£12\.71/);
  assert.equal(pay({ payType: 'hourly', hourlyRate: '12.71', dateOfBirth: '2000-01-01' }).complete, true);
  assert.equal(pay({ payType: 'hourly', hourlyRate: '10.85', dateOfBirth: '2007-01-01' }).complete, true);
  assert.equal(pay({ payType: 'hourly', hourlyRate: '9.00', dateOfBirth: '2000-01-01' }, 'PL').complete, true);
  assert.equal(pay({ payType: 'salary', annualSalary: '24000' }).complete, true);
  assert.equal(pay({ payType: 'hourly', hourlyRate: '0' }).tone, 'warning');
});

test('right to work evidence that has expired fails the check', () => {
  const on = new Date('2026-11-24T10:00:00Z');
  const rtw = (expiresAt: string | null) =>
    employeeSetupChecks(
      null,
      null,
      [as<Parameters<typeof employeeSetupChecks>[2]>({ documentType: 'right_to_work', title: 'Right to work', expiresAt })].flat() as never,
      on,
    ).find((check) => check.id === 'right-to-work')!;
  assert.equal(rtw('2026-11-23T00:00:00Z').tone, 'destructive');
  assert.equal(rtw('2027-01-01T00:00:00Z').complete, true);
  assert.equal(rtw(null).complete, true);
});

// ── My HR: payslips ──────────────────────────────────────────────────────────

const payslip = (patch: Partial<Payslip> = {}): Payslip => ({
  id: 'p',
  userId: 'u',
  payPeriodStart: '2026-10-01',
  payPeriodEnd: '2026-10-31',
  grossPay: '1000.00',
  netPay: '879.60',
  taxDeducted: '0',
  currency: 'GBP',
  status: 'finalised',
  createdAt: '2026-11-01T00:00:00Z',
  deductions: [
    { label: 'Income tax', kind: 'tax', paidBy: 'employee', amount: '120.40' },
    { label: 'Employer NI', kind: 'social', paidBy: 'employer', amount: '80.00' },
    { label: 'Student loan', kind: 'other', paidBy: 'employee', amount: '0.00' },
  ],
  ...patch,
});

test('a payslip itemises only the employee’s own non-zero deductions, legacy columns included', () => {
  assert.deepEqual(payslipDeductions(payslip()), [{ label: 'Income tax', amount: 120.4 }]);
  assert.deepEqual(
    payslipDeductions(payslip({ deductions: [], taxDeducted: '50.00', nationalInsurance: '20.50', pensionDeduction: null })),
    [
      { label: 'Income tax (PAYE)', amount: 50 },
      { label: 'National Insurance', amount: 20.5 },
    ],
  );
});

test('a payslip reconciles when gross less deductions is net, and a penny out is flagged', () => {
  assert.equal(payslipReconciles(payslip()), true);
  assert.equal(payslipReconciles(payslip({ netPay: '879.59' })), false);
  assert.equal(payslipReconciles(payslip({ netPay: '880.60' })), false);
});

test('the year’s payslips sum in pence, finalised only, by the year the period ended', () => {
  const summary = payslipYearSummary(
    [
      payslip(),
      payslip({ id: 'q', grossPay: '0.10', netPay: '0.20' }),
      payslip({ id: 'draft', status: 'draft' }),
      payslip({ id: 'last-year', payPeriodEnd: '2025-12-31' }),
    ],
    2026,
  );
  assert.deepEqual(summary, { count: 2, gross: 1000.1, net: 879.8, deductions: 240.8, employer: 160 });
});

test('hours in a pay period come from the days inside it', () => {
  const days: AttendanceDay[] = [
    { date: '2026-09-30', status: 'full', plannedMinutes: 480, workedMinutes: 480 },
    { date: '2026-10-01', status: 'full', plannedMinutes: 90, workedMinutes: 90 },
    { date: '2026-10-31', status: 'partial', plannedMinutes: 60, workedMinutes: 45 },
  ];
  assert.equal(payPeriodHours(days, '2026-10-01T00:00:00Z', '2026-10-31'), 2.25);
});

// ── My HR: attendance and leave ──────────────────────────────────────────────

test('attendance weeks start on Monday, across a clock change, and count only what has run', () => {
  assert.equal(weekStartOf('2026-10-25'), '2026-10-19');
  assert.equal(weekStartOf('2026-10-26'), '2026-10-26');
  assert.equal(weekStartOf('2026-03-29'), '2026-03-23');
  const weeks = groupAttendanceByWeek([
    { date: '2026-11-30', status: 'scheduled', plannedMinutes: 480, workedMinutes: 0 },
    { date: '2026-11-23', status: 'full', plannedMinutes: 480, workedMinutes: 480 },
    { date: '2026-11-25', status: 'no_shift', plannedMinutes: 0, workedMinutes: 0 },
    { date: '2026-11-29', status: 'partial', plannedMinutes: 240, workedMinutes: 200 },
  ]);
  assert.deepEqual(
    weeks.map((week) => [week.weekStart, week.weekEnd, week.days.length, week.workedHours, week.plannedHours]),
    [
      ['2026-11-23', '2026-11-29', 2, 11.33, 12],
      ['2026-11-30', '2026-12-06', 1, 0, 0],
    ],
  );
  assert.deepEqual(
    attendanceTotals([
      { date: '2026-11-23', status: 'full', plannedMinutes: 480, workedMinutes: 450 },
      { date: '2026-11-30', status: 'scheduled', plannedMinutes: 480, workedMinutes: 0 },
    ]),
    { workedHours: 7.5, plannedHours: 8, varianceHours: -0.5 },
  );
});

test('leave balance and requests read the way an employee expects', () => {
  assert.deepEqual(leaveBalance(as<Parameters<typeof leaveBalance>[0]>([{ totalDays: '28', usedDays: '12.5' }])), {
    total: 28,
    used: 12.5,
    remaining: 15.5,
    hasEntitlement: true,
  });
  assert.equal(leaveBalance([]).hasEntitlement, false);

  const request = (id: string, startDate: string, endDate: string, status: 'pending' | 'approved' | 'declined' | 'cancelled') => ({
    id,
    startDate,
    endDate,
    status,
  });
  const { upcoming, history } = splitLeaveRequests(
    [
      request('taken', '2026-10-01', '2026-10-03', 'approved'),
      request('ahead', '2026-12-22', '2026-12-24', 'approved'),
      request('unanswered', '2026-11-01', '2026-11-02', 'pending'),
      request('today', '2026-11-20', '2026-11-24', 'approved'),
      request('refused', '2027-01-05', '2027-01-06', 'declined'),
    ],
    '2026-11-24',
  );
  assert.deepEqual(
    upcoming.map((r) => r.id),
    ['unanswered', 'today', 'ahead'],
  );
  assert.deepEqual(
    history.map((r) => r.id),
    ['refused', 'taken'],
  );
  assert.equal(leaveKind('Annual leave'), 'annual');
  assert.equal(leaveKind('Sickness'), 'sick');
  assert.equal(leaveKind('Jury service'), 'other');
});

test('bank and NI details are checked before submit — wrong ones mean unpaid wages', () => {
  assert.equal(formatSortCode('123456'), '12-34-56');
  assert.equal(formatSortCode('12-34-5'), '12-34-5');
  assert.equal(isValidSortCode('12 34 56'), true);
  assert.equal(isValidSortCode('12-34-5'), false);
  assert.equal(isValidAccountNumber('1234 5678'), true);
  assert.equal(isValidAccountNumber('1234567'), false);
  assert.equal(isValidNiNumber('ab 12 34 56 c'), true);
  assert.equal(formatNiNumber('ab123456c'), 'AB 12 34 56 C');
  for (const bad of ['QQ123456C', 'AO123456C', 'BG123456A', 'GB123456A', 'AB123456E', 'AB12345C']) {
    assert.equal(isValidNiNumber(bad), false, bad);
  }
});

// ── Attendance on the floor ──────────────────────────────────────────────────

const slot = (id: string, patch: Record<string, unknown> = {}) => ({
  id,
  userId: 'sam',
  status: 'published',
  startsAt: '2026-11-24T09:00:00Z',
  endsAt: '2026-11-24T17:00:00Z',
  staff: { user: { name: 'Sam' } },
  ...patch,
});
const onClock = (userId: string, clockedIn = '2026-11-24T08:55:00Z') => ({ id: `c-${userId}`, userId, clockedIn, staff: { name: userId } });

test('a cover gap is a published shift past its grace with nobody on it', () => {
  const gaps = (now: string, active: unknown[] = [], rota: unknown[] = [slot('s')]) =>
    findCoverGaps({ rota: as<Parameters<typeof findCoverGaps>[0]['rota']>(rota), activeShifts: as<never>(active), now: new Date(now) });
  assert.deepEqual(gaps('2026-11-24T09:09:00Z'), []);
  assert.deepEqual(
    gaps('2026-11-24T09:15:00Z').map((gap) => [gap.reason, gap.name, gap.minutesLate]),
    [['not-clocked-in', 'Sam', 15]],
  );
  assert.deepEqual(gaps('2026-11-24T09:15:00Z', [onClock('sam')]), []);
  assert.deepEqual(gaps('2026-11-24T17:01:00Z'), []);
  assert.equal(gaps('2026-11-24T10:00:00Z', [], [slot('s', { userId: null })])[0]?.reason, 'unassigned');
  assert.deepEqual(gaps('2026-11-24T10:00:00Z', [], [slot('s', { status: 'draft' })]), []);
});

test('on the clock after close, or with no rota slot covering now, is flagged', () => {
  const trading = { state: 'trading' } as TradingDay;
  const issues = (now: string, day: TradingDay, active: unknown[]) =>
    findAttendanceIssues({ activeShifts: as<never>(active), rota: as<never>([slot('s')]), day, now: new Date(now) }).map((issue) => [
      issue.shift.userId,
      issue.reason,
    ]);
  // Clocking in a little early is within the rota grace.
  assert.deepEqual(issues('2026-11-24T08:50:00Z', trading, [onClock('sam', '2026-11-24T08:45:00Z')]), []);
  assert.deepEqual(issues('2026-11-24T08:40:00Z', trading, [onClock('sam', '2026-11-24T08:30:00Z'), onClock('alex')]), [
    // Longest on the clock first.
    ['sam', 'off-rota'],
    ['alex', 'off-rota'],
  ]);
  assert.deepEqual(issues('2026-11-24T12:00:00Z', { state: 'after-close' } as TradingDay, [onClock('sam')]), [['sam', 'after-close']]);
});

test('clock entries reconcile to their own shift, else the nearest one that day by the local calendar', () => {
  const planned = as<Parameters<typeof reconcileClockEntries>[0]>([
    { id: 'morning', userId: 'sam', locationId: 'soho', startsAt: '2026-07-01T07:00:00Z' },
    { id: 'evening', userId: 'sam', locationId: 'soho', startsAt: '2026-07-01T16:00:00Z' },
  ]);
  const actual = as<Parameters<typeof reconcileClockEntries>[1]>([
    { id: 'linked', userId: 'sam', locationId: 'soho', scheduledShiftId: 'evening', clockedIn: '2026-07-01T06:00:00Z' },
    // 23:30 UTC on 30 June is 00:30 on 1 July in London: the same day as the shifts.
    { id: 'early', userId: 'sam', locationId: 'soho', clockedIn: '2026-06-30T23:30:00Z' },
    { id: 'late', userId: 'sam', locationId: 'soho', clockedIn: '2026-07-01T15:00:00Z' },
    { id: 'elsewhere', userId: 'sam', locationId: 'camden', clockedIn: '2026-07-01T07:00:00Z' },
    { id: 'other', userId: 'alex', locationId: 'soho', clockedIn: '2026-07-01T07:00:00Z' },
  ]);
  const { byShiftId, unplanned } = reconcileClockEntries(planned, actual);
  assert.deepEqual(
    byShiftId.get('morning')?.map((entry) => entry.id),
    ['early'],
  );
  assert.deepEqual(
    byShiftId.get('evening')?.map((entry) => entry.id),
    ['linked', 'late'],
  );
  assert.deepEqual(
    unplanned.map((entry) => entry.id),
    ['elsewhere', 'other'],
  );
});
