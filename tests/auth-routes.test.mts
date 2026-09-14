import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const proxySource = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8');

test('every signed-out account-recovery page is public', () => {
  for (const route of ['/sign-in', '/forgot-password', '/reset-password']) {
    assert.match(proxySource, new RegExp(`['"]${route}['"]`), `${route} must be reachable without a session`);
  }
});
