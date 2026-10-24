import assert from 'node:assert/strict';
import test from 'node:test';

const { envTemplate, keySummary, keyUsage, webhookHealth } = await import('../lib/utils/developers.ts');
const { PUBLIC_APIS } = await import('../lib/developers/api-reference.ts');

test('a key row names its kind, then the APIs its scopes open', () => {
  assert.equal(keySummary({ kind: 'publishable', scopes: ['content:read', 'catalog:read'] }), 'Publishable · Content, Store');
  assert.equal(keySummary({ kind: 'secret', scopes: ['orders:write'] }), 'Secret · Store');
  assert.equal(keySummary({ kind: 'secret', scopes: [] }), 'Secret');
});

test('usage says when a key was last used, or that it never was', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  assert.equal(keyUsage(null, now), 'Never used');
  assert.equal(keyUsage('2026-10-24T09:00:00Z', now), 'Used 3h ago');
});

test('a webhook reads as paused, quiet, failing, retrying or delivering', () => {
  const at = '2026-10-24T09:00:00Z';
  assert.deepEqual(webhookHealth(false, { status: 'failed', at }), { label: 'Paused', muted: true });
  assert.deepEqual(webhookHealth(true, null), { label: 'Nothing sent yet', muted: true });
  assert.equal(webhookHealth(true, { status: 'failed', at }).tone, 'danger');
  assert.equal(webhookHealth(true, { status: 'pending', at }).tone, 'warning');
  assert.deepEqual(webhookHealth(true, { status: 'succeeded', at }), { label: 'Delivering', muted: false });
});

test('the .env template carries every base URL and no key', () => {
  const env = envTemplate('https://api.duma.test/', PUBLIC_APIS);
  for (const api of PUBLIC_APIS) assert.ok(env.includes(`https://api.duma.test${api.basePath}`), api.id);
  assert.match(env, /^DUMA_PUBLISHABLE_KEY= /m);
  assert.doesNotMatch(env, /dk_(pub|sec)_[A-Za-z0-9]{8,}/);
});
