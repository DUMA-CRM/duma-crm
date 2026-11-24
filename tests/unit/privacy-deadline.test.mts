import assert from 'node:assert/strict';
import { test } from 'node:test';

import { requestDeadline, summariseQueue } from '../../lib/utils/privacy-deadline.ts';

const request = (dueAt: string) => ({ receivedAt: '2026-10-26T09:00:00Z', dueAt, status: 'received' });

test('days are counted on the workspace calendar, not the device clock', () => {
  const now = Date.parse('2026-11-25T20:00:00Z');
  const late = request('2026-11-26T02:00:00Z');
  // 02:00 on the 26th in London; 21:00 on the 25th in New York.
  assert.equal(requestDeadline(late, now, 'Europe/London').label, 'Due tomorrow');
  assert.equal(requestDeadline(late, now, 'America/New_York').label, 'Due today');
});

test('a DST change does not shorten or lengthen a day', () => {
  const now = Date.parse('2026-03-28T12:00:00Z');
  assert.equal(requestDeadline(request('2026-03-30T12:00:00Z'), now, 'Europe/London').daysLeft, 2);
  assert.equal(requestDeadline(request('2026-10-26T00:30:00Z'), Date.parse('2026-10-24T23:30:00Z'), 'Europe/London').daysLeft, 1);
});

test('overdue and the queue summary use the same zone', () => {
  const now = Date.parse('2026-11-27T10:00:00Z');
  assert.equal(requestDeadline(request('2026-11-25T10:00:00Z'), now, 'Europe/London').label, '2 days overdue');
  const summary = summariseQueue(
    [request('2026-11-25T10:00:00Z'), request('2026-11-28T10:00:00Z'), request('2026-12-31T10:00:00Z')],
    now,
    'Europe/London',
  );
  assert.deepEqual(summary, { open: 3, dueSoon: 1, overdue: 1, closedRecently: 0 });
});
