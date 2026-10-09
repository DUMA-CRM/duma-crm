import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { buildStorefrontPrompt, storeBase } = await import('../lib/utils/storefront-docs.ts');

test('the brief names the real address and every call, and carries no key', () => {
  const prompt = buildStorefrontPrompt('https://api.duma.test/', 'Thread');
  assert.equal(storeBase('https://api.duma.test/'), 'https://api.duma.test/v1/store');
  assert.match(prompt, /DUMA_STORE_URL=https:\/\/api\.duma\.test\/v1\/store/);
  for (const call of [
    'GET /products',
    'GET /categories',
    'POST /orders',
    'POST /newsletter',
    'out_of_stock',
    'total_mismatch',
    'GET /locales',
    'price_unavailable',
    'POST /orders/quote',
    'promo_unavailable',
  ]) {
    assert.ok(prompt.includes(call), call);
  }
  assert.doesNotMatch(prompt, /dk_(pub|sec)_[A-Za-z0-9_-]{20,}/, 'no real-looking token');
});

// The documented storefront must exist in the API the UI was built against.
test('every storefront call the docs promise is in openapi.json', () => {
  const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  const has = (method: string, path: string) => Boolean(spec.paths[path]?.[method]);
  assert.ok(has('get', '/v1/store/products'));
  assert.ok(has('get', '/v1/store/products/{idOrSlug}'));
  assert.ok(has('get', '/v1/store/categories'));
  assert.ok(has('get', '/v1/store/locales'));
  assert.ok(has('post', '/v1/store/orders'));
  assert.ok(has('post', '/v1/store/orders/quote'));
  assert.ok(has('post', '/v1/store/newsletter'));
  assert.ok(has('post', '/v1/store/newsletter/unsubscribe'));
});
