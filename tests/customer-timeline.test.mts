import assert from 'node:assert/strict';
import test from 'node:test';

import { countTimelineKinds, groupTimelineByDay, orderStands, timelineDayLabel, timelineRowText } from '../lib/utils/customer-timeline.ts';

// Local times throughout, so the test means the same in any timezone.
const NOW = new Date(2026, 9, 3, 15, 0);
const at = (day: number, hour = 12, month = 9, year = 2026) => new Date(year, month, day, hour).toISOString();

test('days read as today, yesterday, a weekday this year, a full date before it', () => {
  assert.equal(timelineDayLabel(new Date(2026, 9, 3, 1), NOW), 'Today');
  assert.equal(timelineDayLabel(new Date(2026, 9, 2, 23), NOW), 'Yesterday');
  // "Sep" or "Sept" depending on the ICU build.
  assert.match(timelineDayLabel(new Date(2026, 8, 28), NOW), /^Mon 28 Sept?$/);
  assert.match(timelineDayLabel(new Date(2025, 11, 24), NOW), /2025$/);
});

test('entries group by day in arrival order, with the day’s standing spend', () => {
  const days = groupTimelineByDay(
    [
      { kind: 'order', at: at(3, 14), total: '12.50', status: 'completed' },
      { kind: 'points', at: at(3, 13) },
      { kind: 'order', at: at(3, 9), total: '8.00', status: 'cancelled' },
      { kind: 'order', at: at(1, 10), total: '20.00', status: 'completed', refundStatus: 'partial' },
    ],
    NOW,
  );
  assert.deepEqual(
    days.map((day) => [day.label, day.entries.length, day.orders, day.spend]),
    [
      ['Today', 3, 1, 12.5],
      [days[1].label, 1, 1, 20],
    ],
  );
});

test('a fully refunded or cancelled order does not count as spend', () => {
  assert.equal(orderStands({ kind: 'order', at: at(1), status: 'completed', refundStatus: 'full' }), false);
  assert.equal(orderStands({ kind: 'order', at: at(1), status: 'voided' }), false);
  assert.equal(orderStands({ kind: 'email', at: at(1) }), false);
});

test('kinds are counted for the filter chips', () => {
  assert.deepEqual(
    countTimelineKinds([
      { kind: 'order', at: at(1) },
      { kind: 'order', at: at(1) },
      { kind: 'email', at: at(1) },
    ]),
    { order: 2, points: 0, email: 1, consent: 0, privacy: 0 },
  );
});

const money = (amount: number) => `£${amount.toFixed(2)}`;
const NOW_MS = NOW.getTime();

test('an order row leads with its amount and says where it was taken', () => {
  const row = timelineRowText(
    {
      kind: 'order',
      at: at(3),
      total: '12.5',
      source: 'pos',
      status: 'done',
      points: { delta: 12, balanceAfter: 140 },
    },
    money,
    NOW_MS,
  );
  assert.deepEqual(row, { lead: '£12.50', phrase: 'order at the till', detail: 'Done · +12 points', pill: undefined });
});

test('only what went differently gets a pill', () => {
  assert.deepEqual(timelineRowText({ kind: 'order', at: at(3), total: '5', refundStatus: 'full' }, money, NOW_MS).pill, {
    label: 'Refunded',
    tone: 'exception',
  });
  assert.equal(timelineRowText({ kind: 'email', at: at(3), status: 'sent', subject: 'Hi' }, money, NOW_MS).pill, undefined);
  assert.equal(timelineRowText({ kind: 'email', at: at(3), status: 'failed', subject: 'Hi' }, money, NOW_MS).pill?.label, 'Failed');
  assert.equal(
    timelineRowText({ kind: 'privacy', at: at(1), type: 'erasure', status: 'received', dueAt: at(2) }, money, NOW_MS).pill?.label,
    'Overdue',
  );
});

test('a points row reads as a signed amount with its reason', () => {
  assert.deepEqual(timelineRowText({ kind: 'points', at: at(3), delta: -20, balanceAfter: 80, reason: 'Correction' }, money, NOW_MS), {
    lead: '−20 points',
    phrase: 'removed',
    detail: 'Correction · balance 80',
  });
});
