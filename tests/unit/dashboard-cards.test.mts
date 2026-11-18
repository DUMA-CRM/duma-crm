import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentSummary,
  dailyPick,
  deliveriesDue,
  missingShifts,
  purchasingSummary,
  stockAttention,
  stockHealthSummary,
  teamTodaySummary,
  topNeeds,
  wholePercents,
} from '../../lib/utils/dashboard-cards.ts';

const NOW = new Date('2026-11-17T12:00:00Z');

test('top needs: three shown, the rest counted behind the link', () => {
  assert.deepEqual(topNeeds(['a', 'b', 'c', 'd', 'e']), { shown: ['a', 'b', 'c'], more: 2 });
  assert.deepEqual(topNeeds(['a']), { shown: ['a'], more: 0 });
  assert.deepEqual(topNeeds([]), { shown: [], more: 0 });
});

test('missing shifts by name agree with the team count and ignore covered, open and future shifts', () => {
  const shift = (id: string, userId: string | null, startsAt: string, name = id) => ({
    id,
    userId,
    startsAt,
    endsAt: '2026-11-17T18:00:00Z',
    staff: userId ? { user: { name } } : undefined,
  });
  const input = {
    rota: [
      shift('late-b', 'u2', '2026-11-17T11:00:00Z', 'Bea'),
      shift('late-a', 'u1', '2026-11-17T09:00:00Z', 'Ali'),
      shift('in', 'u3', '2026-11-17T09:00:00Z'), // clocked in against it
      shift('grace', 'u4', '2026-11-17T11:55:00Z'), // inside the 10-minute grace
      shift('open', null, '2026-11-17T08:00:00Z'), // nobody given it
    ],
    active: [{ userId: 'u3', clockedIn: '2026-11-17T09:00:00Z', scheduledShiftId: 'in' }],
    now: NOW,
  };
  const missing = missingShifts(input);
  assert.deepEqual(
    missing.map((item) => item.name),
    ['Ali', 'Bea'],
  );
  assert.equal(missing.length, teamTodaySummary(input).missing);
});

test('whole percents add up to 100 by largest remainder', () => {
  assert.deepEqual(wholePercents([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(wholePercents([820.5, 419.5]), [66, 34]);
  assert.equal(
    wholePercents([12.34, 56.78, 9.1, 0.4]).reduce((sum, value) => sum + value, 0),
    100,
  );
  assert.deepEqual(wholePercents([0, 0]), [0, 0]);
});

test('purchasing: due deliveries lead; part deliveries and unsent drafts are the needs, empties dropped', () => {
  assert.deepEqual(purchasingSummary({ drafts: 2, sent: 3, partial: 0 }), {
    awaiting: 3,
    needs: [{ key: 'drafts', label: 'Drafts not sent', value: 2 }],
  });
  assert.equal(purchasingSummary({ drafts: 0, sent: 1, partial: 2 }).awaiting, 3);
});

test('content: scheduled is a status, not a need', () => {
  const summary = contentSummary({ live: 12, scheduled: 2, review: 1, changed: 0, draft: 3 });
  assert.equal(summary.scheduled, 2);
  assert.deepEqual(
    summary.needs.map((need) => need.key),
    ['review', 'draft'],
  );
});

test('stock attention: each item once under its worst reason, in the order to act on', () => {
  const row = (name: string, onHand: string, reorderLevel: string, needsReorder: boolean, earliestExpiryDate: string | null = null) => ({
    name,
    totalOnHand: onHand,
    reorderLevel,
    needsReorder,
    earliestExpiryDate,
  });
  const rows = [
    row('milk', '4', '10', true, '2026-11-18'), // low and expiring: listed once, as low
    row('beans', '0', '5', true, '2026-11-19'), // out beats expiring
    row('flour', '9', '10', true),
    row('salt', '2', '0', true), // a par of 0 is "none set", not low
    row('cream', '3', '2', false, '2026-11-20'),
    row('eggs', '6', '2', false, '2026-11-19'),
    row('rice', '50', '10', false, '2026-12-30'), // expiring past the week: fine
  ];
  assert.deepEqual(
    stockAttention(rows, NOW).map(({ row, reason }) => `${reason}:${row.name}`),
    ['out:beans', 'low:milk', 'low:flour', 'expiring:eggs', 'expiring:cream'],
  );
  // The list never names more than the counts say.
  const summary = stockHealthSummary(rows, NOW);
  const listed = stockAttention(rows, NOW);
  assert.equal(listed.filter((item) => item.reason === 'out').length, summary.out);
  assert.equal(listed.filter((item) => item.reason === 'low').length, summary.low);
});

test('deliveries due: most overdue first, then soonest, undated last, each once', () => {
  const orders = [
    { id: 'tomorrow', expectedAt: '2026-11-18T09:00:00Z' },
    { id: 'undated', expectedAt: null },
    { id: 'three-days-late', expectedAt: '2026-11-14T09:00:00Z' },
    { id: 'this-morning', expectedAt: '2026-11-17T08:00:00Z' },
    { id: 'tomorrow', expectedAt: '2026-11-18T09:00:00Z' }, // in both the sent and part-delivered pages
  ];
  assert.deepEqual(
    deliveriesDue(orders, NOW).map(({ order, lateDays }) => `${order.id}:${lateDays}`),
    ['three-days-late:3', 'this-morning:0', 'tomorrow:0', 'undated:0'],
  );
});

test('daily pick: one photo all day, every photo before any repeats', () => {
  const photos = ['a', 'b', 'c'];
  assert.equal(dailyPick(photos, '2026-11-18'), dailyPick(photos, '2026-11-18'));
  const week = ['2026-11-18', '2026-11-19', '2026-11-20'].map((day) => dailyPick(photos, day));
  assert.deepEqual([...week].sort(), photos);
  assert.equal(dailyPick([], '2026-11-18'), undefined);
});
