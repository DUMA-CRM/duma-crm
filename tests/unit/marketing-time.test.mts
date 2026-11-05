import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarDays, scheduleCandidates } from '../../lib/utils/marketing-time.ts';

test('London DST gaps cannot silently move a post forward', () => {
  assert.deepEqual(scheduleCandidates('2026-03-29T01:30', 'Europe/London'), []);
  assert.deepEqual(scheduleCandidates('2026-03-29T02:30', 'Europe/London'), ['2026-03-29T01:30:00.000Z']);
});
test('London repeated hour requires an explicit offset choice', () => {
  assert.deepEqual(scheduleCandidates('2026-10-25T01:30', 'Europe/London'), ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z']);
});
test('non-hour timezone offsets and invalid calendar dates', () => {
  assert.deepEqual(scheduleCandidates('2026-11-03T09:00', 'Asia/Kathmandu'), ['2026-11-03T03:15:00.000Z']);
  assert.deepEqual(scheduleCandidates('2026-02-30T09:00', 'Europe/London'), []);
  assert.deepEqual(scheduleCandidates('bad', 'Europe/London'), []);
  assert.equal(calendarDays('2026-11-03', 'week')[0], '2026-11-02');
});
