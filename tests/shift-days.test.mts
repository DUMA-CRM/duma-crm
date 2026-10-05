import assert from 'node:assert/strict';
import test from 'node:test';

const { groupShiftsByDay } = await import('../lib/utils/shift-days.ts');

const record = (dateKey: string, at: string, planned: number, worked: number, cost: number | null) => ({
  dateKey,
  at,
  plannedMinutes: planned,
  workedMinutes: worked,
  estimatedCost: cost,
});

test('records sit under their day, earliest shift first, with the day totals', () => {
  const days = groupShiftsByDay([
    record('2026-09-24', '2026-09-24T13:00:00Z', 300, 290, 50),
    record('2026-09-23', '2026-09-23T09:00:00Z', 480, 0, null),
    record('2026-09-24', '2026-09-24T08:00:00Z', 240, 240, 40),
  ]);
  assert.deepEqual(
    days.map((day) => [day.dateKey, day.records.map((item) => item.at.slice(11, 16)), day.plannedMinutes, day.workedMinutes, day.cost]),
    [
      ['2026-09-23', ['09:00'], 480, 0, 0],
      ['2026-09-24', ['08:00', '13:00'], 540, 530, 90],
    ],
  );
});

test('looking back, the latest day comes first', () => {
  const days = groupShiftsByDay([record('2026-09-23', 'a', 0, 0, null), record('2026-09-24', 'b', 0, 0, null)], 'desc');
  assert.deepEqual(
    days.map((day) => day.dateKey),
    ['2026-09-24', '2026-09-23'],
  );
});
