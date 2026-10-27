import assert from 'node:assert/strict';
import test from 'node:test';

const ctx = await import('../lib/utils/workspace-context.ts');
const metrics = await import('../lib/utils/platform-metrics.ts');
const unsaved = await import('../lib/utils/unsaved-work.ts');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('every request names its context; an unresolved tab names none', () => {
  assert.deepEqual(ctx.scopeHeaders({ kind: 'platform' }), { 'X-Duma-Context': 'platform' });
  assert.deepEqual(ctx.scopeHeaders({ kind: 'workspace', tenantId: A, locationId: null }), { 'X-Duma-Workspace': A });
  assert.deepEqual(ctx.scopeHeaders({ kind: 'unresolved' }), {});
  assert.deepEqual(ctx.scopeHeaders({ kind: 'workspace', tenantId: 'not-an-id', locationId: null }), {});
});

test('cache partitions separate accounts and workspaces, not locations', () => {
  const inA = ctx.contextPartition('me', { kind: 'workspace', tenantId: A, locationId: null });
  assert.notEqual(inA, ctx.contextPartition('me', { kind: 'workspace', tenantId: B, locationId: null }));
  assert.notEqual(inA, ctx.contextPartition('you', { kind: 'workspace', tenantId: A, locationId: null }));
  assert.notEqual(inA, ctx.contextPartition('me', { kind: 'platform' }));
  assert.equal(inA, ctx.contextPartition('me', { kind: 'workspace', tenantId: A, locationId: 'somewhere' }));
});

test('a late answer for the previous workspace is never applied', () => {
  const inB = { kind: 'workspace', tenantId: B, locationId: null } as const;
  assert.equal(ctx.describesContext(inB, { mode: 'workspace', workspace: { id: A } }), false);
  assert.equal(ctx.describesContext(inB, { mode: 'workspace', workspace: { id: B } }), true);
  assert.equal(ctx.describesContext(inB, { mode: 'platform', workspace: null }), false);
  assert.equal(ctx.describesContext({ kind: 'platform' }, { mode: 'workspace', workspace: { id: A } }), false);
  assert.equal(ctx.describesContext({ kind: 'unresolved' }, { mode: 'platform', workspace: null }), false);
});

test('a platform administrator starts in DUMA Admin, never auto-dropped into a sole client', () => {
  const start = ctx.initialContext({
    accountId: 'admin',
    account: 'platform',
    homeTenantId: A,
    assignedLocationIds: null,
    remembered: null,
  });
  assert.deepEqual(start, { kind: 'platform' });
});

test('a refreshed tab keeps its own context — but only for the same account', () => {
  const remembered = { accountId: 'admin', context: { kind: 'workspace', tenantId: B, locationId: null } } as const;
  assert.deepEqual(
    ctx.initialContext({ accountId: 'admin', account: 'platform', homeTenantId: null, assignedLocationIds: null, remembered }),
    remembered.context,
  );
  assert.deepEqual(
    ctx.initialContext({ accountId: 'someone-else', account: 'platform', homeTenantId: null, assignedLocationIds: null, remembered }),
    { kind: 'platform' },
  );
});

test('a member is always in their own workspace, at a location they are assigned', () => {
  const elsewhere = { accountId: 'm', context: { kind: 'workspace', tenantId: B, locationId: 'b-site' } } as const;
  assert.deepEqual(
    ctx.initialContext({ accountId: 'm', account: 'member', homeTenantId: A, assignedLocationIds: ['a1', 'a2'], remembered: elsewhere }),
    {
      kind: 'workspace',
      tenantId: A,
      locationId: 'a1',
    },
  );
  const kept = { accountId: 'm', context: { kind: 'workspace', tenantId: A, locationId: 'a2' } } as const;
  assert.deepEqual(
    ctx.initialContext({ accountId: 'm', account: 'member', homeTenantId: A, assignedLocationIds: ['a1', 'a2'], remembered: kept }),
    {
      kind: 'workspace',
      tenantId: A,
      locationId: 'a2',
    },
  );
  // Tenant-wide members (no assigned list) keep any remembered location in their workspace.
  assert.deepEqual(ctx.initialContext({ accountId: 'm', account: 'member', homeTenantId: A, assignedLocationIds: [], remembered: kept }), {
    kind: 'workspace',
    tenantId: A,
    locationId: 'a2',
  });
});

test('members cannot select another workspace or DUMA Admin', () => {
  assert.equal(ctx.canSelect('member', A, { kind: 'workspace', tenantId: B, locationId: null }), false);
  assert.equal(ctx.canSelect('member', A, { kind: 'platform' }), false);
  assert.equal(ctx.canSelect('member', A, { kind: 'workspace', tenantId: A, locationId: null }), true);
  assert.equal(ctx.canSelect('platform', null, { kind: 'workspace', tenantId: B, locationId: null }), true);
  assert.equal(ctx.canSelect('platform', null, { kind: 'unresolved' }), false);
});

test('DUMA Admin wears the default colour; a workspace its own cached one', () => {
  const partition = ctx.contextPartition('me', { kind: 'workspace', tenantId: A, locationId: null });
  const cache = { [partition]: 'ocean' } as Record<string, 'forest' | 'ocean'>;
  const fallback = 'forest' as 'forest' | 'ocean';
  assert.equal(ctx.brandForContext(cache, partition, { kind: 'workspace', tenantId: A, locationId: null }, fallback), 'ocean');
  assert.equal(ctx.brandForContext(cache, 'me|platform', { kind: 'platform' }, fallback), 'forest');
  assert.equal(ctx.brandForContext(cache, 'me|w:other', { kind: 'workspace', tenantId: B, locationId: null }, fallback), 'forest');
});

test('support visits are labelled as such in analytics, with no names', () => {
  assert.deepEqual(ctx.analyticsContext('platform', { kind: 'workspace', tenantId: A, locationId: null }, 'customer'), {
    context_kind: 'workspace',
    workspace_id: A,
    workspace_classification: 'customer',
    actor_kind: 'platform_admin',
  });
  assert.equal(ctx.analyticsContext('member', { kind: 'workspace', tenantId: A, locationId: null }, 'customer').actor_kind, 'staff');
  assert.equal(ctx.analyticsContext('platform', { kind: 'platform' }, null).workspace_id, null);
});

test('figures say how big, how fresh and whether estimated — and unavailable is not zero', () => {
  assert.equal(metrics.formatBytes(0), '0 B');
  assert.equal(metrics.formatBytes(1536), '1.5 KB');
  assert.equal(metrics.formatBytes(25 * 1024 * 1024), '25 MB');
  assert.equal(metrics.formatCount(12345), '12,345');
  assert.equal(metrics.formatCount(12345, true), '≈ 12,345');
  const now = Date.parse('2026-10-26T12:00:00Z');
  assert.equal(metrics.freshness('2026-10-26T11:59:30Z', now), 'just now');
  assert.equal(metrics.freshness('2026-10-26T11:56:00Z', now), '4 min ago');
  assert.equal(metrics.freshness('2026-10-24T12:00:00Z', now), '2 days ago');
  assert.equal(metrics.freshness(null, now), 'never');
  assert.equal(metrics.metricText({ status: 'unavailable', reason: 'not connected', definition: 'x', collectedAt: '' }), null);
  assert.equal(
    metrics.metricText({ status: 'ok', value: 0, unit: 'accounts', definition: 'x', window: null, collectedAt: '', estimate: false }),
    '0',
  );
  assert.equal(
    metrics.metricText({ status: 'ok', value: 900, unit: 'rows', definition: 'x', window: null, collectedAt: '', estimate: true }),
    '≈ 900',
  );
  assert.equal(metrics.share(3, 0), null);
  assert.equal(metrics.share(1, 3), 33);
});

test('a switch can ask about unsaved editors', () => {
  assert.equal(unsaved.hasUnsavedWork(), false);
  unsaved.markUnsavedWork('editor-1', true);
  assert.equal(unsaved.hasUnsavedWork(), true);
  unsaved.markUnsavedWork('editor-1', false);
  assert.equal(unsaved.hasUnsavedWork(), false);
});

test('a figure’s note says unit, window, freshness and estimate — or why it is missing', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const ok = { status: 'ok', value: 5, unit: 'people', definition: 'x', window: 'last 30 days', collectedAt: '2026-10-26T11:56:00Z', estimate: false } as const;
  assert.equal(metrics.metricNote(ok, undefined, now), 'people · last 30 days · measured 4 min ago');
  assert.equal(metrics.metricNote({ ...ok, window: null, estimate: true }, 'whole database', now), 'whole database · measured 4 min ago · estimate');
  assert.equal(metrics.metricNote({ status: 'unavailable', reason: 'PostHog is not connected', definition: 'x', collectedAt: '' }, undefined, now), 'PostHog is not connected');
});

test('a workspace reads in words', () => {
  assert.equal(metrics.workspaceStatusLabel('winding_down'), 'Winding down');
  assert.equal(metrics.workspaceFacts({ activeLocations: 1, activeStaff: 1, enabledModules: 12 }), '1 location · 1 staff member · 12 modules');
  assert.equal(metrics.workspaceFacts({ activeLocations: 0, activeStaff: 1200, enabledModules: 1 }), '0 locations · 1,200 staff · 1 module');
});

test('module adoption reads as a share of active clients', () => {
  assert.equal(metrics.adoptionNote(4, 12), '4 of 12 active clients');
  assert.equal(metrics.adoptionNote(1, 1), '1 of 1 active client');
  assert.equal(metrics.adoptionNote(0, 0), 'No active clients yet');
});

test('system health reads in words: workers, cache and tables', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const worker = { enabled: true, stalled: false, starting: false, lastTickAt: '2026-10-26T11:56:00Z' };
  assert.deepEqual(metrics.workerStatus(worker, now), { label: 'Running', tone: 'success', note: 'Ran 4 min ago' });
  assert.equal(metrics.workerStatus({ ...worker, stalled: true }, now).tone, 'danger');
  assert.equal(metrics.workerStatus({ ...worker, enabled: false, stalled: true }, now).label, 'Off');
  assert.equal(metrics.workerStatus({ ...worker, starting: true, lastTickAt: null }, now).label, 'Starting');
  assert.deepEqual(metrics.cacheStatus('ok'), { label: 'Healthy', tone: 'success' });
  assert.deepEqual(metrics.cacheStatus('disabled'), { label: 'Off', tone: 'muted' });
  assert.equal(metrics.cacheStatus('error').label, 'Degraded');
  assert.equal(
    metrics.tableFacts({ estimatedRows: 12345, indexBytes: 1536, statisticsAt: '2026-10-26T09:00:00Z' }, now),
    '≈ 12,345 rows · 1.5 KB indexes · analysed 3 h ago',
  );
  assert.equal(metrics.tableFacts({ estimatedRows: 0, indexBytes: 0, statisticsAt: null }, now), '≈ 0 rows · 0 B indexes · never analysed');
});
