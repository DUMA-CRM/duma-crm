import assert from 'node:assert/strict';
import test from 'node:test';

import { formResponsesSummary, promotionsCardSummary, recentUses, socialPostsSummary } from '../../lib/dashboard/engagement-cards.ts';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const DAY = 86_400_000;

const promotion = (
  id: string,
  fields: Partial<{
    status: 'active' | 'paused' | 'archived';
    startsAt: string | null;
    endsAt: string | null;
    maxRedemptions: number | null;
    redemptionCount: number;
  }> = {},
) => ({
  id,
  name: id,
  status: 'active' as const,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  redemptionCount: 0,
  ...fields,
});

test('promotions: standings split; live ones ending within a week lead, soonest first, the rest by most used', () => {
  const summary = promotionsCardSummary(
    [
      promotion('busy', { redemptionCount: 40 }),
      promotion('quiet', { redemptionCount: 2 }),
      promotion('ends-friday', { endsAt: new Date(NOW + 3 * DAY).toISOString() }),
      promotion('ends-tonight', { endsAt: new Date(NOW + 6 * 3_600_000).toISOString() }),
      promotion('ends-next-month', { endsAt: new Date(NOW + 30 * DAY).toISOString(), redemptionCount: 1 }),
      promotion('used-up', { maxRedemptions: 10, redemptionCount: 10 }),
      promotion('ended', { endsAt: new Date(NOW - DAY).toISOString() }),
      promotion('later', { startsAt: new Date(NOW + DAY).toISOString() }),
      promotion('paused', { status: 'paused' }),
      promotion('archived', { status: 'archived' }),
    ],
    NOW,
  );
  assert.deepEqual(
    summary.live.map((row) => row.id),
    ['ends-tonight', 'ends-friday', 'busy', 'quiet', 'ends-next-month'],
  );
  assert.equal(summary.endingSoon, 2);
  assert.deepEqual(
    { scheduled: summary.scheduled, paused: summary.paused, ended: summary.ended, total: summary.total },
    { scheduled: 1, paused: 1, ended: 2, total: 9 },
  );
});

test('uses this week: reversed uses and older ones don’t count; a full page inside the week is a floor', () => {
  const use = (daysAgo: number, status: 'applied' | 'reversed' = 'applied') => ({
    status,
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
  });
  assert.deepEqual(recentUses({ data: [use(1), use(2, 'reversed'), use(6.9), use(7.1)], pagination: { limit: 50, total: 4 } }, NOW), {
    uses: 2,
    capped: false,
  });
  const full = Array.from({ length: 50 }, () => use(1));
  assert.deepEqual(recentUses({ data: full, pagination: { limit: 50, total: 80 } }, NOW), { uses: 50, capped: true });
  assert.deepEqual(recentUses({ data: full, pagination: { limit: 50, total: 50 } }, NOW), { uses: 50, capped: false });
});

test('form responses: only forms with new ones, newest response first; seen is what is stored and not new', () => {
  const form = (id: string, responseCount: number, newResponses: number, lastResponseAt: string | null) => ({
    id,
    name: id,
    responseCount,
    newResponses,
    lastResponseAt,
  });
  const summary = formResponsesSummary([
    form('old', 10, 2, '2026-11-20T09:00:00Z'),
    form('none', 5, 0, '2026-11-24T09:00:00Z'),
    form('new', 3, 3, '2026-11-24T10:00:00Z'),
    form('empty', 0, 0, null),
  ]);
  assert.deepEqual(
    summary.waiting.map((row) => row.id),
    ['new', 'old'],
  );
  assert.deepEqual({ fresh: summary.fresh, seen: summary.seen, stored: summary.stored }, { fresh: 5, seen: 13, stored: 18 });
});

test('social posts: failures need someone, then what is still to go out soonest first; drafts and past slots are neither', () => {
  const target = (id: string, status: string, scheduledAt: string | null) => ({
    id,
    connectionId: 'c1',
    caption: id,
    scheduledAt,
    status,
    error: null,
  });
  const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();
  const summary = socialPostsSummary(
    [
      {
        id: 'p1',
        title: 'One',
        caption: '',
        targets: [target('later', 'scheduled', at(48)), target('failed', 'failed', at(-5)), target('out', 'published', at(-24))],
      },
      {
        id: 'p2',
        title: 'Two',
        caption: '',
        targets: [target('soon', 'scheduled', at(2)), target('draft', 'draft', at(3)), target('check', 'needs-reconciliation', at(-1))],
      },
      { id: 'p3', title: 'Three', caption: '', targets: [target('missed', 'scheduled', at(-2))] },
    ],
    NOW,
  );
  assert.deepEqual(
    summary.attention.map((row) => row.target.id),
    ['check', 'failed'],
  );
  assert.deepEqual(
    summary.upcoming.map((row) => row.target.id),
    ['soon', 'later'],
  );
  assert.equal(summary.published, 1);
  assert.equal(summary.next, at(2));
});
