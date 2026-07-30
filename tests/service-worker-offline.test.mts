import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('offline caches are account scoped and purgeable', () => {
  assert.match(serviceWorker, /DUMA_SET_USER/);
  assert.match(serviceWorker, /DUMA_CLEAR_USER/);
  assert.match(serviceWorker, /scopeKey\(message\.userId\)/);
  assert.match(serviceWorker, /caches\.delete\(pageCacheName\(scope\)\)/);
  assert.match(serviceWorker, /caches\.delete\(apiCacheName\(scope\)\)/);
});

test('authentication and mutation requests are never cached', () => {
  assert.match(serviceWorker, /request\.method !== 'GET'/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/be\/v1\/auth\/'\)/);
});

test('CRM pages, RSC payloads, and API reads have offline fallbacks', () => {
  assert.match(serviceWorker, /request\.mode === 'navigate'/);
  assert.match(serviceWorker, /request\.headers\.get\('rsc'\) === '1'/);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/be\/'\)/);
  assert.match(serviceWorker, /networkFirst/);
});
