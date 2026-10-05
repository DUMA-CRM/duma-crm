import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assignWorked,
  diffRota,
  formatDuration,
  leaveOnDay,
  localDateKey,
  mondayOf,
  paidMinutes,
  rotaSnapshot,
  shiftProgress,
  shiftState,
  unpaidBreak,
  weekOffsetFor,
  workedMinutes,
} from '../lib/utils/my-rota.ts';

const SHIFT = { id: 's1', locationId: 'loc', startsAt: '2026-10-03T09:00:00Z', endsAt: '2026-10-03T17:00:00Z' };
const at = (time: string) => Date.parse(`2026-10-03T${time}:00Z`);

test('a shift is upcoming, then now, then done', () => {
  assert.equal(shiftState(SHIFT, at('08:59')), 'upcoming');
  assert.equal(shiftState(SHIFT, at('09:00')), 'now');
  assert.equal(shiftState(SHIFT, at('17:00')), 'done');
});

test('progress only while it runs', () => {
  assert.equal(shiftProgress(SHIFT, at('13:00')), 0.5);
  assert.equal(shiftProgress(SHIFT, at('08:00')), null);
  assert.equal(shiftProgress(SHIFT, at('18:00')), null);
});

test('worked minutes use the recorded duration, or run to now', () => {
  assert.equal(
    workedMinutes(
      [
        { id: 'a', locationId: 'loc', clockedIn: '2026-10-03T09:00:00Z', clockedOut: '2026-10-03T10:00:00Z', durationMinutes: 55 },
        { id: 'b', locationId: 'loc', clockedIn: '2026-10-03T12:00:00Z' },
      ],
      at('12:30'),
    ),
    85,
  );
});

test('the contract break sits inside long shifts only', () => {
  assert.deepEqual(unpaidBreak(480, { thresholdMins: 360, unpaidMins: 30 }), { from: 360, to: 390 });
  assert.equal(unpaidBreak(300, { thresholdMins: 360, unpaidMins: 30 }), null);
  assert.equal(unpaidBreak(480, undefined), null);
});

test('durations read as hours and minutes', () => {
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(480), '8h');
  assert.equal(formatDuration(475.4), '7h 55m');
});

test('a clock-in in the same hours joins the shift, even at another location', () => {
  const { byShift, unplanned } = assignWorked(
    [SHIFT],
    [{ id: 'other-till', locationId: 'elsewhere', clockedIn: '2026-10-03T09:05:00Z', clockedOut: '2026-10-03T17:00:00Z' }],
    at('18:00'),
  );
  assert.deepEqual(
    byShift.get('s1')!.map((entry) => entry.id),
    ['other-till'],
  );
  assert.deepEqual(unplanned, []);
});

test('between two overlapping shifts, the same location wins', () => {
  const other = { ...SHIFT, id: 's2', locationId: 'loc-b' };
  const { byShift } = assignWorked([SHIFT, other], [{ id: 'w', locationId: 'loc-b', clockedIn: '2026-10-03T09:00:00Z' }], at('10:00'));
  assert.equal(byShift.get('s1')!.length, 0);
  assert.equal(byShift.get('s2')!.length, 1);
});

test('leftover clock-ins under an hour apart merge into one unplanned run', () => {
  const { unplanned } = assignWorked(
    [SHIFT],
    [
      { id: 'a', locationId: 'loc', clockedIn: '2026-10-03T18:00:00Z', clockedOut: '2026-10-03T19:00:00Z' },
      { id: 'b', locationId: 'loc', clockedIn: '2026-10-03T19:30:00Z', clockedOut: '2026-10-03T21:00:00Z' },
      { id: 'c', locationId: 'loc', clockedIn: '2026-10-03T23:00:00Z', clockedOut: '2026-10-03T23:30:00Z' },
    ],
    at('23:59'),
  );
  assert.deepEqual(
    unplanned.map((run) => run.map((entry) => entry.id)),
    [['a', 'b'], ['c']],
  );
});

test('a clock-in linked to a shift goes to it, whatever its hours', () => {
  const other = { ...SHIFT, id: 's2', startsAt: '2026-10-03T18:00:00Z', endsAt: '2026-10-03T22:00:00Z' };
  const { byShift } = assignWorked(
    [SHIFT, other],
    [{ id: 'linked', locationId: 'loc', clockedIn: '2026-10-03T09:00:00Z', scheduledShiftId: 's2' }],
    at('10:00'),
  );
  assert.equal(byShift.get('s1')!.length, 0);
  assert.equal(byShift.get('s2')!.length, 1);
});

test('leave covers its days inclusive, approved before pending, and ignores the rest', () => {
  const requests = [
    { id: 'p', startDate: '2026-10-05', endDate: '2026-10-05', status: 'pending' as const },
    { id: 'a', startDate: '2026-10-03', endDate: '2026-10-06', status: 'approved' as const },
    { id: 'd', startDate: '2026-10-05', endDate: '2026-10-05', status: 'declined' as const },
  ];
  assert.deepEqual(
    leaveOnDay(requests, new Date(2026, 9, 5)).map((request) => request.id),
    ['a', 'p'],
  );
  assert.deepEqual(leaveOnDay(requests, new Date(2026, 9, 7)), []);
});

test('paid minutes take the unpaid break off', () => {
  assert.equal(paidMinutes(SHIFT, { thresholdMins: 360, unpaidMins: 30 }), 450);
  assert.equal(paidMinutes(SHIFT, undefined), 480);
});

test('the rota diff marks new and changed shifts, and nothing on a first visit', () => {
  const before = rotaSnapshot([SHIFT]);
  const moved = { ...SHIFT, startsAt: '2026-10-03T10:00:00Z' };
  const added = { ...SHIFT, id: 's9' };
  assert.deepEqual(
    [...diffRota(before, [moved, added])],
    [
      ['s1', 'changed'],
      ['s9', 'new'],
    ],
  );
  assert.equal(diffRota(before, [SHIFT]).size, 0);
  assert.equal(diffRota(null, [moved, added]).size, 0);
});

test('a date maps to a week offset from this week', () => {
  const today = new Date(2026, 9, 3); // Saturday
  assert.equal(weekOffsetFor(new Date(2026, 8, 28), today), 0); // that Monday
  assert.equal(weekOffsetFor(new Date(2026, 9, 5), today), 1);
  assert.equal(weekOffsetFor(new Date(2026, 8, 27), today), -1);
  assert.equal(localDateKey(mondayOf(today)), '2026-09-28');
});
