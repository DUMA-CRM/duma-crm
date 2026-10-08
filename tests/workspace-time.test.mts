import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCalendarDate,
  formatInstant,
  setWorkspaceTimeZone,
  workspaceDateKey,
  workspaceTimeZone,
  zonedParts,
  zonedToInstant,
} from '../lib/utils/workspace-time.ts';

test('instants read in the workspace zone, whatever zone the device is in', () => {
  setWorkspaceTimeZone('Europe/Kyiv');
  // 21:30 UTC is already the next day in Kyiv.
  assert.equal(formatInstant('2026-10-08T21:30:00Z', { hour: '2-digit', minute: '2-digit' }), '00:30');
  assert.equal(workspaceDateKey('2026-10-08T21:30:00Z'), '2026-10-09');
  assert.equal(zonedParts('2026-10-08T21:30:00Z').weekday, 5); // Friday

  setWorkspaceTimeZone('America/New_York');
  assert.equal(formatInstant('2026-10-08T21:30:00Z', { hour: '2-digit', minute: '2-digit' }), '17:30');
  setWorkspaceTimeZone(null);
});

test('an invalid zone is ignored rather than breaking every format', () => {
  setWorkspaceTimeZone('Mars/Olympus');
  assert.equal(workspaceTimeZone(), undefined);
  assert.equal(formatInstant('not a date', { hour: '2-digit' }), '—');
});

test('a calendar date is never moved by a zone', () => {
  setWorkspaceTimeZone('Pacific/Kiritimati'); // UTC+14
  assert.equal(formatCalendarDate('2026-01-01', { day: 'numeric', month: 'short', year: 'numeric' }), '1 Jan 2026');
  setWorkspaceTimeZone('Pacific/Pago_Pago'); // UTC-11
  assert.equal(formatCalendarDate('2026-01-01T00:00:00Z', { day: 'numeric', month: 'short' }), '1 Jan');
  setWorkspaceTimeZone(null);
});

test('a picked wall-clock time becomes the instant at the business, across DST', () => {
  assert.equal(zonedToInstant('2026-07-01', '09:00', 'Europe/London')?.toISOString(), '2026-07-01T08:00:00.000Z'); // BST
  assert.equal(zonedToInstant('2026-12-01', '09:00', 'Europe/London')?.toISOString(), '2026-12-01T09:00:00.000Z'); // GMT
  assert.equal(zonedToInstant('2026-10-25', '09:00', 'Europe/London')?.toISOString(), '2026-10-25T09:00:00.000Z'); // the change day
  assert.equal(zonedToInstant('2026-03-29', '01:30', 'Europe/London')?.toISOString(), '2026-03-29T01:30:00.000Z'); // skipped hour → 02:30 BST
  assert.equal(zonedToInstant('2026-07-01', '09:00', 'Asia/Kolkata')?.toISOString(), '2026-07-01T03:30:00.000Z');
  assert.equal(zonedToInstant('nope', '09:00', 'Europe/London'), null);
});

const { timeZoneCity, timeZoneGap, timeZoneOffsetLabel } = await import('../lib/utils/workspace-time.ts');

test('a zone is described by its city, its offset and its gap to the device', () => {
  const summer = new Date('2026-07-01T12:00:00Z');
  assert.equal(timeZoneCity('America/Argentina/Buenos_Aires'), 'Buenos Aires');
  assert.equal(timeZoneOffsetLabel('Europe/London', summer), 'GMT+1');
  assert.equal(timeZoneOffsetLabel('Europe/London', new Date('2026-12-01T12:00:00Z')), 'GMT');
  assert.equal(timeZoneOffsetLabel('Asia/Kolkata', summer), 'GMT+5:30');
  assert.equal(timeZoneOffsetLabel('America/New_York', summer), 'GMT−4');
  assert.equal(timeZoneGap('Europe/Kyiv', 'Europe/London', summer), '2 h ahead of this device');
  assert.equal(timeZoneGap('Asia/Kolkata', 'Europe/London', summer), '4 h 30 min ahead of this device');
  assert.equal(timeZoneGap('America/New_York', 'Europe/London', summer), '5 h behind this device');
  assert.equal(timeZoneGap('Europe/London', 'Europe/London', summer), 'Same time as this device');
});
