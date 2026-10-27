import assert from 'node:assert/strict';
import test from 'node:test';

const updates = await import('../lib/utils/product-updates.ts');

const content = {
  title: 'Menus',
  summary: 'Faster',
  body: 'Details',
  category: 'new' as const,
  targetRoles: [] as string[],
  targetModules: [] as string[],
  actionLabel: '',
  actionUrl: '',
};
const now = Date.parse('2026-10-26T12:00:00Z');

test('an update’s status follows publication, schedule and later edits', () => {
  assert.deepEqual(updates.updateStatus({ publishedAt: null, draft: { ...content }, published: null }, now), { label: 'Draft', tone: 'muted' });
  assert.equal(updates.updateStatus({ publishedAt: '2026-10-27T09:00:00Z', draft: { ...content }, published: { ...content } }, now).label, 'Scheduled');
  assert.equal(updates.updateStatus({ publishedAt: '2026-10-20T09:00:00Z', draft: { ...content }, published: { ...content } }, now).label, 'Published');
  assert.equal(
    updates.updateStatus({ publishedAt: '2026-10-20T09:00:00Z', draft: { ...content, title: 'Menus 2' }, published: { ...content } }, now).label,
    'Unpublished changes',
  );
});

test('a draft saves only with title, summary and body, and a button that is whole or absent', () => {
  assert.deepEqual(updates.updateDraftCheck({ ...content }), { missing: [], buttonIncomplete: false, valid: true });
  assert.deepEqual(updates.updateDraftCheck({ ...content, title: ' ', body: '' }).missing, ['Title', 'What changed']);
  assert.equal(updates.updateDraftCheck({ ...content, actionLabel: 'Open menu' }).buttonIncomplete, true);
  assert.equal(updates.updateDraftCheck({ ...content, actionLabel: 'Open menu', actionUrl: '/menu' }).valid, true);
});

test('an audience filter reads in words', () => {
  assert.equal(updates.audienceLabel([]), 'Everyone');
  assert.equal(updates.audienceLabel([], 'Any module'), 'Any module');
  assert.equal(updates.audienceLabel(['store_manager', 'qr-ordering']), 'Store manager, Qr ordering');
  assert.equal(updates.audienceLabel(['a', 'b', 'c']), '3 selected');
});
