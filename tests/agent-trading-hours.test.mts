import assert from 'node:assert/strict';
import test from 'node:test';

import { addDays, isWithinHours, zonedIso, zonedNow } from '../lib/ai/agent-format.ts';

test('a normal trading day is open between its hours and shut outside them', () => {
  assert.equal(isWithinHours('07:00', '07:00', '17:00'), true);
  assert.equal(isWithinHours('14:32', '07:00', '17:00'), true);
  assert.equal(isWithinHours('06:59', '07:00', '17:00'), false);
  // Closing time is the moment the doors shut, not the last minute open.
  assert.equal(isWithinHours('17:00', '07:00', '17:00'), false);
});

test('a late shift that runs past midnight stays open across the date change', () => {
  assert.equal(isWithinHours('23:30', '18:00', '02:00'), true);
  assert.equal(isWithinHours('01:59', '18:00', '02:00'), true);
  assert.equal(isWithinHours('02:00', '18:00', '02:00'), false);
  assert.equal(isWithinHours('12:00', '18:00', '02:00'), false);
});

test('an empty window is never open', () => {
  assert.equal(isWithinHours('09:00', '09:00', '09:00'), false);
});

test('the trading day is read in the location timezone, not the server one', () => {
  // 01:30 UTC on a Saturday is still Friday evening in New York.
  const instant = new Date('2026-08-08T01:30:00Z');

  const london = zonedNow('Europe/London', instant);
  const newYork = zonedNow('America/New_York', instant);

  assert.deepEqual(london, { weekday: 'sat', date: '2026-08-08', time: '02:30' });
  assert.deepEqual(newYork, { weekday: 'fri', date: '2026-08-07', time: '21:30' });
});

test('midnight reads as 00:00 rather than hour 24', () => {
  const midnight = zonedNow('Europe/London', new Date('2026-01-15T00:00:00Z'));
  assert.equal(midnight.time, '00:00');
  assert.equal(midnight.date, '2026-01-15');
});

// The rota endpoints filter on instants. Asking for "today" with a bare date
// once meant "up to midnight this morning", which hid every shift actually
// being worked that day.
test('a single-day rota window contains that whole local day', () => {
  const zone = 'Europe/London';
  const day = '2026-08-07';
  const from = zonedIso(day, '00:00', zone);
  const to = zonedIso(addDays(day, 1), '00:00', zone);

  const within = (instant: string) => instant >= from && instant < to;

  assert.equal(within(zonedIso(day, '00:00', zone)), true, 'opening minute');
  assert.equal(within(zonedIso(day, '09:00', zone)), true, 'a morning shift');
  assert.equal(within(zonedIso(day, '23:59', zone)), true, 'the last minute of the day');
  assert.equal(within(zonedIso(addDays(day, -1), '23:59', zone)), false, 'last night');
  assert.equal(within(zonedIso(addDays(day, 1), '00:00', zone)), false, 'tomorrow morning');
  // British Summer Time: the local day starts an hour before UTC midnight.
  assert.equal(from, '2026-08-06T23:00:00.000Z');
});

test('calendar dates step across month and year boundaries', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
});
