import assert from 'node:assert/strict';
import test from 'node:test';

const { dueLabel, invoiceDifference, isOverdue, orderTotal, receivedShare } = await import('../lib/utils/purchase-orders.ts');

const now = new Date(2026, 8, 27, 15);

test('an order is overdue only while it waits on a delivery past its day', () => {
  assert.equal(isOverdue({ status: 'submitted', expectedAt: '2026-09-26' }, now), true);
  assert.equal(isOverdue({ status: 'submitted', expectedAt: '2026-09-27' }, now), false);
  assert.equal(isOverdue({ status: 'received', expectedAt: '2026-09-20' }, now), false);
  assert.equal(isOverdue({ status: 'partially_received', expectedAt: null }, now), false);
});

test('due labels read as a manager says them', () => {
  assert.equal(dueLabel({ status: 'submitted', expectedAt: '2026-09-27' }, now), 'Due today');
  assert.equal(dueLabel({ status: 'submitted', expectedAt: '2026-09-28' }, now), 'Due tomorrow');
  assert.equal(dueLabel({ status: 'submitted', expectedAt: '2026-09-25' }, now), '2 days late');
  assert.equal(dueLabel({ status: 'draft', expectedAt: '2026-09-28' }, now), null);
});

test('totals, received share and invoice difference', () => {
  const lines = [
    { quantityOrdered: '3', quantityReceived: '3', unitCost: '1.10' },
    { quantityOrdered: '10', quantityReceived: '2', unitCost: '0.333' },
  ];
  assert.equal(orderTotal(lines), 6.63);
  assert.equal(receivedShare(lines), 5 / 13);
  assert.equal(receivedShare([{ quantityOrdered: '2', quantityReceived: '5', unitCost: '1' }]), 1);
  assert.equal(invoiceDifference('7.00', 6.63), 0.37);
  assert.equal(invoiceDifference('', 6.63), null);
});
