import assert from 'node:assert/strict';
import test from 'node:test';

import type { Listing, StoreApp } from '../../lib/api/marketplace.service';
import { appState, primaryAction, storeTabs, updateAvailable } from '../../lib/utils/marketplace.ts';

const release = (id: string): Listing => ({
  id, version: '1.0.0', name: 'App', description: 'An app for tests.', supportUrl: 'https://x.test', privacyUrl: 'https://x.test',
  scopes: [], pageOrigin: 'https://x.test', webhookOrigin: null, events: [], extensions: [],
});

const app = (over: Partial<StoreApp> = {}): StoreApp => ({
  id: 'a', slug: 'app', publisher: 'Pub', suspended: false, latest: release('r2'), testRelease: null, installation: null, ...over,
});

const installed = (over: Partial<NonNullable<StoreApp['installation']>> = {}) => ({
  id: 'i', release: release('r2'), status: 'active' as const, revision: 1, test: false, canOpen: true, ...over,
});

test('an install on an older release offers the update to a manager, opening to everyone else', () => {
  const stale = app({ installation: installed({ release: release('r1') }) });
  assert.equal(updateAvailable(stale), true);
  assert.equal(primaryAction(stale, true), 'update');
  assert.equal(primaryAction(stale, false), 'open');
  assert.equal(appState(stale)?.label, 'Update available');
});

test('a test install is replaced by the published release, never reported as an update', () => {
  const testing = app({ installation: installed({ release: release('t1'), test: true, canOpen: false }) });
  assert.equal(updateAvailable(testing), false);
  assert.equal(primaryAction(testing, true), 'install');
  assert.equal(appState(testing)?.label, 'Testing');
});

test('a disabled live install is enabled, not reinstalled', () => {
  const disabled = app({ installation: installed({ status: 'disabled', canOpen: false }) });
  assert.equal(primaryAction(disabled, true), 'enable');
  assert.equal(primaryAction(disabled, false), null);
});

test('a suspended app offers nothing to install and leaves the Discover tab', () => {
  const suspended = app({ suspended: true, latest: null, installation: installed({ status: 'disabled', canOpen: false }) });
  assert.equal(primaryAction(suspended, true), null);
  assert.equal(appState(suspended)?.label, 'Suspended');
  const tabs = storeTabs([suspended, app({ id: 'b' })]);
  assert.deepEqual(tabs.discover.map((entry) => entry.id), ['b']);
  assert.deepEqual(tabs.installed.map((entry) => entry.id), ['a']);
});

test('a release only in review can be test-installed by a manager', () => {
  const review = app({ latest: null, testRelease: release('t1') });
  assert.equal(primaryAction(review, true), 'test');
  assert.equal(primaryAction(review, false), null);
  assert.equal(appState(review)?.label, 'In review');
});
