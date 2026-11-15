import assert from 'node:assert/strict';
import test from 'node:test';

import { type AutofillInput, type AutofillStaff, autofillRota, splitRun, summariseWeek } from '../../lib/utils/rota-autofill.ts';
import { UK_RULES } from '../../lib/utils/rota-rules.ts';

// Monday 16 Nov 2026, London (GMT, so local = UTC — the arithmetic stays readable).
const WEEK = '2026-11-16';
const TZ = 'Europe/London';

const person = (userId: string, extra: Partial<AutofillStaff> = {}): AutofillStaff => ({
  userId,
  name: userId,
  contractedWeeklyHours: null,
  hourlyRate: '12.00',
  isMinor: false,
  positionIds: [],
  availability: [],
  ...extra,
});

/** Monday needs one person 09:00–15:00 and nobody otherwise. */
const mondayNeed = Array.from({ length: 6 }, (_, i) => ({ weekday: 0, hour: 9 + i, recommendedStaff: 1 }));

const base = (extra: Partial<AutofillInput> = {}): AutofillInput => ({
  weekStart: WEEK,
  timeZone: TZ,
  staff: [person('ana')],
  shifts: [],
  leave: [],
  coverage: mondayNeed,
  rules: UK_RULES,
  ...extra,
});

test('a coverage gap becomes one shift on the hour, with the cost and labour % it adds', () => {
  const result = autofillRota(
    base({ sales: [{ date: WEEK, actual: null, forecast: '720.00' }], targets: { targetLabourPct: '25.00', onCostPct: '0' } }),
  );
  assert.equal(result.gaps.length, 0);
  assert.equal(result.shifts.length, 1);
  const [shift] = result.shifts;
  assert.equal(shift.userId, 'ana');
  assert.equal(shift.startsAt, '2026-11-16T09:00:00.000Z');
  assert.equal(shift.endsAt, '2026-11-16T15:00:00.000Z');
  // Exactly six hours is not over the 6h threshold, so no break is owed.
  assert.equal(shift.breakMinutes, 0);
  assert.equal(result.summary.paidMinutesAdded, 360);
  assert.equal(result.summary.costAdded, '72.00');
  assert.equal(result.summary.labourPctAfter, '10.00');
});

test('hours already planned are not filled twice', () => {
  const result = autofillRota(
    base({ shifts: [{ id: 's1', userId: 'ana', startsAt: '2026-11-16T09:00:00Z', endsAt: '2026-11-16T15:00:00Z', status: 'draft' }] }),
  );
  assert.equal(result.shifts.length, 0);
});

test('people on approved leave or unavailable are passed over', () => {
  const result = autofillRota(
    base({
      staff: [
        person('ana', { contractedWeeklyHours: '40' }),
        person('ben', { availability: [{ userId: 'ben', weekday: 0, startMinute: null, endMinute: null, kind: 'unavailable' }] }),
        person('cat'),
      ],
      leave: [{ userId: 'ana', startDate: WEEK, endDate: WEEK, status: 'approved' }],
    }),
  );
  assert.deepEqual(
    result.shifts.map((s) => s.userId),
    ['cat'],
  );
});

test('the most contract headroom wins, then the cheapest rate', () => {
  const staff = [
    person('ana', { contractedWeeklyHours: '10', hourlyRate: '11.00' }),
    person('ben', { contractedWeeklyHours: '30', hourlyRate: '14.00' }),
    person('cat', { contractedWeeklyHours: '30', hourlyRate: '12.00' }),
  ];
  assert.equal(autofillRota(base({ staff })).shifts[0].userId, 'cat');
});

test('an under-18 is not given a block over their daily limit, and an unfillable gap says why', () => {
  // 07:00–19:00 is twelve hours: two blocks of six. The minor can take one; nobody can take the second.
  const coverage = Array.from({ length: 12 }, (_, i) => ({ weekday: 0, hour: 7 + i, recommendedStaff: 1 }));
  const result = autofillRota(base({ staff: [person('kid', { isMinor: true })], coverage }));
  assert.equal(result.shifts.length, 1);
  assert.equal(result.shifts[0].breakMinutes, 30);
  assert.equal(result.gaps.length, 1);
  assert.match(result.gaps[0].reason, /working-time rule/);
});

test('a long run splits into blocks of three to eight hours', () => {
  assert.deepEqual(splitRun(7, 19), [
    [7, 13],
    [13, 19],
  ]);
  assert.deepEqual(splitRun(22, 23), [[21, 24]]);
  assert.deepEqual(splitRun(9, 18), [
    [9, 14],
    [14, 18],
  ]);
});

test('the week summary gives hours against contract, warnings and labour % without hidden pay', () => {
  const summary = summariseWeek({
    timeZone: TZ,
    staff: [person('ana', { contractedWeeklyHours: '20' }), person('ben', { hourlyRate: null })],
    shifts: [
      { id: 'a', userId: 'ana', startsAt: '2026-11-16T08:00:00Z', endsAt: '2026-11-16T16:00:00Z', breakMinutes: 0, status: 'draft' },
      { id: 'b', userId: 'ben', startsAt: '2026-11-16T08:00:00Z', endsAt: '2026-11-16T12:00:00Z', status: 'published' },
      { id: 'o', userId: null, startsAt: '2026-11-17T10:00:00Z', endsAt: '2026-11-17T14:00:00Z', status: 'published' },
    ],
    leave: [],
    rules: UK_RULES,
  });
  const ana = summary.people.find((p) => p.userId === 'ana')!;
  assert.equal(ana.paidHours, 8);
  assert.equal(ana.contractHeadroomHours, 12);
  assert.equal(ana.cost, '96.00');
  assert.deepEqual(ana.warnings, ['8h shift needs a 20-minute break']);
  assert.equal(summary.totals.labourCost, null);
  assert.deepEqual(
    summary.openShifts.map((s) => s.time),
    ['10:00–14:00'],
  );
});
