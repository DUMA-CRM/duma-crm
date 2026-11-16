import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fallbackFeatureEntry } from '../../lib/marketing/features.ts';

test('established feature URLs retain usable article content when CMS content is missing', () => {
  for (const slug of ['pos', 'products-catalog', 'staff-scheduling']) {
    const entry = fallbackFeatureEntry(slug);
    assert.ok(entry);
    assert.equal(entry.slug, slug);
    assert.ok(entry.fields.body.length > 1000);
    assert.ok(entry.fields.seo.metaTitle);
    assert.ok(entry.fields.faq.length > 0);
  }
  assert.equal(fallbackFeatureEntry('not-a-feature'), null);
  assert.equal(fallbackFeatureEntry('unpublished-feature'), null);
});
