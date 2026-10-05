import assert from 'node:assert/strict';
import test from 'node:test';

const {
  ACTIONS,
  COMMON_ACTIONS,
  COMMON_RESOURCES,
  RESOURCES,
  actionFilterLabel,
  actionPhrase,
  actionResource,
  resourceMeta,
  resourcePickerOptions,
} = await import('../lib/audit/vocabulary.ts');
const { auditChangeSet, auditSubject, formatValue, shortId } = await import('../lib/audit/change.ts');

type AuditLogShape = Parameters<typeof auditSubject>[0];

/**
 * The audit page previously shipped a filter list written from intuition —
 * `order.create`, `tenant.delete`, resource types `payslip` and `expense_claim`.
 * The API writes plural, path-derived keys (`orders.create`, `tenants.delete`),
 * so nearly every option selected nothing and the page looked broken.
 *
 * These tests pin the shape of the real vocabulary. If the API's derivation
 * changes, the filters must be re-checked against
 * `duma-api/src/middleware/audit.ts` rather than guessed at again.
 */

const log = (overrides: Partial<AuditLogShape> = {}): AuditLogShape =>
  ({
    id: 'a1',
    userId: 'u1',
    action: 'orders.create',
    resourceType: 'orders',
    createdAt: '2026-08-14T09:00:00.000Z',
    ...overrides,
  }) as AuditLogShape;

// ── Vocabulary ────────────────────────────────────────────────────────────────

test('every offered filter option resolves to a known key, not a guess', () => {
  for (const action of COMMON_ACTIONS) {
    assert.ok(ACTIONS[action], `${action} is offered but not described`);
  }
  for (const resource of COMMON_RESOURCES) {
    assert.ok(RESOURCES[resource], `${resource} is offered but not described`);
  }
});

test('resource types use the API plural path segment, never a singular guess', () => {
  // The four the old page got wrong, plus the slashed HR form.
  assert.equal(resourceMeta('orders').plural, 'Orders');
  assert.equal(resourceMeta('tenants').plural, 'Workspaces');
  assert.equal(resourceMeta('locations').plural, 'Locations');
  assert.equal(resourceMeta('stock-items').plural, 'Stock items');
  assert.equal(resourceMeta('hr/leave-requests').plural, 'Leave requests');
  // Singular forms are not vocabulary; they only survive via the fallback.
  assert.equal(RESOURCES.order, undefined);
  assert.equal(RESOURCES.payslip, undefined);
});

test('an unknown resource type still reads as words rather than a column value', () => {
  assert.equal(resourceMeta('kitchen-displays').plural, 'Kitchen displays');
  assert.equal(resourceMeta('kitchen-displays').noun, 'kitchen display');
  assert.equal(resourceMeta('').noun, 'record');
});

test('filter labels are plural, matching the resource list beside them', () => {
  assert.equal(actionFilterLabel('orders.create'), 'Orders taken');
  assert.equal(actionFilterLabel('orders.cancel'), 'Orders cancelled');
  assert.equal(actionFilterLabel('hr.leave_approved'), 'Leave approved');
  assert.equal(actionFilterLabel('payroll.finalise'), 'Payroll runs finalised');
});

test('a phrase names the record when one was resolved and stays indefinite when not', () => {
  assert.equal(actionPhrase('orders.cancel', 'orders', null), 'cancelled an order');
  assert.equal(actionPhrase('orders.cancel', 'orders', 'PO-0912'), 'cancelled order PO-0912');
  assert.equal(actionPhrase('suppliers.update', 'suppliers', 'Bridge Roasters'), 'updated supplier Bridge Roasters');
  // `noun: null` actions already name their own object.
  assert.equal(actionPhrase('trading.settings_updated', 'trading-settings', null), 'updated trading settings');
});

test('an action the API adds later is still worded, not dumped raw', () => {
  assert.equal(actionPhrase('kitchen-displays.create', 'kitchen-displays', null), 'created a kitchen display');
  assert.equal(actionPhrase('receipts.reprint', 'receipts', null), 'reprint a receipt');
});

// ── Subject resolution ────────────────────────────────────────────────────────

test('a UUID is never dressed up as a record name', () => {
  const entry = log({ metadata: JSON.stringify({ name: '8f3e2a1b-4c9d-4e17-a3f2-77b19c0e5d84' }) });
  assert.equal(auditSubject(entry), null);
});

test('a readable label is found in metadata, the request body, or the response', () => {
  assert.equal(auditSubject(log({ metadata: JSON.stringify({ reference: 'PO-0912' }) })), 'PO-0912');
  assert.equal(auditSubject(log({ metadata: JSON.stringify({ body: { name: 'Bridge Roasters' } }) })), 'Bridge Roasters');
  assert.equal(auditSubject(log({ response: JSON.stringify({ data: { email: 'j.doe@mail.com' } }) })), 'j.doe@mail.com');
  assert.equal(auditSubject(log({ metadata: null, response: null })), null);
});

test('short IDs stay comparable without pretending to be names', () => {
  assert.equal(shortId('8f3e2a1b-4c9d-4e17-a3f2-77b19c0e5d84'), '8f3e…5d84');
  assert.equal(shortId('PO-0912'), 'PO-0912');
});

// ── What changed ──────────────────────────────────────────────────────────────

test('a recorded before/after pair renders as a real comparison', () => {
  const { changes } = auditChangeSet(log({ metadata: JSON.stringify({ previousStatus: 'pending', newStatus: 'cancelled' }) }));
  assert.deepEqual(changes, [{ label: 'Status', before: 'pending', after: 'cancelled' }]);
});

test('loss-log quantity pairs compare too', () => {
  const { changes } = auditChangeSet(log({ metadata: JSON.stringify({ previousQuantity: 42, newQuantity: 30 }) }));
  assert.deepEqual(changes, [{ label: 'Quantity', before: '42', after: '30' }]);
});

test('without a prior value the fields are shown as set, with no invented before', () => {
  const { changes } = auditChangeSet(log({ metadata: JSON.stringify({ body: { name: 'Flat White', price: 3.6 } }) }));
  assert.deepEqual(changes, [
    { label: 'Name', after: 'Flat White' },
    { label: 'Price', after: '£3.60' },
  ]);
  assert.ok(changes.every((change) => change.before === undefined));
});

test('handler context becomes facts, and query noise is dropped', () => {
  const { facts } = auditChangeSet(log({ metadata: JSON.stringify({ lineCount: 4, reason: 'soft_delete', query: { page: '2' } }) }));
  assert.deepEqual(facts, [
    { label: 'Line count', value: '4' },
    { label: 'Reason', value: 'soft delete' },
  ]);
});

test('an entry with no payload says so rather than rendering an empty panel', () => {
  const empty = auditChangeSet(log({ metadata: null, response: null }));
  assert.equal(empty.changes.length, 0);
  assert.equal(empty.facts.length, 0);
  assert.equal(empty.hasPayload, false);
});

test('values are formatted for a reader, not a debugger', () => {
  assert.equal(formatValue('totalAmount', '12.4'), '£12.40');
  assert.equal(formatValue('active', true), 'Yes');
  assert.equal(formatValue('items', [1, 2, 3]), '3 items');
  assert.equal(formatValue('status', 'awaiting_payment'), 'awaiting payment');
  assert.equal(formatValue('notes', null), '—');
});

// ── Pickers ───────────────────────────────────────────────────────────────────

test('the record picker offers the whole vocabulary with no duplicate labels', () => {
  const options = resourcePickerOptions();
  assert.ok(options.length > 30, 'the picker should not be a shortlist');
  const labels = options.map((option) => option.label);
  assert.equal(new Set(labels).size, labels.length, 'aliases must not surface twice');
  // Sorted, so a long list stays scannable.
  assert.deepEqual(
    labels,
    [...labels].sort((a, b) => a.localeCompare(b)),
  );
});

test('an action resolves to the record type it was written against', () => {
  // Prefix is itself a resource key.
  assert.equal(actionResource('orders.cancel'), 'orders');
  assert.equal(actionResource('stock-items.update'), 'stock-items');
  // Named events whose prefix is not a resource.
  assert.equal(actionResource('hr.leave_approved'), 'hr/leave-requests');
  assert.equal(actionResource('cashup.closed'), 'cash-ups');
  assert.equal(actionResource('stock.loss'), 'loss-log');
  assert.equal(actionResource('trading.settings_updated'), 'trading-settings');
  // Unmapped stays null so the picker shows it rather than hiding it on a guess.
  assert.equal(actionResource('mystery.thing'), null);
});

// ── Grouping ──────────────────────────────────────────────────────────────────
// Groups come from the API now (GET /audit-logs/groups); what stays in the UI
// is how they read.

const { dayHeading, groupPhrase, groupRecord, groupTimeSpan, groupVerbs, groupsByDay, mergeGroupPages, summariseVerbs } =
  await import('../lib/audit/groups.ts');

type GroupShape = Parameters<typeof groupPhrase>[0];

const group = (over: Partial<GroupShape> = {}): GroupShape =>
  ({
    key: 'k1',
    day: '2026-09-24',
    actor: { userId: 'u1', name: 'Sam Reed', email: null, role: 'barista' },
    resourceType: 'orders',
    resourceId: '8f3e2a1b-4c9d-4e17-a3f2-77b19c0e5d84',
    count: 1,
    firstAt: '2026-09-24T09:12:00.000Z',
    lastAt: '2026-09-24T09:12:00.000Z',
    actions: ['orders.cancel'],
    severity: 'destructive',
    failedCount: 0,
    refusedCount: 0,
    entryIds: ['e1'],
    latest: log({ id: 'e1', action: 'orders.cancel', resourceId: '8f3e2a1b-4c9d-4e17-a3f2-77b19c0e5d84' }),
    ...over,
  }) as GroupShape;

test('a single entry reads as itself', () => {
  assert.equal(groupPhrase(group()), 'cancelled an order');
});

test('several entries read as what they add up to, with their verbs', () => {
  const many = group({ count: 3, actions: ['orders.cancel', 'orders.status_update', 'orders.create'] });
  assert.equal(groupPhrase(many), 'made 3 changes to an order');
  assert.equal(groupVerbs(many), 'cancelled, moved and 1 more');

  const named = group({ count: 2, latest: log({ id: 'e1', resourceId: 'x', metadata: JSON.stringify({ reference: 'PO-0912' }) }) });
  assert.equal(groupPhrase(named), 'made 2 changes to order PO-0912');
});

test('a group names its record when the payload gave one up, else a short ID', () => {
  assert.deepEqual(groupRecord(group({ latest: log({ id: 'e1', metadata: JSON.stringify({ reference: 'PO-0912' }) }) })), {
    label: 'PO-0912',
    named: true,
  });
  assert.deepEqual(groupRecord(group()), { label: '8f3e…5d84', named: false });
  assert.equal(groupRecord(group({ resourceId: null, latest: log({ id: 'e1', resourceId: null }) })), null);
});

test('a span shows both ends, a moment shows one', () => {
  assert.match(groupTimeSpan(group()), /^\d\d:\d\d$/);
  assert.match(groupTimeSpan(group({ lastAt: '2026-09-24T11:40:00.000Z' })), /^\d\d:\d\d–\d\d:\d\d$/);
  // Earliest first, whichever way round the ends arrive.
  const span = groupTimeSpan(group({ firstAt: '2026-09-24T11:40:00.000Z', lastAt: '2026-09-24T09:12:00.000Z' }));
  assert.ok(span.split('–')[0] < span.split('–')[1]);
});

test('days read as people say them', () => {
  const now = new Date(2026, 8, 25, 10).getTime();
  assert.equal(dayHeading('2026-09-25', now), 'Today');
  assert.equal(dayHeading('2026-09-24', now), 'Yesterday');
  assert.equal(dayHeading('2026-09-21', now), 'Monday 21 September');
  assert.equal(dayHeading('2025-09-22', now), 'Monday 22 September 2025');
});

test('load-more pages merge without repeating a group the live log pushed down', () => {
  const merged = mergeGroupPages([
    { data: [group({ key: 'a' }), group({ key: 'b' })] },
    { data: [group({ key: 'b' }), group({ key: 'c' })] },
  ]);
  assert.deepEqual(
    merged.map((item) => item.key),
    ['a', 'b', 'c'],
  );
});

test('groups sit under their day, in the order the API sent them', () => {
  const days = groupsByDay([group({ key: 'a' }), group({ key: 'b' }), group({ key: 'c', day: '2026-09-23' })]);
  assert.deepEqual(
    days.map((day) => [day.day, day.groups.map((item) => item.key)]),
    [
      ['2026-09-24', ['a', 'b']],
      ['2026-09-23', ['c']],
    ],
  );
});

test('summaries stay short however many entries a record collects', () => {
  assert.equal(summariseVerbs(['cancelled']), 'cancelled');
  assert.equal(summariseVerbs(['cancelled', 'moved']), 'cancelled and moved');
  assert.equal(summariseVerbs(['cancelled', 'moved', 'took', 'refunded']), 'cancelled, moved and 2 more');
});

// ── Status ────────────────────────────────────────────────────────────────────

const { auditStatus, severityLabel } = await import('../lib/audit/narrative.ts');

/**
 * The Status column used to render a label only for entries that failed, and an
 * em dash for everything else — so it reported problems and left the reader to
 * infer that a dash meant success. Every severity now states itself.
 */
test('every severity states its own status', () => {
  assert.deepEqual(auditStatus('ok'), { label: 'Success', tone: 'success' });
  assert.deepEqual(auditStatus('destructive'), { label: 'Destructive', tone: 'warning' });
  assert.deepEqual(auditStatus('failed', 500), { label: 'Failed', tone: 'exception' });
});

test('a refusal is named by what the code meant, and always reads as an exception', () => {
  assert.deepEqual(auditStatus('refused', 403), { label: 'Denied', tone: 'exception' });
  assert.equal(auditStatus('refused', 404).label, 'Not found');
  assert.equal(auditStatus('refused', 409).label, 'Conflicted');
  assert.equal(auditStatus('refused', 422).label, 'Rejected');
});

test('destructive work is amber, never red', () => {
  // Red in a status column has to mean "this did not happen". A completed
  // deletion painted like a rejected one hides the difference that matters.
  assert.notEqual(auditStatus('destructive').tone, auditStatus('failed', 500).tone);
  assert.equal(auditStatus('destructive').tone, 'warning');
});

test('severityLabel still reports problems only, for callers that treat silence as success', () => {
  // The agent renders `severityLabel(...) ?? 'Succeeded'`; giving ok a label
  // here would make it say "Success" twice over.
  assert.equal(severityLabel('ok'), null);
  assert.equal(severityLabel('destructive'), null);
  assert.equal(severityLabel('failed', 500), 'Failed');
});

// ── Fallback grouping ─────────────────────────────────────────────────────────

const { dayIn, entryMatches, groupEntriesLocally } = await import('../lib/audit/groups.ts');

test('without the groups endpoint, a page is grouped the way the server groups', () => {
  const at = (iso: string, over: Partial<AuditLogShape> = {}) =>
    log({ createdAt: iso, userId: 'u1', userName: 'Sam', resourceId: 'o1', ...over });
  const groups = groupEntriesLocally(
    [
      at('2026-09-24T09:00:00.000Z', { id: 'a', action: 'orders.create' }),
      at('2026-09-24T09:05:00.000Z', { id: 'b', action: 'orders.update', statusCode: 500 }),
      at('2026-09-24T23:30:00.000Z', { id: 'c', action: 'orders.update' }), // 00:30 on the 25th in London
      at('2026-09-24T09:10:00.000Z', { id: 'd', resourceId: null }),
    ],
    'Europe/London',
    (entry) => (entry.statusCode && entry.statusCode >= 500 ? 'failed' : 'ok'),
  );
  assert.deepEqual(
    groups.map((group) => [group.day, group.count, group.severity, group.entryIds]),
    [
      ['2026-09-25', 1, 'ok', ['c']],
      ['2026-09-24', 1, 'ok', ['d']],
      ['2026-09-24', 2, 'failed', ['b', 'a']],
    ],
  );
  assert.equal(dayIn('2026-09-24T23:30:00.000Z', 'UTC'), '2026-09-24');
});

test('the fallback search matches the entry’s own words', () => {
  assert.equal(entryMatches(log({ metadata: JSON.stringify({ name: 'Whole milk' }) }), 'milk'), true);
  assert.equal(entryMatches(log({ userName: 'Sam Reed' }), 'ana'), false);
});
