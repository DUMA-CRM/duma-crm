import assert from 'node:assert/strict';
import test from 'node:test';

const { contentLocation, contentNavigation } = await import('../lib/utils/cms-navigation.ts');

test('legacy configuration links resolve under Configure', () => {
  for (const section of ['models', 'locales', 'settings']) {
    assert.deepEqual(contentLocation(section, null), { tab: 'configure', section });
    assert.deepEqual(contentNavigation({ tab: section, model: null }), { tab: 'configure', section, model: null });
  }
});

test('only Configure can show a configuration section', () => {
  assert.deepEqual(contentLocation('configure', 'models'), { tab: 'configure', section: 'models' });
  assert.deepEqual(contentLocation('entries', 'models'), { tab: 'entries', section: null });
  assert.deepEqual(contentLocation('configure', 'missing'), { tab: 'configure', section: null });
  assert.deepEqual(contentLocation(null, null), { tab: 'overview', section: null });
  assert.deepEqual(contentLocation('missing', 'models'), { tab: 'overview', section: null });
});

test('leaving Configure clears its section without removing entry and media navigation', () => {
  assert.deepEqual(contentNavigation({ tab: 'entries', type: 'blog' }), { tab: 'entries', type: 'blog', section: null });
  assert.deepEqual(contentNavigation({ entry: 'entry-id' }), { entry: 'entry-id' });
  assert.deepEqual(contentNavigation({ folder: 'photos' }), { folder: 'photos' });
});
