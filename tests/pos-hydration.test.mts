import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'app/(crm)/pos/page.tsx'), 'utf8');

test('POS waits for client state before rendering persisted workspace and offline data', () => {
  assert.match(source, /useSyncExternalStore\([\s\S]*?\(\) => true,[\s\S]*?\(\) => false/);
  assert.match(source, /if \(!clientReady\)[\s\S]*?Preparing the till/);

  const readyGuard = source.indexOf('if (!clientReady)');
  const persistedQueue = source.indexOf('recentSyncs.length > 0');
  assert.ok(readyGuard > -1 && persistedQueue > readyGuard, 'persisted POS history must render only after the hydration guard');
});
