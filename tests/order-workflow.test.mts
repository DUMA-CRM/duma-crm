import assert from 'node:assert/strict';
import test from 'node:test';

const { paymentClears } = await import('../lib/utils/order-workflow.ts');
const { isOnScreen } = await import('../lib/utils/kds.ts');
const { nextStep } = await import('../lib/utils/orders-list.ts');

test('a till, QR or online order waits for payment; one taken by hand does not', () => {
  assert.equal(paymentClears({ source: 'pos', paymentStatus: 'unpaid' }), false);
  assert.equal(paymentClears({ source: 'qr_code', paymentStatus: 'awaiting_cash_approval' }), false);
  assert.equal(paymentClears({ source: 'manual', paymentStatus: 'unpaid' }), true);
  assert.equal(paymentClears({ source: 'manual', paymentStatus: 'paid' }), true);
  assert.equal(paymentClears({ source: 'manual', paymentStatus: 'refunded' }), false, 'refunded is not "to be paid later"');
});

test('the kitchen screen and the next-step button follow the same rule', () => {
  const now = Date.now();
  assert.equal(isOnScreen({ source: 'manual', paymentStatus: 'unpaid' }, now), true);
  assert.equal(isOnScreen({ source: 'pos', paymentStatus: 'unpaid' }, now), false);
  assert.deepEqual(nextStep({ status: 'pending', paymentStatus: 'unpaid', source: 'manual' } as never), { status: 'preparing', label: 'Start preparing' });
  assert.equal(nextStep({ status: 'pending', paymentStatus: 'unpaid', source: 'pos' } as never), null);
});
