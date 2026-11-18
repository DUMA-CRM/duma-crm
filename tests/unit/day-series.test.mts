import assert from 'node:assert/strict';
import test from 'node:test';

import { amountsByHour, axisTicks, daySeries } from '../../lib/utils/day-series.ts';

// A café open 08:00–12:00, at 10:30 on the clock.
const buckets = [8, 9, 10, 11].map((hour) => ({ hour, startMinutes: hour * 60 }));
const base = {
  buckets,
  byHour: new Map([
    [8, 40],
    [9, 120],
    [10, 30],
  ]),
  typicalByHour: new Map([
    [8, 50],
    [9, 150],
    [10, 230],
    [11, 300],
  ]),
  nowMinutes: 10 * 60 + 30,
  showToday: true,
  soFar: 205,
  trading: true,
};

test('the running total stops at the hour under way and ends on the live figure', () => {
  const series = daySeries(base);
  assert.deepEqual(series.perHour, [40, 120, 30, 0]);
  // 40, 160, then the live 205 rather than 190: money taken after the last hourly read still counts.
  assert.deepEqual(series.today, [40, 160, 205]);
  assert.deepEqual(series.typical, [50, 150, 230, 300]);
  assert.equal(series.nowIndex, 2);
  assert.equal(series.busiestIndex, 1);
});

test('before open there is no line for today, and no history means no typical day', () => {
  const series = daySeries({ ...base, showToday: false, typicalByHour: new Map(), trading: false });
  assert.deepEqual(series.today, []);
  assert.deepEqual(series.perHour, [0, 0, 0, 0]);
  assert.deepEqual(series.typical, []);
  assert.equal(series.nowIndex, -1);
  assert.equal(series.busiestIndex, -1);
});

test('an overnight axis keeps its hours in order', () => {
  const overnight = [22, 23, 0, 1, 2].map((hour, index) => ({ hour, startMinutes: (22 + index) * 60 }));
  assert.deepEqual(axisTicks(overnight), ['22:00', '00:00', '02:00']);
  assert.deepEqual(axisTicks([]), []);
});

test('amounts by hour: summed in the shop’s clock hour, to the penny', () => {
  const rows = [
    { createdAt: '2026-07-01T08:15:00Z', amount: '2.10' }, // 09:15 in London (BST)
    { createdAt: '2026-07-01T08:59:59Z', amount: '0.20' }, // still the 09:00 hour
    { createdAt: '2026-07-01T09:00:00Z', amount: '5.00' }, // 10:00
  ];
  assert.deepEqual([...amountsByHour(rows, 'Europe/London')], [
    [9, 2.3],
    [10, 5],
  ]);
  // The same instants on a New York till land four hours earlier.
  assert.deepEqual([...amountsByHour(rows, 'America/New_York').keys()], [4, 5]);
});
