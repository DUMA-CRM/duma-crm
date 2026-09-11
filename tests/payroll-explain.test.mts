import assert from 'node:assert/strict';
import test from 'node:test';

const { explainPay, explainShift, reconciles } = await import('../lib/utils/payroll-explain.ts');

type Line = Parameters<typeof explainPay>[0];
type Shift = Parameters<typeof explainShift>[0];

const shift = (over: Partial<Shift> = {}): Shift =>
  ({
    id: 's1',
    locationId: 'l1',
    locationName: 'Camden',
    clockedIn: '2026-09-01T09:00:00Z',
    clockedOut: '2026-09-01T17:00:00Z',
    rawHours: 8,
    paidHours: 7.5,
    overtimeHours: 0,
    scheduled: { startsAt: '2026-09-01T09:00:00Z', endsAt: '2026-09-01T17:00:00Z' },
    ...over,
  }) as Shift;

const line = (over: Partial<Line> = {}): Line =>
  ({
    userId: 'u1',
    name: 'Alex Doe',
    jobTitle: 'Barista',
    payType: 'hourly',
    hourlyRate: 13.5,
    rawHours: 8,
    paidHours: 7.5,
    grossPay: 101.25,
    ...over,
  }) as Line;

// ── Per shift ────────────────────────────────────────────────────────────────

test('the gap between clocked and payable splits into overtime and break', () => {
  // 10 clocked, 8 payable: 1.5 beyond the rota, so the other 0.5 is the break.
  const e = explainShift(shift({ rawHours: 10, paidHours: 8, overtimeHours: 1.5 }));
  assert.equal(e.overtimeHours, 1.5);
  assert.equal(e.breakHours, 0.5);
});

test('a shift paid in full has neither', () => {
  const e = explainShift(shift({ rawHours: 8, paidHours: 8, overtimeHours: 0 }));
  assert.equal(e.overtimeHours, 0);
  assert.equal(e.breakHours, 0);
});

test('an unrostered shift is flagged, because it pays nothing at all', () => {
  // The API caps payable at the scheduled length and treats "no schedule" as a
  // cap of zero — so the whole shift is unpaid. Least obvious rule in payroll.
  const e = explainShift(shift({ scheduled: null, rawHours: 6, paidHours: 0, overtimeHours: 6 }));
  assert.equal(e.unrostered, true);
  assert.equal(e.overtimeHours, 6);
  assert.equal(e.breakHours, 0);
});

test('a rostered shift is never flagged as unrostered', () => {
  assert.equal(explainShift(shift()).unrostered, false);
});

test('a zero-hour shift with no schedule is not flagged', () => {
  // Nothing was worked, so there is nothing to explain away.
  assert.equal(explainShift(shift({ scheduled: null, rawHours: 0, paidHours: 0, overtimeHours: 0 })).unrostered, false);
});

test('negative gaps never appear, however the figures arrive', () => {
  const e = explainShift(shift({ rawHours: 7, paidHours: 8, overtimeHours: -1 }));
  assert.equal(e.overtimeHours, 0);
  assert.equal(e.breakHours, 0);
});

// ── Per line ─────────────────────────────────────────────────────────────────

test('an hourly line with a rate is explained as hourly', () => {
  const e = explainPay(line(), 'monthly', [shift()]);
  assert.equal(e.basis, 'hourly');
  assert.equal(e.payableHours, 7.5);
  assert.equal(e.unpaidHours, 0.5);
  assert.equal(e.salaryDivisor, null);
});

test('hours worked but no rate is its own basis, not an hourly line worth nothing', () => {
  assert.equal(explainPay(line({ hourlyRate: null }), 'monthly').basis, 'missing-rate');
  assert.equal(explainPay(line({ hourlyRate: 0 }), 'monthly').basis, 'missing-rate');
});

test('a salaried line divides by the period, and hours do not drive it', () => {
  const monthly = explainPay(line({ payType: 'salaried', hourlyRate: null, grossPay: 2500 }), 'monthly');
  const weekly = explainPay(line({ payType: 'salaried', hourlyRate: null, grossPay: 576.92 }), 'weekly');
  assert.equal(monthly.basis, 'salaried');
  assert.equal(monthly.salaryDivisor, 12);
  assert.equal(weekly.salaryDivisor, 52);
});

test('totals add up across several shifts', () => {
  const e = explainPay(line({ rawHours: 18, paidHours: 14 }), 'monthly', [
    shift({ id: 'a', rawHours: 10, paidHours: 8, overtimeHours: 1.5 }),
    shift({ id: 'b', scheduled: null, rawHours: 6, paidHours: 0, overtimeHours: 6 }),
    shift({ id: 'c', rawHours: 2, paidHours: 2, overtimeHours: 0 }),
  ]);
  assert.equal(e.overtimeHours, 7.5);
  assert.equal(e.breakHours, 0.5);
  assert.equal(e.unrosteredShifts, 1);
  assert.equal(e.unpaidHours, 4);
});

test('with no timesheet the totals still describe the line', () => {
  // The timesheet is a second request; the account degrades rather than breaks.
  const e = explainPay(line({ rawHours: 10, paidHours: 8 }), 'monthly');
  assert.equal(e.payableHours, 8);
  assert.equal(e.unpaidHours, 2);
  assert.deepEqual(e.shifts, []);
});

// ── Reconciliation ───────────────────────────────────────────────────────────

test('paid hours times rate should equal the gross the API returned', () => {
  assert.equal(reconciles(line()), true);
  assert.equal(reconciles(line({ grossPay: 99 })), false);
});

test('a salaried line is exempt — its gross has nothing to do with hours', () => {
  assert.equal(reconciles(line({ payType: 'salaried', hourlyRate: null, grossPay: 2500 })), true);
});

test('rounding to the penny does not trip the check', () => {
  assert.equal(reconciles(line({ paidHours: 7.33, hourlyRate: 13.5, grossPay: 98.96 })), true);
});
