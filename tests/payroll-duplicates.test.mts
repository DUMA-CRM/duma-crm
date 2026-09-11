import assert from 'node:assert/strict';
import test from 'node:test';

const { combineBlockedReason, groupByPeriod, hasDuplicates, isSuperseded, periodKey, suggestSurvivor } = await import(
  '../lib/utils/payroll-duplicates.ts'
);

type Run = Parameters<typeof groupByPeriod>[0][number];
type Line = Run['lines'][number];

const line = (over: Partial<Line> = {}): Line =>
  ({
    id: 'rl1',
    runId: 'r1',
    userId: 'u1',
    employeeName: 'Alex Doe',
    payType: 'hourly',
    hoursWorked: '80.00',
    paidHours: '78.00',
    hourlyRate: '13.50',
    grossPay: '1053.00',
    taxDeducted: null,
    nationalInsurance: null,
    pensionContribution: null,
    otherDeductions: null,
    netPay: null,
    ...over,
  }) as Line;

const run = (over: Partial<Run> = {}): Run =>
  ({
    id: 'r1',
    tenantId: 't1',
    period: 'monthly',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    status: 'finalised',
    finalisedAt: '2026-09-01T09:00:00Z',
    issuedAt: null,
    issuedBy: null,
    deductionsSource: null,
    supersededAt: null,
    supersededBy: null,
    createdAt: '2026-09-01T09:00:00Z',
    lines: [line()],
    ...over,
  }) as Run;

// ── Grouping ─────────────────────────────────────────────────────────────────

test('runs covering the same period group together', () => {
  const groups = groupByPeriod([run({ id: 'a' }), run({ id: 'b' })]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].runs.map((r) => r.id).sort(), ['a', 'b']);
});

test('the same dates on a different cadence is a different period', () => {
  // A weekly and a monthly run could coincidentally share dates; they are not
  // duplicates of each other.
  const groups = groupByPeriod([run({ id: 'a' }), run({ id: 'b', period: 'weekly' })]);
  assert.equal(groups.length, 2);
  assert.notEqual(periodKey(groups[0].runs[0]), periodKey(groups[1].runs[0]));
});

test('periods are listed newest first', () => {
  const groups = groupByPeriod([
    run({ id: 'july', periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
    run({ id: 'august' }),
  ]);
  assert.deepEqual(groups.map((g) => g.runs[0].id), ['august', 'july']);
});

test('within a period, the most recently finalised comes first', () => {
  const groups = groupByPeriod([
    run({ id: 'older', finalisedAt: '2026-09-01T09:00:00Z' }),
    run({ id: 'newer', finalisedAt: '2026-09-03T09:00:00Z' }),
  ]);
  assert.deepEqual(groups[0].runs.map((r) => r.id), ['newer', 'older']);
});

// ── What counts as a duplicate ───────────────────────────────────────────────

test('one run is not a duplicate', () => {
  assert.equal(hasDuplicates(groupByPeriod([run()])[0]), false);
});

test('a superseded run is history, not a duplicate', () => {
  // The whole point of superseding is that the period stops being contested.
  const group = groupByPeriod([run({ id: 'live' }), run({ id: 'set-aside', status: 'superseded' })])[0];
  assert.equal(hasDuplicates(group), false);
  assert.equal(group.runs.length, 2);
  assert.equal(group.active.length, 1);
  assert.equal(isSuperseded(group.runs.find((r) => r.id === 'set-aside')!), true);
});

test('two live runs for one period are a duplicate', () => {
  assert.equal(hasDuplicates(groupByPeriod([run({ id: 'a' }), run({ id: 'b' })])[0]), true);
});

// ── Which run survives ───────────────────────────────────────────────────────

test('an issued run always survives — employees have already been given it', () => {
  const group = groupByPeriod([
    run({ id: 'plain', finalisedAt: '2026-09-05T09:00:00Z' }),
    run({ id: 'issued', status: 'issued', finalisedAt: '2026-09-01T09:00:00Z' }),
  ])[0];
  assert.equal(suggestSurvivor(group)?.id, 'issued');
});

test('otherwise the run with deductions entered survives, so that work is not thrown away', () => {
  const group = groupByPeriod([
    run({ id: 'empty', finalisedAt: '2026-09-05T09:00:00Z' }),
    run({ id: 'keyed', finalisedAt: '2026-09-01T09:00:00Z', lines: [line({ taxDeducted: '105.30' })] }),
  ])[0];
  assert.equal(suggestSurvivor(group)?.id, 'keyed');
});

test('a line with only net pay entered still counts as keyed', () => {
  const group = groupByPeriod([
    run({ id: 'empty', finalisedAt: '2026-09-05T09:00:00Z' }),
    run({ id: 'keyed', finalisedAt: '2026-09-01T09:00:00Z', lines: [line({ netPay: '885.60' })] }),
  ])[0];
  assert.equal(suggestSurvivor(group)?.id, 'keyed');
});

test('with nothing to choose between them, the newest survives', () => {
  const group = groupByPeriod([
    run({ id: 'older', finalisedAt: '2026-09-01T09:00:00Z' }),
    run({ id: 'newer', finalisedAt: '2026-09-03T09:00:00Z' }),
  ])[0];
  assert.equal(suggestSurvivor(group)?.id, 'newer');
});

test('a superseded run is never suggested', () => {
  const group = groupByPeriod([run({ id: 'live' }), run({ id: 'gone', status: 'superseded', finalisedAt: '2026-09-09T09:00:00Z' })])[0];
  assert.equal(suggestSurvivor(group)?.id, 'live');
});

// ── When combining is refused ────────────────────────────────────────────────

test('nothing blocks a period that has no duplicate', () => {
  assert.equal(combineBlockedReason(groupByPeriod([run()])[0]), null);
});

test('an issued run among duplicates blocks the combine, and says why', () => {
  const group = groupByPeriod([run({ id: 'a' }), run({ id: 'b', status: 'issued' })])[0];
  assert.match(combineBlockedReason(group) ?? '', /issued to employees/);
});

test('two issued runs say something different from one', () => {
  const both = groupByPeriod([run({ id: 'a', status: 'issued' }), run({ id: 'b', status: 'issued' })])[0];
  assert.match(combineBlockedReason(both) ?? '', /Every run/);
});

test('two unissued duplicates are combinable', () => {
  assert.equal(combineBlockedReason(groupByPeriod([run({ id: 'a' }), run({ id: 'b' })])[0]), null);
});
