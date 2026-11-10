import assert from 'node:assert/strict';
import test from 'node:test';

import { businessPrice, formatPounds, yearlySaving } from '../../lib/marketing/pricing.ts';
import { serializeJsonLd } from '../../lib/utils/json-ld.ts';
import { isPublicPath, needsSignIn } from '../../lib/utils/public-paths.ts';

test('the sign-in guard stays on for app screens while marketing sections are public', () => {
  for (const path of ['/dashboard', '/pos', '/kds', '/admin/overview', '/settings/modules', '/content', '/updates']) {
    assert.equal(isPublicPath(path), false, path);
  }
  for (const path of ['/', '/welcome', '/features/pos', '/compare/duma-vs-square', '/blog', '/blog/food-cost-formula', '/developers', '/developers/mcp', '/blog/feed.xml', '/llms.txt', '/llms-full.txt', '/api/cms-webhook', '/sitemap.xml', '/robots.txt', '/opengraph-image', '/privacy', '/dpa', '/gdpr', '/legal']) {
    assert.equal(isPublicPath(path), true, path);
  }
});

test('only app sections send a signed-out visitor to sign-in; an unknown URL gets a real 404', () => {
  for (const path of ['/dashboard', '/pos', '/settings/modules', '/admin/overview', '/api/notes', '/md/pricing']) assert.equal(needsSignIn(path), true, path);
  // A mistyped or retired URL, or a public page, is not a login redirect — crawlers read that as a soft 404.
  for (const path of ['/no-such-page', '/PRICING', '/pricing', '/', '/api/cms-webhook', '/api/auth/session', '/dashboards']) assert.equal(needsSignIn(path), false, path);
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

test('Business costs £49 a month, or £539 a year with one month free', () => {
  assert.deepEqual(businessPrice('monthly'), { total: 49, period: 'month' });
  assert.deepEqual(businessPrice('yearly'), { total: 539, period: 'year' });
  assert.equal(yearlySaving(), 49);
  assert.equal(formatPounds(539), '£539');
  assert.equal(formatPounds(44.9), '£44.90');
});
