import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { API_KEY_SCOPES, PUBLIC_APIS, SCOPES, apiBase, apisOf, canManageKey, grantableScopes, keyNeedsLocation, publicApi, scopesForKind } =
  await import('../lib/developers/api-reference.ts');

// The reference is rendered from the registry, so a row that names a path the
// API does not serve would be documentation for nothing.
test('every endpoint in the API reference is in openapi.json', () => {
  const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  for (const api of PUBLIC_APIS) {
    for (const endpoint of api.endpoints) {
      const path = `${api.basePath}${endpoint.path}`;
      assert.ok(spec.paths[path]?.[endpoint.method.toLowerCase()], `${endpoint.method} ${path}`);
    }
  }
});

test('every scope belongs to a registered API, and every endpoint scope is a real scope', () => {
  for (const scope of API_KEY_SCOPES)
    assert.ok(
      PUBLIC_APIS.some((api) => api.id === SCOPES[scope].api),
      scope,
    );
  for (const api of PUBLIC_APIS) {
    for (const endpoint of api.endpoints) {
      if (endpoint.scope) assert.equal(SCOPES[endpoint.scope].api, api.id, `${api.id} ${endpoint.path}`);
    }
  }
});

test('a publishable key is offered only what is safe in a browser', () => {
  const everything = ['settings:write', 'cms.keys:write'];
  assert.deepEqual(grantableScopes('publishable', everything), ['content:read', 'catalog:read']);
  assert.deepEqual(grantableScopes('publishable', [...everything, 'cms:write', 'cms.schema:write']), ['content:read', 'catalog:read']);
  assert.deepEqual(grantableScopes('secret', [...everything, 'cms:write', 'cms.schema:write']), [...API_KEY_SCOPES]);
  assert.deepEqual(scopesForKind('publishable', ['content:preview', 'content:read', 'orders:write']), ['content:read']);
});

test('each person is offered only the scopes they may grant', () => {
  assert.deepEqual(grantableScopes('secret', ['cms.keys:write']), ['content:read', 'content:preview']);
  // Writing needs the matching staff capability too — nobody grants more than they can do.
  assert.deepEqual(grantableScopes('secret', ['cms.keys:write', 'cms:write']), ['content:read', 'content:preview', 'content:write']);
  assert.deepEqual(grantableScopes('secret', ['cms:write', 'cms.schema:write']), []);
  assert.deepEqual(grantableScopes('publishable', ['settings:write']), ['catalog:read']);
  assert.deepEqual(grantableScopes('secret', ['cms:read']), []);
});

test('a key is managed only by someone who could have granted all of it', () => {
  assert.equal(canManageKey(['content:read'], ['cms.keys:write']), true);
  assert.equal(canManageKey(['content:read', 'orders:write'], ['cms.keys:write']), false);
  assert.equal(canManageKey(['content:read', 'orders:write'], ['cms.keys:write', 'settings:write']), true);
  assert.equal(canManageKey(['made:up'], ['cms.keys:write', 'settings:write']), false);
});

test('only a secret key that records orders needs a location', () => {
  assert.equal(keyNeedsLocation({ kind: 'secret', scopes: ['orders:write'], locationId: null }), true);
  assert.equal(keyNeedsLocation({ kind: 'secret', scopes: ['orders:write'], locationId: 'loc' }), false);
  assert.equal(keyNeedsLocation({ kind: 'secret', scopes: ['content:read', 'content:preview'], locationId: null }), false);
  assert.equal(keyNeedsLocation({ kind: 'publishable', scopes: ['catalog:read'], locationId: null }), false);
});

test('a key names the APIs it opens, and the base URL drops a trailing slash', () => {
  assert.deepEqual(
    apisOf(['catalog:read', 'content:read']).map((api) => api.id),
    ['content', 'store'],
  );
  assert.deepEqual(apisOf(['made:up']), []);
  assert.equal(apiBase('https://api.duma.test/', publicApi('store')), 'https://api.duma.test/v1/store');
});

const { MCP_PATH, MCP_TOOLS, mcpClientConfigs, mcpToolsFor, mcpUrl } = await import('../lib/developers/api-reference.ts');

test('the MCP endpoint the docs point at is in openapi.json', () => {
  const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };
  assert.ok(spec.paths[MCP_PATH]?.post);
});

test('MCP tools are named once, need real scopes, and write only behind opt-in scopes', () => {
  const names = MCP_TOOLS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  for (const tool of MCP_TOOLS) {
    if (tool.scope) assert.ok(tool.scope in SCOPES, tool.name);
    assert.doesNotMatch(tool.name, /delete|update|publish|subscribe|record|create_order/, tool.name);
    if (tool.writes) assert.ok(tool.scope && SCOPES[tool.scope].optIn && !SCOPES[tool.scope].publishable, tool.name);
    else assert.doesNotMatch(tool.name, /create/, tool.name);
  }
});

test('a key is offered only the MCP tools its scopes allow', () => {
  const names = (scopes: string[]) => mcpToolsFor(scopes).map((tool) => tool.name);
  assert.deepEqual(names([]), ['workspace_info']);
  assert.ok(names(['content:read']).includes('content_list_entries'));
  assert.ok(!names(['content:read']).some((name) => name.startsWith('store_')));
  assert.ok(!names(['catalog:read']).includes('store_quote_order'));
  assert.ok(names(['catalog:read', 'orders:write']).includes('store_quote_order'));
});

test('client set-ups point at the MCP URL and carry no key', () => {
  assert.equal(mcpUrl('https://api.duma.test/'), 'https://api.duma.test/v1/mcp');
  for (const config of mcpClientConfigs('https://api.duma.test')) {
    assert.ok(config.code.includes('https://api.duma.test/v1/mcp'), config.label);
    assert.doesNotMatch(config.code, /dk_(pub|sec)_[A-Za-z0-9_-]{20,}/, config.label);
  }
});
