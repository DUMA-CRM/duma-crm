import assert from 'node:assert/strict';
import test from 'node:test';

import { salesByDay, weekSales, weekWindows } from '../../lib/dashboard/week-sales.ts';

const LONDON = 'Europe/London';

test('the week starts at Monday midnight at the business and runs to the end of today', () => {
  // Wednesday 25 November 2026, 14:30 in London (GMT).
  const windows = weekWindows(new Date('2026-11-25T14:30:00Z'), LONDON);
  assert.equal(windows.today, '2026-11-25');
  assert.equal(windows.todayIndex, 2);
  assert.deepEqual(windows.days, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']);
  assert.equal(windows.lastDays[0], '2026-11-16');
  assert.deepEqual(windows.thisWeek, { from: '2026-11-23T00:00:00.000Z', to: '2026-11-25T23:59:59.999Z' });
  // Last week only up to the same minute, so a Wednesday lunchtime isn't judged against a whole Wednesday.
  assert.deepEqual(windows.lastWeek, { from: '2026-11-16T00:00:00.000Z', to: '2026-11-18T14:30:59.999Z' });
});

test('Sunday is the last day of the week, not the first', () => {
  const windows = weekWindows(new Date('2026-11-29T12:00:00Z'), LONDON);
  assert.equal(windows.todayIndex, 6);
  assert.equal(windows.days[0], '2026-11-23');
});

test('across the clocks going forward, both weeks start at local midnight and compare the same clock time', () => {
  // Tuesday 31 March 2026, 11:00 BST; the clocks went forward on Sunday 29 March.
  const windows = weekWindows(new Date('2026-03-31T10:00:00Z'), LONDON);
  assert.equal(windows.thisWeek.from, '2026-03-29T23:00:00.000Z');
  assert.equal(windows.lastWeek.from, '2026-03-23T00:00:00.000Z');
  // 11:00 GMT a week ago — not now minus 168 hours, which would be 10:00.
  assert.equal(windows.lastWeek.to, '2026-03-24T11:00:59.999Z');
});

test('a sale dated the UTC day before Monday belongs to Monday, so the bars add up to the total', () => {
  const days = ['2026-03-30', '2026-03-31', '2026-04-01'];
  // 00:30 BST on Monday is 23:30 UTC on Sunday, and the API dates it Sunday.
  const bars = salesByDay(
    [
      { date: '2026-03-29', revenue: '12.50' },
      { date: '2026-03-30', revenue: '100.00' },
      { date: '2026-03-31T00:00:00.000Z', revenue: '40.25' },
      { date: '2026-04-02', revenue: '5.00' },
      { date: '2026-03-31', revenue: null },
    ],
    days,
  );
  assert.deepEqual(bars, [112.5, 40.25, 5]);
});

test('the week reads its totals from the summaries and leaves days to come empty', () => {
  const windows = weekWindows(new Date('2026-11-25T14:30:00Z'), LONDON);
  const reading = weekSales(
    windows,
    {
      summary: { totalRevenue: '1100.00', totalOrders: 61 },
      daily: [
        { date: '2026-11-23', revenue: '400.00' },
        { date: '2026-11-24', revenue: '500.00' },
        { date: '2026-11-25', revenue: '200.00' },
      ],
    },
    {
      summary: { totalRevenue: '1000.00' },
      daily: [
        { date: '2026-11-16', revenue: '450.00' },
        { date: '2026-11-17', revenue: '350.00' },
        { date: '2026-11-18', revenue: '200.00' },
      ],
    },
  );
  assert.equal(reading.net, 1100);
  assert.equal(reading.lastWeek, 1000);
  assert.deepEqual(reading.change, { percent: 10, direction: 'up' });
  assert.equal(reading.orders, 61);
  assert.deepEqual(reading.bars, [400, 500, 200, 0, 0, 0, 0]);
  assert.deepEqual(reading.lastBars, [450, 350, 200, 0, 0, 0, 0]);
  assert.equal(reading.best, 1);
});

test('nothing taken last week means no percentage, not an infinite rise', () => {
  const windows = weekWindows(new Date('2026-11-23T09:00:00Z'), LONDON);
  const reading = weekSales(
    windows,
    { summary: { totalRevenue: '80.00', totalOrders: 4 }, daily: [{ date: '2026-11-23', revenue: '80.00' }] },
    { summary: { totalRevenue: '0' }, daily: [] },
  );
  assert.deepEqual(reading.change, { percent: null, direction: 'none' });
  assert.equal(reading.best, 0);
  const empty = weekSales(windows, { summary: { totalRevenue: null, totalOrders: 0 }, daily: [] }, null);
  assert.equal(empty.net, 0);
  assert.equal(empty.lastWeek, null);
  assert.equal(empty.best, -1);
});
