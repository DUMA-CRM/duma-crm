import assert from 'node:assert/strict';
import test from 'node:test';

import { tierLadder } from '../lib/utils/loyalty-tiers.ts';
import { buildVisitWeeks, summariseVisits } from '../lib/utils/visit-pattern.ts';

const RUNGS = [
  { id: 'bronze', label: 'Bronze', from: 0 },
  { id: 'silver', label: 'Silver', from: 100 },
  { id: 'gold', label: 'Gold', from: 300 },
  { id: 'vip', label: 'VIP', from: 800 },
];

test('weeks start on a Monday and end on the week holding today', () => {
  // 2026-10-02 is a Friday.
  const { weeks } = buildVisitWeeks([], '2026-10-02', 1);
  assert.equal(new Date(`${weeks[0][0].date}T00:00:00Z`).getUTCDay(), 1);
  const last = weeks.at(-1)!;
  assert.ok(last.some((cell) => cell.date === '2026-10-02' && !cell.future));
  assert.deepEqual(
    last.filter((cell) => cell.future).map((cell) => cell.date),
    ['2026-10-03', '2026-10-04'],
  );
});

test('two orders on one day are one square with their spend summed', () => {
  const { weeks } = buildVisitWeeks(
    [
      { date: '2026-09-30T08:10:00Z', spend: 12 },
      { date: '2026-09-30', spend: 8.5 },
    ],
    '2026-10-02',
    1,
  );
  const cell = weeks.flat().find((entry) => entry.date === '2026-09-30');
  assert.equal(cell?.spend, 20.5);
});

test('a month label sits over the first week of each month', () => {
  // Two months back is Sunday 2 August, so the grid opens on Monday 27 July.
  const { weeks, monthLabels } = buildVisitWeeks([], '2026-10-02', 2);
  assert.equal(weeks[0][0].date, '2026-07-27');
  assert.deepEqual(
    monthLabels.map((entry) => entry.week),
    [0, 1, 6],
  );
});

test('the summary counts days, not orders, and only inside the window', () => {
  const summary = summariseVisits(
    [
      { date: '2026-09-26', spend: 10 }, // Saturday
      { date: '2026-09-26', spend: 5 },
      { date: '2026-09-19', spend: 20 }, // Saturday
      { date: '2026-09-23', spend: 7 }, // Wednesday
      { date: '2025-01-01', spend: 999 }, // outside six months
    ],
    '2026-10-02',
    6,
  );
  assert.equal(summary.visitDays, 3);
  assert.equal(summary.spend, 42);
  assert.equal(summary.busiestWeekday, 5);
  assert.equal(summary.averageGapDays, 4);
});

test('no busiest weekday from a tie or a single visit', () => {
  assert.equal(summariseVisits([{ date: '2026-09-26', spend: 1 }], '2026-10-02', 6).busiestWeekday, null);
  assert.equal(
    summariseVisits(
      [
        { date: '2026-09-26', spend: 1 },
        { date: '2026-09-19', spend: 1 },
        { date: '2026-09-23', spend: 1 },
        { date: '2026-09-16', spend: 1 },
      ],
      '2026-10-02',
      6,
    ).busiestWeekday,
    null,
  );
  assert.equal(summariseVisits([], '2026-10-02', 6).averageGapDays, null);
});

test('the ladder fills passed rungs and part of the current one', () => {
  const ladder = tierLadder(200, RUNGS);
  assert.equal(ladder.current.id, 'silver');
  assert.deepEqual(
    ladder.steps.map((step) => [step.state, step.fill]),
    [
      ['passed', 1],
      ['current', 0.5],
      ['ahead', 0],
      ['ahead', 0],
    ],
  );
  assert.deepEqual(ladder.next, { label: 'Gold', needed: 100 });
});

test('the top rung is full and has nothing after it', () => {
  const ladder = tierLadder(5000, RUNGS);
  assert.equal(ladder.current.id, 'vip');
  assert.equal(ladder.current.fill, 1);
  assert.equal(ladder.next, null);
});

test('a negative or missing balance sits at the bottom', () => {
  assert.equal(tierLadder(-20, RUNGS).current.id, 'bronze');
  assert.equal(tierLadder(Number.NaN, RUNGS).points, 0);
});
