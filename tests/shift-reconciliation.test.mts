import assert from 'node:assert/strict';
import test from 'node:test';

const { reconcileClockEntries } = await import('../lib/utils/shift-reconciliation.ts');

const planned = (id: string, start: string, userId = 'u1') =>
  ({
    id,
    userId,
    locationId: 'loc-1',
    startsAt: start,
    endsAt: new Date(new Date(start).getTime() + 4 * 60 * 60_000).toISOString(),
    status: 'published',
  }) as never;

const actual = (id: string, start: string, scheduledShiftId?: string) =>
  ({
    id,
    userId: 'u1',
    locationId: 'loc-1',
    clockedIn: start,
    clockedOut: new Date(new Date(start).getTime() + 3 * 60 * 60_000).toISOString(),
    scheduledShiftId,
  }) as never;

test('an unlinked clock record is assigned to only the closest shift on the same day', () => {
  const morning = planned('morning', '2026-09-14T08:00:00.000Z');
  const evening = planned('evening', '2026-09-14T16:00:00.000Z');
  const worked = actual('worked', '2026-09-14T15:55:00.000Z');
  const result = reconcileClockEntries([morning, evening], [worked]);
  assert.deepEqual(result.byShiftId.get('morning') ?? [], []);
  assert.deepEqual(result.byShiftId.get('evening'), [worked]);
  assert.deepEqual(result.unplanned, []);
});

test('an explicitly linked clock record stays with its shift', () => {
  const morning = planned('morning', '2026-09-14T08:00:00.000Z');
  const evening = planned('evening', '2026-09-14T16:00:00.000Z');
  const worked = actual('worked', '2026-09-14T15:55:00.000Z', 'morning');
  const result = reconcileClockEntries([morning, evening], [worked]);
  assert.deepEqual(result.byShiftId.get('morning'), [worked]);
  assert.deepEqual(result.byShiftId.get('evening') ?? [], []);
});

test('work without a matching rota entry remains visible as unplanned attendance', () => {
  const worked = actual('worked', '2026-09-14T08:00:00.000Z');
  assert.deepEqual(reconcileClockEntries([], [worked]).unplanned, [worked]);
});
