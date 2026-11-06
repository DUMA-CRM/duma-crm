import assert from 'node:assert/strict';
import test from 'node:test';

import { destinationGaps } from '../../lib/utils/marketing-compose.ts';

const base = { format: 'image', local: '2026-11-06T09:00', choice: '', timeZone: 'Europe/London', mediaCount: 1, options: {} };

test('a complete Instagram destination has nothing left to do', () => {
  assert.deepEqual(destinationGaps(base, 'instagram', true), []);
});

test('a destination lists every gap: account, time, media and the platform’s own questions', () => {
  assert.deepEqual(destinationGaps({ ...base, local: '', mediaCount: 0 }, 'youtube', false), [
    'Reconnect the account',
    'Choose a publish time',
    'Add media',
    'Choose who can see it',
    'Say whether it’s made for kids',
  ]);
  assert.deepEqual(destinationGaps({ ...base, options: { privacy: 'PUBLIC_TO_EVERYONE' } }, 'tiktok', true), ['Give TikTok’s consent']);
  // A text post needs no media.
  assert.deepEqual(destinationGaps({ ...base, format: 'text', mediaCount: 0 }, 'facebook', true), []);
});

test('a TikTok drafts post asks only for consent — who sees it is chosen in TikTok', () => {
  assert.deepEqual(destinationGaps({ ...base, options: { tiktokMode: 'inbox', consent: true } }, 'tiktok', true), []);
  assert.deepEqual(destinationGaps({ ...base, options: { tiktokMode: 'inbox' } }, 'tiktok', true), ['Give TikTok’s consent']);
  assert.deepEqual(destinationGaps({ ...base, options: { tiktokMode: 'direct', consent: true } }, 'tiktok', true), [
    'Choose who can see it',
  ]);
});

test('a time skipped by the clocks going forward, or one that happens twice, is a gap until resolved', () => {
  // 30 March 2025, 01:30 does not exist in London; 26 October 2025, 01:30 happens twice.
  assert.deepEqual(destinationGaps({ ...base, local: '2025-03-30T01:30' }, 'instagram', true), ['Pick a time that exists']);
  const fold = { ...base, local: '2025-10-26T01:30' };
  assert.deepEqual(destinationGaps(fold, 'instagram', true), ['Choose which of the repeated times']);
  assert.deepEqual(destinationGaps({ ...fold, choice: '2025-10-26T01:30:00.000Z' }, 'instagram', true), []);
});
