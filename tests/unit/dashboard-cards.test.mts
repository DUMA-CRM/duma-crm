import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentSummary,
  missingShifts,
  purchasingSummary,
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
