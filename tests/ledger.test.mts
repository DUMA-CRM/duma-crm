import assert from 'node:assert/strict';
import test from 'node:test';

const { groupByDay, inLedgerView, movementTitle, netChange } = await import('../lib/utils/ledger.ts');

const m = (type: string, quantity: number, extra: Record<string, unknown> = {}) => ({ type, quantity, createdAt: '2026-09-27T10:00:00', ...extra });

test('titles read as sentences', () => {
  assert.deepEqual(movementTitle(m('consume', -1, { sourceType: 'POS_ORDER' })), { title: 'Used in an order', tone: 'out' });
  assert.equal(movementTitle(m('waste', -1, { reason: 'EXPIRED' })).title, 'Wasted · expired');
  assert.equal(movementTitle(m('adjust', -2, { sourceType: 'STOCKTAKE' })).title, 'Stocktake correction');
  assert.equal(movementTitle(m('adjust', 2)).title, 'Adjusted up');
  assert.equal(movementTitle(m('transfer', -3)).title, 'Transferred out');
  assert.equal(movementTitle(m('receive', 5, { sourceType: 'CUSTOMER_RETURN' })).title, 'Returned by a customer');
});

test('views and net change', () => {
  assert.equal(inLedgerView('in', m('receive', 2)), true);
  assert.equal(inLedgerView('out', m('receive', 2)), false);
  assert.equal(inLedgerView('waste', m('waste', -1)), true);
  assert.equal(netChange([m('receive', 0.1), m('consume', -0.3)]), -0.2);
});

test('grouped by local day, newest first', () => {
  const now = new Date(2026, 8, 27, 18);
  const days = groupByDay([m('receive', 1, { createdAt: '2026-09-27T09:00:00' }), m('consume', -1, { createdAt: '2026-09-27T08:00:00' }), m('waste', -1, { createdAt: '2026-09-26T20:00:00' })], now);
  assert.deepEqual(days.map((d) => [d.label, d.items.length]), [['Today', 2], ['Yesterday', 1]]);
});
