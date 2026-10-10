import assert from 'node:assert/strict';
import test from 'node:test';

const { driveSyncPollMs, driveSyncSummary } = await import('../lib/utils/note-drive-sync.ts');

const synced = { status: 'active' as const, url: 'https://docs/x', pushedAt: '2026-10-10T10:00:00Z', lastError: null, pending: false };

test('a working sync is a quiet line: making the Doc, waiting for typing to stop, or synced', () => {
  assert.deepEqual(driveSyncSummary({ ...synced, pushedAt: null, pending: true }), {
    tone: 'quiet',
    message: 'Making the Google Doc…',
    showPushedAt: false,
    fix: null,
    fixLabel: null,
  });
  assert.equal(driveSyncSummary({ ...synced, pending: true }).message, 'Google Docs · syncing after you stop typing');
  assert.equal(driveSyncSummary({ ...synced, pending: true, lastError: 'Google returned 503' }).message, 'Google Docs · will try again shortly');
  const done = driveSyncSummary(synced);
  assert.equal(done.message, 'Google Docs · synced');
  assert.equal(done.showPushedAt, true);
});

test('a stopped sync asks for a choice that matches why it stopped', () => {
  assert.equal(driveSyncSummary({ ...synced, status: 'conflict' }).fix, 'overwrite');
  assert.equal(driveSyncSummary({ ...synced, status: 'missing' }).fix, 'recreate');
  const failed = driveSyncSummary({ ...synced, status: 'error', lastError: 'Reconnect Google Drive.' });
  assert.equal(failed.tone, 'stopped');
  assert.equal(failed.fix, 'retry');
  assert.match(failed.message, /Reconnect Google Drive\.$/);
});

test('it checks back only while a push is on its way', () => {
  assert.equal(driveSyncPollMs(null), false);
  assert.equal(driveSyncPollMs(synced), false);
  assert.equal(driveSyncPollMs({ ...synced, pending: true }), 10_000);
  assert.equal(driveSyncPollMs({ ...synced, pushedAt: null }), 10_000);
  assert.equal(driveSyncPollMs({ ...synced, status: 'conflict', pending: true }), false);
});
