import assert from 'node:assert/strict';
import test from 'node:test';

const { parseStoredDraft, recoveryFor, DRAFT_MAX_AGE_MS } = await import('../lib/utils/cms-draft.ts');

const same = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b);
const now = Date.parse('2026-10-06T12:00:00Z');

test('only well-formed stored drafts are read back', () => {
  assert.equal(parseStoredDraft(null), null);
  assert.equal(parseStoredDraft('not json'), null);
  assert.equal(parseStoredDraft('{"data":[],"baseVersion":1,"savedAt":"x"}'), null);
  assert.ok(parseStoredDraft('{"data":{"title":"Hi"},"baseVersion":2,"savedAt":"2026-10-06T11:00:00Z"}'));
});

test('a draft is offered when it differs, flagged when the entry moved on, dropped when stale or identical', () => {
  const draft = { data: { title: 'Mine' }, baseVersion: 3, savedAt: '2026-10-06T11:00:00Z' };
  assert.deepEqual(recoveryFor(draft, { version: 3, draftData: { title: 'Saved' } }, same, now), { kind: 'offer', draft, outdated: false });
  assert.equal((recoveryFor(draft, { version: 4, draftData: { title: 'Theirs' } }, same, now) as { outdated: boolean }).outdated, true);
  assert.deepEqual(recoveryFor(draft, { version: 3, draftData: { title: 'Mine' } }, same, now), { kind: 'none' });
  assert.deepEqual(recoveryFor(draft, { version: 3, draftData: {} }, same, Date.parse(draft.savedAt) + DRAFT_MAX_AGE_MS + 1), {
    kind: 'none',
  });
});
