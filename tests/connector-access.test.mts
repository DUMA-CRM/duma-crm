import assert from 'node:assert/strict';
import test from 'node:test';

import { canAccessConnector } from '../lib/auth/connector-access.ts';

for (const [moduleId, readCapability, capability] of [
  ['communications', 'email.connections:read', 'email.connections:write'],
  ['payments', 'payments.connections:read', 'payments.connections:write'],
] as const) {
  test(`${moduleId} connections wait for enabled modules and both permissions`, () => {
    const definition = { moduleId, readCapability, capability };
    const granted = [readCapability, capability];
    const enabled = [{ moduleId, status: 'enabled' }];
    assert.equal(canAccessConnector(granted, definition, undefined), false);
    assert.equal(canAccessConnector(granted, definition, []), false);
    assert.equal(canAccessConnector(granted, definition, [{ moduleId, status: 'disabled' }]), false);
    assert.equal(canAccessConnector([capability], definition, enabled), false);
    assert.equal(canAccessConnector([readCapability], definition, enabled), false);
    assert.equal(canAccessConnector([], definition, enabled), false);
    assert.equal(canAccessConnector(granted, definition, enabled), true);
  });
}
