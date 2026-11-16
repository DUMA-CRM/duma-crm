import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isSelfCanonical } from '../../lib/utils/blog.ts';

test('published posts with their own CMS canonical remain eligible for the sitemap', () => {
  const page = 'https://duma-business.com/blog/menu-margins';
  assert.equal(isSelfCanonical(page), true);
  assert.equal(isSelfCanonical(page, page), true);
  assert.equal(isSelfCanonical(page, '/blog/menu-margins'), true);
  assert.equal(isSelfCanonical(page, 'https://example.com/blog/menu-margins'), false);
  assert.equal(isSelfCanonical(page, '/blog/another-post'), false);
  assert.equal(isSelfCanonical(page, 'https://['), false);
});
