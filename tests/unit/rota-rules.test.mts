import assert from 'node:assert/strict';
import test from 'node:test';

import { UK_RULES, checkRota, localParts, paidMinutes } from '../../lib/utils/rota-rules.ts';

const shift = (id: string, startsAt: string, endsAt: string, extra: Partial<{ userId: string | null; breakMinutes: number; positionId: string | null }> = {}) => ({
  id,
  userId: 'ana',
  startsAt,
  endsAt,
  breakMinutes: 0,
  positionId: null,
  ...extra,
});
const adult = { userId: 'ana', isMinor: false, positionIds: ['barista'], contractedWeeklyMinutes: null };
const kinds = (warnings: { kind: string }[]) => warnings.map((w) => w.kind).sort();

test('a long shift without its break and a short turnaround both warn; paid time leaves the break out', () => {
  const late = shift('late', '2026-11-16T14:00:00Z', '2026-11-16T22:30:00Z');
  const early = shift('early', '2026-11-17T06:00:00Z', '2026-11-17T12:00:00Z', { breakMinutes: 20 });
  assert.equal(paidMinutes(early), 340);
  const warnings = checkRota([early, late], [adult]);
  assert.deepEqual(kinds(warnings), ['break', 'rest']);
  assert.deepEqual(
    warnings.find((w) => w.kind === 'rest'),
    { kind: 'rest', shiftId: 'early', userId: 'ana', restMinutes: 450, requiredRest: 660 },
  );
});

test('under-18s get the stricter day, week, rest and break limits', () => {
  const minor = { ...adult, isMinor: true };
  const day = shift('day', '2026-11-16T08:00:00Z', '2026-11-16T17:00:00Z', { breakMinutes: 20 });
  assert.deepEqual(kinds(checkRota([day], [minor])), ['break', 'daily']);
  assert.deepEqual(kinds(checkRota([day], [adult])), []);
});

test('the weekly limit, overlaps, position, leave and availability are all caught', () => {
  const week = Array.from({ length: 6 }, (_, d) =>
    shift(`d${d}`, `2026-11-${16 + d}T08:00:00Z`, `2026-11-${16 + d}T17:00:00Z`, { breakMinutes: 30 }),
  );
  assert.deepEqual(kinds(checkRota(week, [adult])), ['weekly']);

  const a = shift('a', '2026-11-16T08:00:00Z', '2026-11-16T12:00:00Z', { positionId: 'kitchen' });
  const b = shift('b', '2026-11-16T11:00:00Z', '2026-11-16T15:00:00Z');
  const warnings = checkRota([a, b], [adult], UK_RULES, {
    leave: [{ userId: 'ana', startDate: '2026-11-16', endDate: '2026-11-16' }],
    availability: [{ userId: 'ana', weekday: 0, startMinute: 13 * 60, endMinute: 18 * 60, kind: 'unavailable' }],
    timeZone: 'Europe/London',
  });
  assert.deepEqual(kinds(warnings), ['leave', 'leave', 'overlap', 'unavailable', 'unqualified']);
});

test('open shifts are ignored and a contract overrun is only a nudge below the legal limit', () => {
  const open = shift('o', '2026-11-16T08:00:00Z', '2026-11-16T20:00:00Z', { userId: null });
  assert.deepEqual(checkRota([open], [adult]), []);
  const contracted = { ...adult, contractedWeeklyMinutes: 240 };
  const long = shift('l', '2026-11-16T08:00:00Z', '2026-11-16T13:00:00Z');
  assert.deepEqual(kinds(checkRota([long], [contracted])), ['over_contract']);
});

test('local parts follow the location’s clock across a DST change', () => {
  assert.deepEqual(localParts('2026-07-06T07:30:00Z', 'Europe/London'), { date: '2026-07-06', weekday: 0, minute: 510 });
  assert.deepEqual(localParts('2026-11-15T23:30:00Z', 'Europe/London'), { date: '2026-11-15', weekday: 6, minute: 1410 });
});

test('a short shift inside an earlier long one still counts as an overlap', () => {
  const long = shift('long', '2026-11-16T08:00:00Z', '2026-11-16T20:00:00Z', { breakMinutes: 30 });
  const first = shift('first', '2026-11-16T09:00:00Z', '2026-11-16T10:00:00Z');
  const second = shift('second', '2026-11-16T11:00:00Z', '2026-11-16T12:00:00Z');
  const overlaps = checkRota([long, first, second], [adult]).filter((w) => w.kind === 'overlap');
  assert.deepEqual(overlaps.map((w) => w.shiftId), ['first', 'second']);
});
