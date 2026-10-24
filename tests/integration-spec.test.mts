import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { integrationSpec } from '../lib/developers/integration-spec.ts';
import { PUBLIC_APIS } from '../lib/developers/api-reference.ts';

const source = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));

test('integration reference includes exactly the registered operations and workspace-key security', () => {
  const spec = integrationSpec(source, 'https://api.duma.test/');
  const expected = PUBLIC_APIS.flatMap(api => api.endpoints.map(endpoint => `${endpoint.method.toLowerCase()} ${api.basePath}${endpoint.path}`));
  const actual = Object.entries(spec.paths).flatMap(([path, item]) => Object.keys(item as object).filter(method => method !== 'parameters').map(method => `${method} ${path}`));
  assert.deepEqual(actual.sort(), expected.sort());
  assert.equal(spec.servers[0].url, 'https://api.duma.test');
  assert.equal(Object.keys(spec.components.securitySchemes as object).join(), 'WorkspaceKey');
  assert.ok(actual.some(value => value.startsWith('patch /v1/manage/')));
  assert.ok(actual.some(value => value.startsWith('delete /v1/manage/')));
  assert.equal(spec.paths['/v1/staff'], undefined);
  assert.doesNotMatch(spec.info.description, /sign-in\/email|staff shifts/);
});

test('unused internal components are omitted and all retained references resolve', () => {
  const poisoned = structuredClone(source);
  poisoned.components ??= {};
  poisoned.components.schemas ??= {};
  poisoned.components.schemas.InternalPayroll = {description: 'DO_NOT_EXPORT_INTERNAL_PAYROLL'};
  const spec = integrationSpec(poisoned, 'https://api.duma.test');
  assert.ok(!JSON.stringify(spec).includes('DO_NOT_EXPORT_INTERNAL_PAYROLL'));
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if ('$ref' in value) {
      const reference = String(value.$ref);
      let target: unknown = spec;
      for (const part of reference.slice(2).split('/')) target = (target as Record<string, unknown>)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
      assert.ok(target, reference);
    }
    Object.values(value).forEach(visit);
  };
  visit(spec);
});

test('a missing documented operation fails rather than silently publishing incomplete docs', () => {
  assert.throws(() => integrationSpec({paths: {}}, 'https://api.duma.test'), /Missing integration operation/);
});
