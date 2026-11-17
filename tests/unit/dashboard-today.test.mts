import assert from 'node:assert/strict';
import test from 'node:test';

import { boardLayout } from '../../lib/utils/dashboard-flow.ts';
import {
  barPercent,
  baselineOrdersByMinute,
  dateWeekBefore,
  figureChange,
  labourShare,
  sameTimeLastWeek,
} from '../../lib/utils/today-figures.ts';

const place = (widgetKey: string, width: number) => ({ widgetKey, width });

test('full-width widgets lead; narrower ones balance into the shorter column', () => {
  const layout = boardLayout(
    [
      place('analytics.exceptions', 12),
      place('analytics.trading', 8),
      place('analytics.live', 4),
      place('analytics.kpis', 12),
      place('inventory.stock-health', 6),
      place('workforce.team-today', 6),
    ],
    2,
  );
  assert.deepEqual(
    layout.full.map((item) => item.widgetKey),
    ['analytics.exceptions', 'analytics.kpis'],
  );
  // trading (10) left, live (5) right, stock (7) to the shorter right (12), team (5) to the left (15).
  assert.deepEqual(
    layout.columns.map((column) => column.map((item) => item.widgetKey)),
    [
      ['analytics.trading', 'workforce.team-today'],
      ['analytics.live', 'inventory.stock-health'],
    ],
  );
});

test('one column keeps the saved order of the narrower widgets', () => {
  const layout = boardLayout([place('a', 6), place('b', 12), place('c', 4), place('d', 8)], 1);
  assert.deepEqual(
    layout.full.map((item) => item.widgetKey),
    ['b'],
  );
  assert.deepEqual(
    layout.columns.map((column) => column.map((item) => item.widgetKey)),
    [['a', 'c', 'd']],
  );
});

test('ties go to the left column so the order still reads across', () => {
  const layout = boardLayout([place('x', 6), place('y', 6), place('z', 6)], 2, () => 3);
  assert.deepEqual(
    layout.columns.map((column) => column.map((item) => item.widgetKey)),
    [['x', 'z'], ['y']],
  );
});

test('a change is a whole percent against a real reference, never against nothing', () => {
  assert.deepEqual(figureChange(110, 100), { percent: 10, direction: 'up' });
  assert.deepEqual(figureChange(96, 100), { percent: -4, direction: 'down' });
  assert.deepEqual(figureChange(100.3, 100), { percent: 0, direction: 'flat' });
  assert.deepEqual(figureChange(50, 0), { percent: null, direction: 'none' });
  assert.deepEqual(figureChange(50, null), { percent: null, direction: 'none' });
});

test('labour share is withheld until enough has been taken', () => {
  assert.equal(labourShare(120, 49.99), null);
  assert.equal(labourShare(120, 400), 30);
  assert.equal(labourShare(Number.NaN, 400), null);
});

test('typical orders by now interpolate inside the current hour', () => {
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orderCount: hour === 9 ? 20 : hour === 8 ? 10 : 0,
    cumulativeOrders: hour >= 9 ? 30 : hour === 8 ? 10 : 0,
    revenue: 0,
    cumulativeRevenue: 0,
  }));
  const baseline = { byHour } as unknown as Parameters<typeof baselineOrdersByMinute>[0];
  // 09:30: all of 08:00 (10) plus half of 09:00 (20 / 2).
  assert.equal(baselineOrdersByMinute(baseline, 9 * 60 + 30), 20);
  assert.equal(baselineOrdersByMinute(undefined, 600), 0);
});

test('same time last week is the calendar weekday, across a clock change', () => {
  assert.equal(dateWeekBefore('2026-03-05'), '2026-02-26');
  assert.equal(dateWeekBefore('nope'), null);
  // London went to BST on 29 March 2026: last Thursday 26 March was GMT, this Thursday 2 April is BST.
  assert.deepEqual(sameTimeLastWeek('2026-04-02', '14:05', 'Europe/London'), {
    from: '2026-03-26T00:00:00.000Z',
    to: '2026-03-26T14:05:00.000Z',
  });
  assert.deepEqual(sameTimeLastWeek('2026-11-19', '09:30', 'America/New_York'), {
    from: '2026-11-12T05:00:00.000Z',
    to: '2026-11-12T14:30:00.000Z',
  });
});

test('bars scale to the tallest with a visible floor; zero stays flat', () => {
  assert.equal(barPercent(50, 100), 50);
  assert.equal(barPercent(1, 100), 4);
  assert.equal(barPercent(0, 100), 0);
  assert.equal(barPercent(5, 0), 0);
  assert.equal(barPercent(150, 100), 100);
});
