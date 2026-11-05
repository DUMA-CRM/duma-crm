import assert from 'node:assert/strict';
import test from 'node:test';

import { canDeletePost, destinationSummary, destinationTimeline, durationLabel } from '../../lib/utils/marketing-status.ts';

const NOW = Date.parse('2026-11-04T12:00:00Z');

test('a post’s destinations are counted by whether anyone has to act', () => {
  const summary = destinationSummary(
    [
      { status: 'published', scheduledAt: '2026-11-03T09:00:00Z' },
      { status: 'failed', scheduledAt: '2026-11-04T09:00:00Z' },
      { status: 'needs-reconciliation', scheduledAt: null },
      { status: 'blocked', scheduledAt: null },
      { status: 'scheduled', scheduledAt: '2026-11-06T18:00:00Z' },
      { status: 'draft', scheduledAt: null },
      { status: 'cancelled', scheduledAt: '2026-11-05T09:00:00Z' },
    ],
    NOW,
  );
  assert.deepEqual(
    { ...summary, nextAt: undefined },
    { total: 7, published: 1, attention: 3, waiting: 2, cancelled: 1, nextAt: undefined },
  );
});

test('the next send is the soonest destination still to go out, never a past or cancelled one', () => {
  const summary = destinationSummary(
    [
      { status: 'scheduled', scheduledAt: '2026-11-04T11:59:00Z' },
      { status: 'cancelled', scheduledAt: '2026-11-04T13:00:00Z' },
      { status: 'scheduled', scheduledAt: '2026-11-07T08:00:00Z' },
      { status: 'scheduled', scheduledAt: '2026-11-05T08:00:00Z' },
    ],
    NOW,
  );
  assert.equal(summary.nextAt, '2026-11-05T08:00:00Z');
  assert.equal(destinationSummary([{ status: 'published', scheduledAt: '2026-11-05T08:00:00Z' }], NOW).nextAt, null);
});

const states = (t: ReturnType<typeof destinationTimeline>) => t.steps.map((s) => `${s.label}:${s.state}`);

test('a destination waiting to go out counts down to its time, then up once it’s overdue', () => {
  const ahead = destinationTimeline({ status: 'scheduled', scheduledAt: '2026-11-04T13:00:00Z' }, [], NOW);
  assert.deepEqual(states(ahead), ['Scheduled:current', 'Sending:todo', 'Processing:todo', 'Published:todo']);
  assert.deepEqual(ahead.clock, { mode: 'until', at: '2026-11-04T13:00:00Z' });
  assert.equal(destinationTimeline({ status: 'scheduled', scheduledAt: '2026-11-04T11:00:00Z' }, [], NOW).clock?.mode, 'since');
});

test('processing is timed from the first check of the latest run, not the newest one', () => {
  const t = destinationTimeline(
    { status: 'processing', scheduledAt: '2026-11-04T11:00:00Z' },
    [
      { status: 'processing', createdAt: '2026-11-04T11:01:30Z' },
      { status: 'processing', createdAt: '2026-11-04T11:01:00Z' },
      { status: 'processing', createdAt: '2026-11-04T11:02:00Z' },
    ],
    NOW,
  );
  assert.deepEqual(states(t), ['Scheduled:done', 'Sending:done', 'Processing:current', 'Published:todo']);
  assert.deepEqual(t.clock, { mode: 'since', at: '2026-11-04T11:01:00Z' });
});

test('a failure stops the step it happened in, and a publish completes every step', () => {
  const sendFailed = destinationTimeline(
    { status: 'failed', scheduledAt: '2026-11-04T11:00:00Z' },
    [{ status: 'failed', createdAt: '2026-11-04T11:00:20Z' }],
    NOW,
  );
  assert.deepEqual(states(sendFailed), ['Scheduled:done', 'Failed:stopped', 'Processing:todo', 'Published:todo']);
  const unconfirmed = destinationTimeline(
    { status: 'needs-reconciliation', scheduledAt: '2026-11-04T11:00:00Z' },
    [
      { status: 'processing', createdAt: '2026-11-04T11:01:00Z' },
      { status: 'needs-reconciliation', createdAt: '2026-11-04T11:05:00Z' },
    ],
    NOW,
  );
  assert.deepEqual(states(unconfirmed), ['Scheduled:done', 'Sending:done', 'Needs checking:stopped', 'Published:todo']);
  const published = destinationTimeline(
    { status: 'published', scheduledAt: '2026-11-04T11:00:00Z' },
    [{ status: 'published', createdAt: '2026-11-04T11:00:40Z' }],
    NOW,
  );
  assert.deepEqual(states(published), ['Scheduled:done', 'Sending:done', 'Processing:done', 'Published:done']);
  assert.equal(published.steps[3]!.at, '2026-11-04T11:00:40Z');
  assert.equal(published.clock, null);
});

test('durations read in the largest units that matter', () => {
  assert.equal(durationLabel(45_000), '45 s');
  assert.equal(durationLabel(3 * 60_000 + 59_000), '3 min');
  assert.equal(durationLabel(65 * 60_000), '1 h 5 min');
  assert.equal(durationLabel(2 * 3600_000), '2 h');
  assert.equal(durationLabel(52 * 3600_000), '2 d 4 h');
  assert.equal(durationLabel(-5_000), '0 s');
});

test('a post can be deleted unless it’s on its way out, and past a draft only by a publisher', () => {
  assert.equal(canDeletePost([{ status: 'published' }, { status: 'failed' }], true), true);
  assert.equal(canDeletePost([{ status: 'published' }, { status: 'processing' }], true), false);
  assert.equal(canDeletePost([{ status: 'uploading' }], true), false);
  assert.equal(canDeletePost([{ status: 'draft' }], false), true);
  assert.equal(canDeletePost([{ status: 'draft' }, { status: 'scheduled' }], false), false);
  assert.equal(canDeletePost([], false), true);
});
