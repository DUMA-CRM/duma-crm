import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REFUND_NEEDS_PAYMENT,
  type RefundableItem,
  parseRefundAmount,
  refundAmount,
  refundLines,
  refundPosition,
  selectEverything,
} from '../../lib/utils/orders-list.ts';

const items: RefundableItem[] = [
  {
    id: 'latte',
    // A discounted pair: the API splits the discount unevenly, and those exact amounts are what's refundable.
    base: { remainingQuantity: 2, unitAmounts: ['2.88', '2.87'] },
    modifiers: [{ id: 'oat', remainingQuantity: 2, unitAmounts: ['0.45', '0.45'] }],
  },
  { id: 'cookie', base: { remainingQuantity: 0, unitAmounts: [] }, modifiers: [] },
];

test('a refund of part refunds leaves exactly nothing once it all went back, in pence not floats', () => {
  // 0.70 + 0.10 is 0.7999999999999999 in floats: the drawer used to read that as 1e-16 still refundable.
  const order = { totalAmount: '0.80', paymentStatus: 'paid', refunds: [{ amount: '0.70' }, { amount: '0.10' }] };
  assert.deepEqual(refundPosition(order), { refunded: 0.8, refundable: 0, refundedFull: true, paid: true });
});

test('what is left to refund is the total less refunds, never below zero', () => {
  assert.deepEqual(refundPosition({ totalAmount: '12.50', paymentStatus: 'paid', refunds: [{ amount: '2.25' }] }), {
    refunded: 2.25,
    refundable: 10.25,
    refundedFull: false,
    paid: true,
  });
  assert.equal(refundPosition({ totalAmount: '5.00', paymentStatus: 'paid', refunds: [{ amount: '6.00' }] }).refundable, 0);
  const untouched = refundPosition({ totalAmount: '5.00', paymentStatus: 'paid' });
  assert.equal(untouched.refundable, 5);
  assert.equal(untouched.refundedFull, false);
});

test('only paid orders can be refunded — the API refuses anything else with the same reason', () => {
  for (const paymentStatus of ['paid', 'partially_refunded']) {
    assert.equal(refundPosition({ totalAmount: '5.00', paymentStatus }).paid, true, paymentStatus);
  }
  for (const paymentStatus of ['unpaid', 'awaiting_payment', 'awaiting_cash_approval', 'processing', 'failed', 'cancelled', undefined]) {
    assert.equal(refundPosition({ totalAmount: '5.00', paymentStatus }).paid, false, String(paymentStatus));
  }
  assert.match(REFUND_NEEDS_PAYMENT, /hasn.t been paid/);
});

test('a refund selection pays back the exact per-unit amounts, never list prices', () => {
  assert.equal(refundAmount(items, { 'item:latte': 1 }), 2.88);
  assert.equal(refundAmount(items, { 'item:latte': 2, 'modifier:oat': 2 }), 6.65);
  assert.equal(refundAmount(items, {}), 0);
  // Asking for more than remains can only take the units that exist.
  assert.equal(refundAmount(items, { 'item:latte': 5 }), 5.75);
});

test('refund lines restock products only, and leave out anything not chosen', () => {
  const lines = refundLines(items, { 'item:latte': 1, 'modifier:oat': 1, 'item:cookie': 0 }, new Set(['latte', 'oat']));
  assert.deepEqual(lines, [
    { orderItemId: 'latte', quantity: 1, restock: true },
    { orderItemId: 'latte', orderItemModifierId: 'oat', quantity: 1 },
  ]);
  assert.deepEqual(refundLines(items, {}), []);
});

test('a refund starts from everything still refundable', () => {
  assert.deepEqual(selectEverything(items), { 'item:latte': 2, 'modifier:oat': 2 });
});

test('a typed refund amount is checked the way the API checks it', () => {
  assert.deepEqual(parseRefundAmount('£4.50', 10), { ok: true, amount: '4.50', value: 4.5 });
  assert.deepEqual(parseRefundAmount('0.8', 0.8), { ok: true, amount: '0.80', value: 0.8 });
  assert.deepEqual(parseRefundAmount('', 10), { ok: false, problem: null });
  assert.equal(parseRefundAmount('4.505', 10).ok, false);
  assert.equal(parseRefundAmount('-1', 10).ok, false);
  assert.deepEqual(parseRefundAmount('0.00', 10), { ok: false, problem: 'The amount must be more than zero' });
  assert.deepEqual(parseRefundAmount('10.01', 10), { ok: false, problem: 'That’s more than is left to refund' });
});
