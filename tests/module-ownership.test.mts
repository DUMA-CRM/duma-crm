import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

import { FRONTEND_CAPABILITIES } from '../lib/auth/capabilities.ts';
import { CRM_MODULE_MANIFESTS, MODULE_IDS, isModuleSurfaceEnabled, moduleForPage } from '../lib/modules/manifest.ts';

function pageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? pageFiles(path) : entry.name === 'page.tsx' ? [path] : [];
  });
}

function routeFor(file: string): string {
  const segments = relative(join(process.cwd(), 'app'), file)
    .replace(/(^|\/)page\.tsx$/, '')
    .split('/')
    .filter((segment) => !/^\(.+\)$/.test(segment));
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

test('every CRM page, frontend capability and navigation item has exactly one module owner', () => {
  const routes = pageFiles(join(process.cwd(), 'app')).map(routeFor).sort();
  const ownedRoutes = CRM_MODULE_MANIFESTS.flatMap((manifest) => manifest.routes);
  const ownedCapabilities = CRM_MODULE_MANIFESTS.flatMap((manifest) => manifest.capabilities);

  assert.equal(new Set(MODULE_IDS).size, MODULE_IDS.length, 'module ids must be unique');
  assert.deepEqual([...ownedRoutes].sort(), routes);
  assert.deepEqual([...ownedCapabilities].sort(), [...FRONTEND_CAPABILITIES].sort());

  const navSource = readFileSync(join(process.cwd(), 'lib/constants/nav.ts'), 'utf8');
  const navItems = [...navSource.matchAll(/\{ module: '([^']+)', label: '[^']+', href: '([^']+)'/g)];
  assert.equal(navItems.length, 16, 'every primary navigation item must declare its module');
  for (const [, moduleId, href] of navItems) {
    assert.equal(moduleForPage(href!), moduleId, `${href} navigation owner must match its page owner`);
  }

  const known = new Set(MODULE_IDS);
  for (const manifest of CRM_MODULE_MANIFESTS) {
    for (const dependency of manifest.dependencies) assert.ok(known.has(dependency));
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    assert.ok(!visiting.has(id), `module dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const manifest = CRM_MODULE_MANIFESTS.find((candidate) => candidate.id === id);
    assert.ok(manifest, `missing module manifest ${id}`);
    for (const dependency of manifest.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of MODULE_IDS) visit(id);

  const withoutInventory = MODULE_IDS.filter((id) => id !== 'inventory');
  assert.equal(isModuleSurfaceEnabled({ capability: 'stock:read' }, withoutInventory), false);
  assert.equal(isModuleSurfaceEnabled({ capability: 'orders:read' }, withoutInventory), true);
  assert.equal(isModuleSurfaceEnabled({ module: 'inventory' }, withoutInventory), false);
});
