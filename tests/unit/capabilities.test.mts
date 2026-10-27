import assert from 'node:assert/strict';
import test from 'node:test';

import { hasAllCapabilities, hasAnyCapability, hasCapability } from '../../lib/auth/capabilities.ts';

test('capability decisions deny missing grants and require the specific permission', () => {
  for (const source of [undefined, null, {}, [], { capabilities: ['orders:read'] }]) {
    assert.equal(hasCapability(source, 'orders:refund'), false);
  }
  assert.equal(hasCapability({ capabilities: ['orders:refund'] }, 'orders:refund'), true);
});

test('alternative permissions and combined requirements use the actual granted capabilities', () => {
  const grants = ['orders:read', 'orders:create'];
  assert.equal(hasAnyCapability(grants, 'orders:refund', 'orders:create'), true);
  assert.equal(hasAnyCapability(grants, 'orders:refund', 'orders:bulk'), false);
  assert.equal(hasAllCapabilities(grants, 'orders:read', 'orders:create'), true);
  assert.equal(hasAllCapabilities(grants, 'orders:read', 'orders:refund'), false);
});
