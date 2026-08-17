import assert from 'node:assert/strict';
import test from 'node:test';

const { ACTIONS, COMMON_ACTIONS, COMMON_RESOURCES, RESOURCES, actionFilterLabel, actionPhrase, actionResource, resourceMeta, resourcePickerOptions } =
  await import('../lib/audit/vocabulary.ts');
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
  const { facts } = auditChangeSet(
    log({ metadata: JSON.stringify({ lineCount: 4, reason: 'soft_delete', query: { page: '2' } }) }),
  );
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
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b)));
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

const { groupAuditLogs, summariseActors, summariseVerbs } = await import('../lib/audit/groups.ts');

const severityOf = (entry: AuditLogShape) =>
  entry.statusCode != null && entry.statusCode >= 500
    ? ('failed' as const)
    : entry.statusCode != null && entry.statusCode >= 400
      ? ('refused' as const)
      : /cancel|delete/.test(entry.action)
        ? ('destructive' as const)
        : ('ok' as const);

const entry = (id: string, over: Partial<AuditLogShape> = {}) =>
  log({ id, resourceId: 'ord-1', userName: 'Sam Reed', ...over });

test('many entries on one record collapse into a single row', () => {
  const groups = groupAuditLogs(
    [
      entry('e1', { action: 'orders.cancel' }),
      entry('e2', { action: 'orders.status_update', userName: 'Ana Ruiz' }),
      entry('e3', { action: 'orders.create' }),
    ],
    severityOf,
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].entries.length, 3);
  assert.equal(groups[0].latest.id, 'e1', 'the newest entry heads the group');
  assert.deepEqual(groups[0].actors, ['Sam Reed', 'Ana Ruiz']);
  assert.deepEqual(groups[0].verbs, ['cancelled', 'moved', 'took']);
});

test('a failure inside a group cannot hide behind a healthy latest entry', () => {
  const groups = groupAuditLogs(
    [entry('e1', { statusCode: 200 }), entry('e2', { statusCode: 500 })],
    severityOf,
  );
  assert.equal(groups[0].severity, 'failed');
});

test('different records never merge, and entries without an ID stay separate', () => {
  const groups = groupAuditLogs(
    [entry('e1'), entry('e2', { resourceId: 'ord-2' }), entry('e3', { resourceId: null }), entry('e4', { resourceId: null })],
    severityOf,
  );
  assert.equal(groups.length, 4);
});

test('the same ID under a different record type is a different record', () => {
  const groups = groupAuditLogs([entry('e1'), entry('e2', { resourceType: 'customers' })], severityOf);
  assert.equal(groups.length, 2);
});

test('grouping off gives one row per entry, order untouched', () => {
  const input = [entry('e1'), entry('e2'), entry('e3')];
  const groups = groupAuditLogs(input, severityOf, false);
  assert.deepEqual(
    groups.map((group) => group.latest.id),
    ['e1', 'e2', 'e3'],
  );
  assert.ok(groups.every((group) => group.entries.length === 1));
});

test('a group names its record when the payload gave one up', () => {
  const named = groupAuditLogs([entry('e1', { metadata: JSON.stringify({ reference: 'PO-0912' }) })], severityOf)[0];
  assert.equal(named.record, 'PO-0912');
  assert.equal(named.named, true);

  const unnamed = groupAuditLogs([entry('e1', { resourceId: '8f3e2a1b-4c9d-4e17-a3f2-77b19c0e5d84' })], severityOf)[0];
  assert.equal(unnamed.record, '8f3e…5d84');
  assert.equal(unnamed.named, false);
});

test('summaries stay short however many entries a record collects', () => {
  assert.equal(summariseVerbs(['cancelled']), 'cancelled');
  assert.equal(summariseVerbs(['cancelled', 'moved']), 'cancelled and moved');
  assert.equal(summariseVerbs(['cancelled', 'moved', 'took', 'refunded']), 'cancelled, moved and 2 more');
  assert.equal(summariseActors(['Sam Reed']), 'Sam Reed');
  assert.equal(summariseActors(['Sam Reed', 'Ana Ruiz']), 'Sam Reed and 1 other');
  assert.equal(summariseActors(['Sam Reed', 'Ana Ruiz', 'Kai Obi']), 'Sam Reed and 2 others');
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
