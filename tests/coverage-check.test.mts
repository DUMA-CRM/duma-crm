import assert from 'node:assert/strict';
import test from 'node:test';

const { coverageForDay, localHourOf, rosteredByHour } = await import('../lib/utils/coverage-check.ts');

// A winter day, so local time is UTC in the test's Europe/London-or-UTC runner either way;
// the BST case is checked through localHourOf directly.
const day = new Date(2026, 0, 14);
const at = (hour: number, minute = 0) => new Date(2026, 0, 14, hour, minute).toISOString();

test('any overlap with an hour counts someone as on for it; cancelled shifts do not', () => {
  const counts = rosteredByHour(
    [
      { startsAt: at(9), endsAt: at(13), status: 'published' },
      { startsAt: at(12, 30), endsAt: at(15), status: 'draft' },
      { startsAt: at(9), endsAt: at(17), status: 'cancelled' },
    ],
    day,
  );
  assert.deepEqual(counts.slice(8, 16), [0, 1, 1, 1, 2, 1, 1, 0]);
});

test('a UTC demand hour is moved to the local hour it falls in', () => {
  const summer = new Date(2026, 6, 14);
  const offset = -new Date(Date.UTC(2026, 6, 14, 12)).getTimezoneOffset() / 60;
  assert.equal(localHourOf(12, summer), (12 + offset + 24) % 24);
});

test('short runs merge, and over-staffing and the peak are reported', () => {
  const utc = (localHour: number) => (localHour - -new Date(2026, 0, 14, localHour).getTimezoneOffset() / 60 + 24) % 24;
  const demand = [
    { hour: utc(11), avgOrders: 8, recommendedStaff: 1 },
    { hour: utc(12), avgOrders: 30, recommendedStaff: 2 },
    { hour: utc(13), avgOrders: 28, recommendedStaff: 2 },
    { hour: utc(14), avgOrders: 6, recommendedStaff: 1 },
  ];
  const result = coverageForDay(demand, [{ startsAt: at(10), endsAt: at(16), status: 'published' }], day);
  assert.deepEqual(result.short, [{ from: 12, to: 14, by: 1 }]);
  assert.equal(result.hours[0].hour, 10);
  assert.equal(result.peak?.hour, 12);
  assert.equal(result.overHours, 0);
});

test('a day with no demand and nobody rostered is empty', () => {
  assert.deepEqual(coverageForDay([], [], day), { hours: [], short: [], overHours: 0, peak: null });
});
