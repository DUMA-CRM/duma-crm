import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cellState,
  costExclusions,
  dayWindow,
  groupByPosition,
  labourBand,
  labourCostPence,
  moveShiftTo,
  personWeek,
  plannerTotals,
  publishState,
} from '../../lib/utils/rota-planner.ts';

const TZ = 'Europe/London';
const shift = (id: string, userId: string | null, startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  userId,
  startsAt,
  endsAt,
  breakMinutes: 0,
  status: 'draft',
  ...extra,
});

test('labour cost is paid hours × rate with the on-cost on top, in pence', () => {
  // 7.5 paid hours at £12.21 = £91.575 → 9158p; +13.8% on-cost = 10421.8 → 10422p.
  assert.equal(labourCostPence(450, '12.21', '0'), 9158);
  assert.equal(labourCostPence(450, '12.21', '13.8'), 10422);
  assert.equal(labourCostPence(450, null, '13.8'), null);
});

test('labour % is banded against the target: within, up to three points over, then over', () => {
  assert.equal(labourBand(28, '28.00'), 'within');
  assert.equal(labourBand(31, '28.00'), 'near');
  assert.equal(labourBand(31.1, '28.00'), 'over');
  assert.equal(labourBand(40, null), null);
});

test('week totals cost the shifts on the day they start, use actual sales over forecast, and name what they leave out', () => {
  const totals = plannerTotals({
    weekStart: '2026-11-16',
    timeZone: TZ,
    shifts: [
      // Monday: 8h with a 30-minute break → 7.5h at £12 = £90.
      shift('a', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z', { breakMinutes: 30 }),
      // Monday: no rate on file — counted in hours, left out of cost.
      shift('b', 'ben', '2026-11-16T10:00:00Z', '2026-11-16T14:00:00Z'),
      // Monday: an open shift.
      shift('c', null, '2026-11-16T12:00:00Z', '2026-11-16T16:00:00Z'),
      // Cancelled shifts count for nothing.
      shift('d', 'ana', '2026-11-17T09:00:00Z', '2026-11-17T17:00:00Z', { status: 'cancelled' }),
      // Sunday 23:30 local belongs to Sunday, even though it ends on Monday.
      shift('e', 'ana', '2026-11-22T23:30:00Z', '2026-11-23T01:30:00Z'),
    ],
    staff: [
      { userId: 'ana', hourlyRate: '12.00' },
      { userId: 'ben', hourlyRate: null },
    ],
    sales: [
      { date: '2026-11-16', actual: '300.00', forecast: '500.00' },
      { date: '2026-11-17', actual: null, forecast: '400.00' },
      { date: '2026-11-18', actual: null, forecast: '0.00' },
    ],
    targets: { targetLabourPct: '28', weeklyBudget: '100.00', onCostPct: '0' },
  });

  const monday = totals.days[0];
  assert.equal(monday.paidMinutes, 450 + 240 + 240);
  assert.equal(monday.costPence, 9000);
  assert.deepEqual(monday.sales, { pence: 30000, kind: 'actual' });
  assert.equal(monday.pct, 30);
  assert.equal(monday.band, 'near');

  assert.deepEqual(totals.days[1].sales, { pence: 40000, kind: 'forecast' });
  assert.equal(totals.days[1].costPence, 0);
  assert.equal(totals.days[2].sales, null, 'a zero forecast is no figure');
  assert.equal(totals.days[6].paidMinutes, 120);

  assert.equal(totals.week.costPence, 9000 + 2400);
  assert.equal(totals.week.sales?.kind, 'mixed');
  assert.equal(totals.week.overBudget, true);
  assert.equal(totals.unratedPeople, 1);
  assert.equal(totals.openShifts, 1);
  assert.equal(costExclusions(totals.unratedPeople, totals.openShifts), 'excl. 1 without a rate · 1 open shift');
});

test('nobody’s rate visible means hours only — no cost, no labour %', () => {
  const totals = plannerTotals({
    weekStart: '2026-11-16',
    timeZone: TZ,
    shifts: [shift('a', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z')],
    staff: [{ userId: 'ana', hourlyRate: null }],
    sales: [{ date: '2026-11-16', actual: '300.00', forecast: '0' }],
    targets: { targetLabourPct: '28', weeklyBudget: '100.00', onCostPct: '10' },
  });
  assert.equal(totals.costVisible, false);
  assert.equal(totals.days[0].costPence, null);
  assert.equal(totals.days[0].pct, null);
  assert.equal(totals.week.overBudget, null);
  assert.equal(totals.unratedPeople, 0);
});

test('hours against the contract flag going over', () => {
  const week = personWeek(
    { userId: 'ana', hourlyRate: '10', contractedWeeklyHours: '16.00' },
    [
      shift('a', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z'),
      shift('b', 'ana', '2026-11-17T09:00:00Z', '2026-11-17T18:00:00Z', { breakMinutes: 30 }),
      shift('c', 'ben', '2026-11-17T09:00:00Z', '2026-11-17T18:00:00Z'),
    ],
    '0',
  );
  assert.equal(week.paidMinutes, 480 + 510);
  assert.equal(week.contractedMinutes, 960);
  assert.equal(week.overContract, true);
  assert.equal(week.costPence, 16500);
});

test('unpublished drafts and published shifts changed since they were made are counted separately', () => {
  const state = publishState([
    shift('a', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z'),
    shift('b', 'ana', '2026-11-17T09:00:00Z', '2026-11-17T17:00:00Z', {
      status: 'published',
      createdAt: '2026-11-10T10:00:00Z',
      publishedAt: '2026-11-12T10:00:00Z',
      acknowledgedAt: null,
    }),
    shift('c', 'ana', '2026-11-18T09:00:00Z', '2026-11-18T17:00:00Z', {
      status: 'published',
      createdAt: '2026-11-10T10:00:00Z',
      publishedAt: '2026-11-12T10:00:00Z',
      acknowledgedAt: '2026-11-12T11:00:00Z',
    }),
  ]);
  assert.deepEqual(state, { drafts: 1, changed: 1 });
});

test('a person’s day: approved leave wins over pending, all-day unavailable, and part-day windows', () => {
  const leave = [
    { userId: 'ana', startDate: '2026-11-16', endDate: '2026-11-18', status: 'pending' as const, typeName: 'Holiday' },
    { userId: 'ana', startDate: '2026-11-17', endDate: '2026-11-17', status: 'approved' as const, typeName: 'Sick' },
  ];
  const availability = [
    // Tuesday (weekday 1) all day; Wednesday 09:00–12:00; Wednesday evening preferred.
    { userId: 'ana', weekday: 1, startMinute: null, endMinute: null, kind: 'unavailable' as const, note: null },
    { userId: 'ana', weekday: 2, startMinute: 540, endMinute: 720, kind: 'unavailable' as const, note: 'School run' },
    { userId: 'ana', weekday: 2, startMinute: 1020, endMinute: 1320, kind: 'preferred' as const, note: null },
  ];
  assert.deepEqual(cellState('ana', '2026-11-16', leave, availability).leave, { status: 'pending', typeName: 'Holiday' });
  const tuesday = cellState('ana', '2026-11-17', leave, availability);
  assert.deepEqual(tuesday.leave, { status: 'approved', typeName: 'Sick' });
  assert.equal(tuesday.unavailable, true);
  const wednesday = cellState('ana', '2026-11-18', leave, availability);
  assert.equal(wednesday.unavailable, false);
  assert.equal(wednesday.preferred, true);
  assert.deepEqual(
    wednesday.windows.map((w) => w.label),
    ['Can’t 09:00–12:00', 'Prefers 17:00–22:00'],
  );
  assert.equal(cellState('ben', '2026-11-17', leave, availability).leave, null);
});

test('moving a shift keeps its local start time and its length across the clocks going back', () => {
  // Friday 23 Oct 2026 is BST (UTC+1): 09:00 local = 08:00Z. Monday 26 Oct is GMT.
  const moved = moveShiftTo({ startsAt: '2026-10-23T08:00:00Z', endsAt: '2026-10-23T16:30:00Z' }, '2026-10-26', TZ);
  assert.deepEqual(moved, { startsAt: '2026-10-26T09:00:00.000Z', endsAt: '2026-10-26T17:30:00.000Z' });
});

test('position groups follow the location’s order with unassigned shifts last', () => {
  const positions = [
    { id: 'kitchen', locationId: null, name: 'Kitchen', color: 'amber', sortOrder: 2, isActive: true },
    { id: 'bar', locationId: null, name: 'Bar', color: 'blue', sortOrder: 1, isActive: true },
    { id: 'old', locationId: null, name: 'Old', color: 'red', sortOrder: 0, isActive: false },
  ];
  const groups = groupByPosition(
    [
      shift('a', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z', { positionId: 'kitchen' }),
      shift('b', 'ana', '2026-11-16T09:00:00Z', '2026-11-16T17:00:00Z'),
    ],
    positions,
  );
  assert.deepEqual(
    groups.map((g) => [g.key, g.shifts.map((s) => s.id)]),
    [
      ['bar', []],
      ['kitchen', ['a']],
      ['none', ['b']],
    ],
  );
});

test('the day view spans opening hours, widened to the day’s shifts', () => {
  const shifts = [shift('a', 'ana', '2026-11-16T05:30:00Z', '2026-11-16T12:00:00Z')];
  assert.deepEqual(dayWindow({ open: '07:00', close: '18:30' }, shifts, '2026-11-16', TZ), { from: 5, to: 19 });
  assert.deepEqual(dayWindow(null, [], '2026-11-16', TZ), { from: 6, to: 24 });
});
