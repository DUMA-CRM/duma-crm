import assert from 'node:assert/strict';
import test from 'node:test';

import type { TenantModuleState } from '../../lib/api/modules.service';
import { type ModuleId, modulesForPage } from '../../lib/modules/manifest.ts';
import { type NavEntry, filterNavByCapability, filterNavGroups, isNavPathActive } from '../../lib/utils/nav-access.ts';

// The merged entries as lib/constants/nav.ts declares them (that file carries
// icon components, so the rules are exercised on the same shapes here).
const compliance: NavEntry = {
  module: 'compliance',
  label: 'Compliance',
  href: '/compliance',
  icon: null,
  capabilities: ['privacy:read'],
  alsoFor: [{ module: 'audit', capabilities: ['audit:read'], href: '/compliance?tab=audit-log' }],
};
const myWork: NavEntry = {
  module: 'workforce',
  label: 'My work',
  href: '/my-work',
  icon: null,
  alsoFor: [{ module: 'people', href: '/my-work?tab=overview' }],
};
const menu: NavEntry = {
  module: 'catalog',
  label: 'Menu',
  href: '/menu',
  icon: 'menu',
  capabilities: ['menu:write'],
  retail: { label: 'Products', icon: 'tag' },
};

const modules = (on: ModuleId[], configuration: Partial<Record<ModuleId, Record<string, unknown>>> = {}): TenantModuleState[] =>
  on.map((moduleId) => ({ moduleId, status: 'enabled', configurationVersion: 1, configuration: configuration[moduleId] ?? {} }));

const hrefs = (items: NavEntry[]) => items.map((item) => item.href);

test('a merged entry shows for either of its parts and opens the part the person can see', () => {
  const both = modules(['compliance', 'audit']);
  assert.deepEqual(hrefs(filterNavByCapability([compliance], ['privacy:read'], both)), ['/compliance']);
  // An auditor holds only audit:read — the entry still shows, on the audit log tab.
  assert.deepEqual(hrefs(filterNavByCapability([compliance], ['audit:read'], both)), ['/compliance?tab=audit-log']);
  assert.deepEqual(hrefs(filterNavByCapability([compliance], ['privacy:read', 'audit:read'], both)), ['/compliance']);
  assert.deepEqual(filterNavByCapability([compliance], ['customers:read'], both), []);
});

test('an alternative needs its own module on, not just the capability', () => {
  assert.deepEqual(filterNavByCapability([compliance], ['audit:read'], modules(['compliance'])), []);
  assert.deepEqual(hrefs(filterNavByCapability([compliance], ['audit:read'], modules(['audit']))), ['/compliance?tab=audit-log']);
  assert.deepEqual(filterNavByCapability([compliance], ['privacy:read'], modules(['audit'])), []);
});

test('My work shows when either the rota or the HR module is on', () => {
  assert.deepEqual(hrefs(filterNavByCapability([myWork], [], modules(['workforce', 'people']))), ['/my-work']);
  assert.deepEqual(hrefs(filterNavByCapability([myWork], [], modules(['workforce']))), ['/my-work']);
  assert.deepEqual(hrefs(filterNavByCapability([myWork], [], modules(['people']))), ['/my-work?tab=overview']);
  assert.deepEqual(filterNavByCapability([myWork], [], modules(['customers'])), []);
});

test('a heading disappears when every item under it is hidden', () => {
  const dashboard: NavEntry = { module: 'organization', label: 'Dashboard', href: '/dashboard', icon: null };
  const groups: { heading?: string; items: NavEntry[] }[] = [
    { items: [dashboard] },
    { heading: 'Workspace', items: [compliance] },
    { heading: 'Team', items: [myWork] },
  ];
  const visible = filterNavGroups(groups, ['audit:read'], modules(['organization', 'people']));
  assert.deepEqual(
    visible.map((group) => group.heading),
    [undefined, 'Team'],
  );
});

test('a retail catalogue reads Products, with its own icon', () => {
  const [item] = filterNavByCapability([menu], ['menu:write'], modules(['catalog'], { catalog: { vocabulary: 'retail' } }));
  assert.equal(item.label, 'Products');
  assert.equal(item.icon, 'tag');
});

test('a switched-off surface hides its entry', () => {
  const kds: NavEntry = { module: 'kds', label: 'Kitchen', href: '/kds', icon: null, surface: 'screen' };
  assert.deepEqual(filterNavByCapability([kds], [], modules(['kds'], { kds: { surfaces: { screen: false } } })), []);
  assert.equal(filterNavByCapability([kds], [], modules(['kds'])).length, 1);
});

test('the active item ignores the query and matches pages under it', () => {
  assert.equal(isNavPathActive('/compliance', '/compliance?tab=audit-log'), true);
  assert.equal(isNavPathActive('/my-work', '/my-work?tab=overview'), true);
  assert.equal(isNavPathActive('/promotions/loyalty', '/promotions'), true);
  assert.equal(isNavPathActive('/promotions-archive', '/promotions'), false);
  assert.equal(isNavPathActive('/promotions/loyalty', '/customers'), false);
});

test('a merged page belongs to every module it is made of', () => {
  assert.deepEqual(modulesForPage('/my-work'), ['workforce', 'people']);
  assert.deepEqual(modulesForPage('/promotions/loyalty'), ['customers']);
  assert.deepEqual(modulesForPage('/compliance'), ['compliance', 'audit']);
  assert.deepEqual(modulesForPage('/communications'), ['communications', 'automation']);
});
