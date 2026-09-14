import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(readFileSync(join(root, 'openapi.json'), 'utf8'));

function responseSchema(method: string, path: string, status = '200') {
  const schema = spec.paths?.[path]?.[method]?.responses?.[status]?.content?.['application/json']?.schema;
  assert.ok(schema, `${method.toUpperCase()} ${path} ${status} must publish an application/json response schema`);
  return schema;
}

function requires(schema: { required?: string[] }, fields: string[], label: string) {
  const required = new Set(schema.required ?? []);
  assert.deepEqual(fields.filter((field) => !required.has(field)), [], `${label} stopped guaranteeing fields used by the CRM`);
}

test('sign-in guarantees the user and session fields consumed by the auth store', () => {
  const schema = responseSchema('post', '/v1/auth/sign-in/email');
  requires(schema, ['user', 'session'], 'sign-in');
  requires(schema.properties.user, ['id', 'name', 'email', 'emailVerified', 'createdAt', 'updatedAt'], 'sign-in user');
  requires(schema.properties.session, ['id', 'userId', 'token', 'expiresAt'], 'sign-in session');
});

test('staff/me guarantees the identity, scope, and capability fields used for navigation', () => {
  const schema = responseSchema('get', '/v1/staff/me');
  requires(schema, ['userId', 'tenantId', 'role', 'scope', 'isActive', 'createdAt', 'capabilities'], 'staff/me');
  assert.equal(schema.properties.capabilities.type, 'array');
});

test('locations guarantees the fields used by workspace selectors', () => {
  const schema = responseSchema('get', '/v1/locations');
  assert.equal(schema.type, 'array');
  requires(schema.items, ['id', 'tenantId', 'name', 'address', 'timezone', 'isActive', 'createdAt', 'updatedAt'], 'location');
});
