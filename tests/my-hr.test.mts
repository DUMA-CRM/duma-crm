import assert from 'node:assert/strict';
import test from 'node:test';

const {
  attendanceTotals,
  groupAttendanceByWeek,
  isValidAccountNumber,
  isValidNiNumber,
  isValidSortCode,
  formatNiNumber,
  formatSortCode,
  leaveBalance,
  mergeAbsenceDays,
  mergeRosteredDays,
  myHrActions,
  payPeriodHours,
  payVariesWithHours,
  payslipDeductions,
  payslipReconciles,
  weekStartOf,
} = await import('../lib/utils/my-hr.ts');

type ActionsInput = Parameters<typeof myHrActions>[0];
type Employee = NonNullable<ActionsInput['employee']>;
type Payslip = Parameters<typeof payslipDeductions>[0];

const NOW = new Date('2026-08-08T12:00:00Z');

// A record with nothing outstanding — each test breaks one thing.
const completeEmployee = (over: Partial<Employee> = {}): Employee =>
  ({
    id: 'e1',
    userId: 'u1',
    tenantId: 't1',
    jobTitle: 'Barista',
    employmentType: 'full_time',
    startDate: '2025-01-06',
    address: '1 High Street, Camden, NW1 1AA',
    emergencyContactName: 'Alex Doe',
    emergencyContactPhone: '07700 900000',
    emergencyContactRelation: 'Partner',
    hasNiNumber: true,
    isActive: true,
    createdAt: '2025-01-06',
    updatedAt: '2025-01-06',
    ...over,
  }) as Employee;

const doc = (over: Record<string, unknown> = {}) =>
  ({ id: 'd1', title: 'Contract of employment', documentType: 'contract', ...over }) as ActionsInput['documents'] extends (infer T)[]
    ? T
    : never;

const settled = (over: Partial<ActionsInput> = {}): ActionsInput => ({
  employee: completeEmployee(),
  hasBankDetails: true,
  documents: [doc()],
  now: NOW,
  ...over,
});

const ids = (input: ActionsInput) => myHrActions(input).map((action) => action.id);

// ── The needs-you rules ───────────────────────────────────────────────────────

test('a complete record raises nothing', () => {
  assert.deepEqual(ids(settled()), []);
});

test('missing bank details block pay, and are ranked above softer gaps', () => {
  const actions = myHrActions(settled({ hasBankDetails: false, employee: completeEmployee({ address: '' }) }));
  assert.equal(actions[0].id, 'bank');
  assert.equal(actions[0].severity, 'blocking');
  // The address gap is real but nobody goes unpaid over it.
  assert.equal(actions.at(-1)!.id, 'address');
  assert.equal(actions.at(-1)!.severity, 'attention');
});

test('a refused bank read is not reported as missing bank details', () => {
  // The bank endpoint is manager-scoped; `undefined` means "cannot tell".
  assert.equal(ids(settled({ hasBankDetails: undefined })).includes('bank'), false);
});

test('a missing NI number is flagged as blocking', () => {
  const actions = myHrActions(settled({ employee: completeEmployee({ hasNiNumber: false }) }));
  assert.equal(actions[0].id, 'ni');
  assert.match(actions[0].detail, /emergency rate/);
});

test('a half-filled emergency contact still counts as missing', () => {
  assert.equal(ids(settled({ employee: completeEmployee({ emergencyContactPhone: '' }) })).includes('emergency-contact'), true);
});

test('expired right-to-work outranks everything else and is blocking', () => {
  const actions = myHrActions(
    settled({
      hasBankDetails: false,
      documents: [doc(), doc({ id: 'd2', title: 'Passport', documentType: 'right to work', expiresAt: '2026-07-01' })],
    }),
  );
  const rtw = actions.find((action) => action.id === 'right-to-work-expired');
  assert.ok(rtw, 'expired right to work should be raised');
  assert.equal(rtw!.severity, 'blocking');
});

test('right to work expiring inside 60 days warns, beyond it does not', () => {
  const withExpiry = (expiresAt: string) =>
    ids(settled({ documents: [doc(), doc({ id: 'd2', title: 'Visa', documentType: 'right to work', expiresAt })] }));
  assert.equal(withExpiry('2026-09-15').includes('right-to-work-expiring'), true); // 38 days
  assert.equal(withExpiry('2026-12-01').includes('right-to-work-expiring'), false); // 115 days
});

test('no contract on file raises the written-particulars right', () => {
  assert.equal(ids(settled({ documents: [] })).includes('written-particulars'), true);
  // A written statement satisfies it just as a contract does.
  assert.equal(
    ids(settled({ documents: [doc({ title: 'Written statement of particulars', documentType: 'statement' })] })).includes(
      'written-particulars',
    ),
    false,
  );
});

test('an expiring certificate is raised once, and not double-counted as right to work', () => {
  const actions = myHrActions(
    settled({ documents: [doc(), doc({ id: 'd2', title: 'Food hygiene level 2', documentType: 'certificate', expiresAt: '2026-08-20' })] }),
  );
  assert.deepEqual(
    actions.map((action) => action.id),
    ['document-d2'],
  );
  assert.equal(actions[0].severity, 'info');
});

test('a ticket waiting on the employee, and a declined expense, both surface', () => {
  const actions = myHrActions(
    settled({
      tickets: [{ id: 't9', subject: 'Proof of address', status: 'waiting_employee' }] as ActionsInput['tickets'],
      expenses: [{ id: 'x1', description: 'Train fare', status: 'declined', reviewNotes: 'No receipt' }] as ActionsInput['expenses'],
    }),
  );
  assert.deepEqual(
    actions.map((action) => action.id),
    ['ticket-t9', 'expense-x1'],
  );
  // Severity ordering puts the thing HR is blocked on first.
  assert.equal(actions[0].severity, 'attention');
  assert.equal(actions[1].severity, 'info');
});

test('resolved tickets and approved expenses are silent', () => {
  assert.deepEqual(
    ids(
      settled({
        tickets: [{ id: 't1', subject: 'Done', status: 'resolved' }] as ActionsInput['tickets'],
        expenses: [{ id: 'x1', description: 'Taxi', status: 'approved' }] as ActionsInput['expenses'],
      }),
    ),
    [],
  );
});

// ── Payslips ──────────────────────────────────────────────────────────────────

const payslip = (over: Partial<Payslip> = {}): Payslip =>
  ({
    id: 'p1',
    userId: 'u1',
    payPeriodStart: '2026-07-01',
    payPeriodEnd: '2026-07-31',
    grossPay: '2000.00',
    netPay: '1500.00',
    taxDeducted: '300.00',
    nationalInsurance: '150.00',
    pensionDeduction: '50.00',
    otherDeductions: '0',
    currency: 'GBP',
    status: 'finalised',
    createdAt: '2026-08-01',
    ...over,
  }) as Payslip;

test('deductions are itemised, and zero-value ones are dropped', () => {
  const lines = payslipDeductions(payslip());
  assert.deepEqual(
    lines.map((line) => line.label),
    ['Income tax (PAYE)', 'National Insurance', 'Pension'],
  );
  assert.equal(
    lines.reduce((sum, line) => sum + line.amount, 0),
    500,
  );
});

test('a statement that does not add up is caught', () => {
  assert.equal(payslipReconciles(payslip()), true);
  assert.equal(payslipReconciles(payslip({ netPay: '1400.00' })), false);
  // Rounding to the penny must not trip the check.
  assert.equal(payslipReconciles(payslip({ grossPay: '2000.004', netPay: '1500.00' })), true);
});

test('hours are summed only inside the pay period', () => {
  const attendance = [
    { date: '2026-06-30', status: 'full', plannedMinutes: 480, workedMinutes: 480 },
    { date: '2026-07-01', status: 'full', plannedMinutes: 480, workedMinutes: 480 },
    { date: '2026-07-15', status: 'partial', plannedMinutes: 480, workedMinutes: 270 },
    { date: '2026-07-31', status: 'full', plannedMinutes: 480, workedMinutes: 450 },
    { date: '2026-08-01', status: 'full', plannedMinutes: 480, workedMinutes: 480 },
  ] as Parameters<typeof payPeriodHours>[0];
  // 480 + 270 + 450 = 1200 minutes = 20h; the June and August days are excluded.
  assert.equal(payPeriodHours(attendance, '2026-07-01', '2026-07-31'), 20);
  // Timestamps, not bare dates, must still match on the day.
  assert.equal(payPeriodHours(attendance, '2026-07-01T00:00:00Z', '2026-07-31T23:59:59Z'), 20);
});

test('the hours breakdown applies to variable pay only', () => {
  assert.equal(payVariesWithHours(completeEmployee({ payType: 'hourly' })), true);
  assert.equal(payVariesWithHours(completeEmployee({ payType: 'salaried', employmentType: 'zero_hours' })), true);
  assert.equal(payVariesWithHours(completeEmployee({ payType: 'salaried' })), false);
  assert.equal(payVariesWithHours(null), false);
});

// ── Attendance ────────────────────────────────────────────────────────────────

type Att = Parameters<typeof groupAttendanceByWeek>[0][number];
const att = (date: string, status: string, workedMinutes = 0, plannedMinutes = 0) =>
  ({ date, status, workedMinutes, plannedMinutes }) as Att;

test('weeks start on the Monday, and Sunday belongs to the week before it', () => {
  // 3 Aug 2026 is a Monday; 9 Aug is the Sunday that closes the same week.
  assert.equal(weekStartOf('2026-08-03'), '2026-08-03');
  assert.equal(weekStartOf('2026-08-09'), '2026-08-03');
  assert.equal(weekStartOf('2026-08-10'), '2026-08-10');
  // Crossing a month boundary backwards.
  assert.equal(weekStartOf('2026-08-01'), '2026-07-27');
});

test('attendance groups into rota weeks, oldest first, with hour totals', () => {
  const weeks = groupAttendanceByWeek([
    att('2026-08-10', 'full', 480, 480),
    att('2026-08-03', 'full', 480, 480),
    att('2026-08-09', 'partial', 270, 480),
    att('2026-08-05', 'missed', 0, 480),
  ]);

  assert.deepEqual(
    weeks.map((w) => w.weekStart),
    ['2026-08-03', '2026-08-10'],
  );
  assert.equal(weeks[0].weekEnd, '2026-08-09');
  // Days are ordered inside the week regardless of the order they arrived in.
  assert.deepEqual(
    weeks[0].days.map((d) => d.date),
    ['2026-08-03', '2026-08-05', '2026-08-09'],
  );
  assert.equal(weeks[0].workedHours, 12.5); // 480 + 0 + 270 minutes
  assert.equal(weeks[0].plannedHours, 24);
});

test('days with no shift are dropped rather than listed as blanks', () => {
  const weeks = groupAttendanceByWeek([att('2026-08-03', 'full', 480, 480), att('2026-08-04', 'no_shift'), att('2026-08-05', 'no_shift')]);
  assert.equal(weeks.length, 1);
  assert.deepEqual(
    weeks[0].days.map((d) => d.date),
    ['2026-08-03'],
  );
});

test('an empty month produces no weeks rather than an empty grid', () => {
  assert.deepEqual(groupAttendanceByWeek([]), []);
  assert.deepEqual(groupAttendanceByWeek([att('2026-08-04', 'no_shift')]), []);
});

test('month totals report the shortfall against rostered hours', () => {
  const totals = attendanceTotals([att('2026-08-03', 'full', 480, 480), att('2026-08-04', 'partial', 270, 480)]);
  assert.equal(totals.workedHours, 12.5);
  assert.equal(totals.plannedHours, 16);
  assert.equal(totals.varianceHours, -3.5);
  // Working beyond the roster reads as a positive variance, not an error.
  assert.equal(attendanceTotals([att('2026-08-03', 'full', 540, 480)]).varianceHours, 1);
});

test('shifts still to come are excluded from totals', () => {
  // Otherwise a rota published to month end reads as a huge shortfall.
  const totals = attendanceTotals([att('2026-08-03', 'full', 480, 480), att('2026-08-28', 'scheduled', 0, 480)]);
  assert.equal(totals.plannedHours, 8);
  assert.equal(totals.varianceHours, 0);
});

test('a week subtotal counts only the days that have run, but still lists the upcoming ones', () => {
  const [week] = groupAttendanceByWeek([att('2026-08-03', 'full', 480, 480), att('2026-08-07', 'scheduled', 0, 480)]);
  assert.equal(week.days.length, 2, 'the rostered day is still shown');
  assert.equal(week.workedHours, 8);
  assert.equal(week.plannedHours, 8, 'the future shift does not inflate the rostered figure');
});

// Local-format timestamps: parsed in the runner's zone, so the assertion holds
// wherever the tests run.
const slot = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });

test('the rota fills in days attendance has nothing to say about', () => {
  const merged = mergeRosteredDays(
    [att('2026-08-03', 'full', 480, 480)],
    [slot('2026-08-14T09:00:00', '2026-08-14T17:00:00'), slot('2026-08-15T12:00:00', '2026-08-15T16:30:00')],
  );
  assert.deepEqual(
    merged.map((d) => `${d.date}:${d.status}`),
    ['2026-08-03:full', '2026-08-14:scheduled', '2026-08-15:scheduled'],
  );
  assert.equal(merged[1].plannedMinutes, 480);
  assert.equal(merged[2].plannedMinutes, 270);
});

test('a recorded day always beats the rota that planned it', () => {
  // The rota says they should have been in; attendance says they were not.
  // Overwriting that would erase a missed shift from the employee's record.
  const merged = mergeRosteredDays([att('2026-08-03', 'missed', 0, 480)], [slot('2026-08-03T09:00:00', '2026-08-03T17:00:00')]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, 'missed');
});

test('absence is marked on the day it was logged, without changing what was recorded', () => {
  const merged = mergeAbsenceDays(
    [att('2026-08-03', 'missed', 0, 480), att('2026-08-04', 'partial', 240, 480)],
    [
      { date: '2026-08-03', reason: 'Flu' },
      { date: '2026-08-04', isHalfDay: true },
    ],
  );
  // The attendance reading survives — the hours are what pay is calculated on.
  assert.equal(merged[0].status, 'missed');
  assert.equal(merged[0].absence?.reason, 'Flu');
  assert.equal(merged[1].status, 'partial');
  assert.equal(merged[1].workedMinutes, 240);
  assert.equal(merged[1].absence?.isHalfDay, true);
});

test('an absence on a day with no attendance record still gets a place in the month', () => {
  const merged = mergeAbsenceDays([att('2026-08-03', 'full', 480, 480)], [{ date: '2026-08-06', reason: 'Sick' }]);
  assert.equal(merged.length, 2);
  const added = merged.find((d) => d.date === '2026-08-06');
  assert.equal(added?.status, 'no_shift');
  assert.equal(added?.plannedMinutes, 0, 'an absence invents no rostered hours');
  assert.equal(added?.absence?.reason, 'Sick');
});

test('absence marks tolerate timestamps and leave untouched days alone', () => {
  const merged = mergeAbsenceDays([att('2026-08-03', 'full', 480, 480)], [{ date: '2026-08-03T00:00:00.000Z' }]);
  assert.equal(merged.length, 1);
  assert.ok(merged[0].absence);
  // No absences at all is a pass-through, not a rebuild.
  const days = [att('2026-08-03', 'full', 480, 480)];
  assert.equal(mergeAbsenceDays(days, []), days);
});

test('a rostered day replaces an explicit no_shift, and two slots on one day are summed', () => {
  const merged = mergeRosteredDays(
    [att('2026-08-20', 'no_shift')],
    [slot('2026-08-20T09:00:00', '2026-08-20T12:00:00'), slot('2026-08-20T13:00:00', '2026-08-20T17:00:00')],
  );
  assert.equal(merged.length, 2, 'the no_shift entry stays in the list and is filtered later');
  const rostered = merged.find((d) => d.status === 'scheduled');
  assert.equal(rostered?.plannedMinutes, 420); // 3h + 4h
});

// ── Leave ─────────────────────────────────────────────────────────────────────

test('leave balance reads the first entitlement and survives having none', () => {
  const entitlements = [{ id: 'l1', year: 2026, totalDays: '28', usedDays: '6.5', leaveType: { name: 'Holiday' } }];
  assert.deepEqual(leaveBalance(entitlements as Parameters<typeof leaveBalance>[0]), {
    total: 28,
    used: 6.5,
    remaining: 21.5,
    hasEntitlement: true,
  });
  assert.deepEqual(leaveBalance([]), { total: 0, used: 0, remaining: 0, hasEntitlement: false });
});

// ── Field validation ──────────────────────────────────────────────────────────

test('sort codes accept six digits however they are typed', () => {
  assert.equal(isValidSortCode('04-00-04'), true);
  assert.equal(isValidSortCode('040004'), true);
  assert.equal(isValidSortCode('04 00 0'), false);
  assert.equal(formatSortCode('040004'), '04-00-04');
  assert.equal(formatSortCode('04'), '04');
});

test('account numbers are exactly eight digits', () => {
  assert.equal(isValidAccountNumber('12345678'), true);
  assert.equal(isValidAccountNumber('1234567'), false);
  assert.equal(isValidAccountNumber('12345678901'), true, 'extra digits are truncated on entry, not rejected outright');
});

test('NI numbers follow the HMRC format and reject reserved prefixes', () => {
  assert.equal(isValidNiNumber('AB123456C'), true);
  assert.equal(isValidNiNumber('ab 12 34 56 c'), true);
  assert.equal(isValidNiNumber('AB123456E'), false, 'final letter must be A–D');
  assert.equal(isValidNiNumber('DA123456A'), false, 'D is not a valid first letter');
  assert.equal(isValidNiNumber('AO123456A'), false, 'O is not a valid second letter');
  assert.equal(isValidNiNumber('BG123456A'), false, 'BG is administratively reserved');
  assert.equal(isValidNiNumber('AB12345C'), false, 'six digits, not five');
  // HMRC's own documentation placeholder is deliberately un-issuable: Q is not
  // a permitted prefix letter. Never use it as example text in a form.
  assert.equal(isValidNiNumber('QQ123456C'), false);
  assert.equal(formatNiNumber('AB123456C'), 'AB 12 34 56 C');
});
