import assert from 'node:assert/strict';
import test from 'node:test';

const { takenTodaySeries } = await import('../lib/utils/taken-today.ts');

const buckets = [8, 9, 10, 11].map((hour) => ({ hour, startMinutes: hour * 60 }));
const typicalByHour = new Map([
  [8, 100],
  [9, 300],
  [10, 600],
  [11, 1000],
]);

test('today runs up to the hour under way and ends on the live total', () => {
  const series = takenTodaySeries({
    buckets,
    revenueByHour: new Map([
      [8, 120],
      [9, 200],
      [10, 50],
    ]),
    typicalByHour,
    typicalDay: 1000,
    nowMinutes: 10 * 60 + 20,
    takenSoFar: 380,
    target: 2000,
    showToday: true,
  });
  assert.deepEqual(
    series.points.map((point) => [point.label, point.value]),
    [
      ['08:00', 120],
      ['09:00', 320],
      ['10:00', 380],
    ],
  );
  assert.deepEqual(series.typical, [100, 300, 600]);
  // The target builds like a typical day: 10%, 30%, 60% of 2000.
  assert.deepEqual(series.target, [200, 600, 1200]);
});

test('before open: the typical day in full, no comparison line; no history spreads the target evenly', () => {
  const before = takenTodaySeries({
    buckets,
    revenueByHour: new Map(),
    typicalByHour,
    typicalDay: 1000,
    nowMinutes: 7 * 60,
    takenSoFar: 0,
    target: null,
    showToday: false,
  });
  assert.deepEqual(
    before.points.map((point) => point.value),
    [100, 300, 600, 1000],
  );
  assert.equal(before.typical, null);
  assert.equal(before.target, null);

  const noHistory = takenTodaySeries({
    buckets,
    revenueByHour: new Map([[8, 50]]),
    typicalByHour: new Map(),
    typicalDay: 0,
    nowMinutes: 9 * 60 + 30,
    takenSoFar: 90,
    target: 400,
    showToday: true,
  });
  assert.equal(noHistory.typical, null);
  assert.deepEqual(noHistory.target, [100, 200]);
});
