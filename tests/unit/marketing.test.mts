import assert from 'node:assert/strict';
import test from 'node:test';

import { businessPrice, formatPounds, yearlySaving } from '../../lib/marketing/pricing.ts';
import { serializeJsonLd } from '../../lib/utils/json-ld.ts';
import { isPublicPath } from '../../lib/utils/public-paths.ts';

test('the sign-in guard stays on for app screens while marketing sections are public', () => {
  for (const path of ['/dashboard', '/pos', '/kds', '/admin/overview', '/settings/modules', '/content', '/updates']) {
    assert.equal(isPublicPath(path), false, path);
  }
  for (const path of ['/', '/welcome', '/features/pos', '/compare/duma-vs-square', '/blog', '/blog/food-cost-formula', '/developers', '/developers/mcp', '/blog/feed.xml', '/llms.txt', '/llms-full.txt', '/api/cms-webhook', '/sitemap.xml', '/robots.txt', '/opengraph-image', '/privacy']) {
    assert.equal(isPublicPath(path), true, path);
  }
});

test('a public prefix does not open a sibling path that merely shares its letters', () => {
  for (const path of ['/blogger', '/features-admin', '/welcomed', '/fx', '/bento']) {
    assert.equal(isPublicPath(path), false, path);
  }
});

test('JSON-LD cannot close its script tag, and still parses to the original value', () => {
  const data = { headline: 'Margins </script><script>alert(1)</script> & more' };
  const serialized = serializeJsonLd(data);
  assert.equal(serialized.includes('<'), false);
  assert.equal(serialized.includes('>'), false);
  assert.deepEqual(JSON.parse(serialized), data);
});

test('Business costs £89 a month or £80 a month paid yearly, and founding members keep 10% off', () => {
  assert.deepEqual(businessPrice('monthly'), { total: 89, perMonth: 89 });
  assert.deepEqual(businessPrice('yearly'), { total: 960, perMonth: 80 });
  assert.deepEqual(businessPrice('monthly', { founding: true }), { total: 80.1, perMonth: 80.1 });
  assert.deepEqual(businessPrice('yearly', { founding: true }), { total: 864, perMonth: 72 });
  assert.equal(yearlySaving(), 108);
  assert.equal(formatPounds(960), '£960');
  assert.equal(formatPounds(80.1), '£80.10');
});
