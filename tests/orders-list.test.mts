import assert from 'node:assert/strict';
import test from 'node:test';

const { groupOrdersByDay, itemCount, itemPreview, nextStep, orderCode, paymentSummary, shiftDay } =
  await import('../lib/utils/orders-list.ts');

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const order = (createdAt: string, status = 'done', totalAmount = 5) => ({ createdAt, status, totalAmount }) as never;

test('orders group under local days, newest first, with takings that skip cancelled orders', () => {
  const now = new Date(2026, 8, 26, 15);
  const days = groupOrdersByDay(
    [
      order(at(2026, 9, 26, 14), 'done', 4.5),
      order(at(2026, 9, 26, 9), 'cancelled', 9),
      order(at(2026, 9, 25), 'done', 3.2),
      order(at(2026, 9, 20), 'done', 2),
      order(at(2025, 12, 31), 'done', 1),
    ],
    now,
  );
  assert.deepEqual(
    days.map((day: { label: string; count: number; total: number }) => [day.label, day.count, day.total]),
    [
      ['Today', 2, 4.5],
      ['Yesterday', 1, 3.2],
      ['Sunday 20 September', 1, 2],
      ['Wednesday, 31 December 2025', 1, 1],
    ],
  );
});

test('the item preview names two items and counts the rest', () => {
  assert.equal(
    itemPreview([
      { name: 'Flat white', quantity: 2 },
      { name: 'Croissant', quantity: 1 },
    ]),
    '2× Flat white, Croissant',
  );
  assert.equal(
    itemPreview([
      { name: 'A', quantity: 1 },
      { name: 'B', quantity: 1 },
      { name: 'C', quantity: 3 },
      { name: 'D', quantity: 1 },
    ]),
    'A, B +2 more',
  );
  assert.equal(itemPreview([]), 'No items');
  assert.equal(itemCount([{ quantity: 2 }, { quantity: 3 }]), 5);
  // GET /orders returns orders without their items: unknown, not empty.
  assert.equal(itemPreview(undefined), null);
  assert.equal(itemCount(undefined), null);
});

test('an order moves one step at a time, and not at all until it is paid', () => {
  assert.deepEqual(nextStep({ status: 'pending', paymentStatus: 'paid' }), { status: 'preparing', label: 'Start preparing' });
  assert.deepEqual(nextStep({ status: 'preparing' }), { status: 'ready', label: 'Mark ready' });
  assert.deepEqual(nextStep({ status: 'ready', paymentStatus: 'paid' }), { status: 'done', label: 'Complete' });
  assert.equal(nextStep({ status: 'pending', paymentStatus: 'awaiting_cash_approval' }), null);
  assert.equal(nextStep({ status: 'done', paymentStatus: 'paid' }), null);
});

test('payment reads as the method, with a state only when it is not simply paid', () => {
  assert.deepEqual(paymentSummary({ paymentMethod: 'card', paymentStatus: 'paid' }), { method: 'Card', state: null, tone: 'success' });
  assert.deepEqual(paymentSummary({ paymentMethod: 'cash', paymentStatus: 'awaiting_cash_approval' }), {
    method: 'Cash',
    state: 'Cash at counter',
    tone: 'warning',
  });
  assert.equal(paymentSummary({ paymentMethod: 'card', paymentStatus: 'refunded' }).state, 'Refunded');
  assert.equal(paymentSummary({ paymentMethod: null, paymentStatus: 'failed' }).method, 'No payment');
});

test('codes and day steps', () => {
  assert.equal(orderCode('ab12cd34-0000-4000-8000-000000000000'), '#AB12CD34');
  assert.equal(shiftDay('2026-09-01', -1), '2026-08-31');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});

test('a refund adds the exact remaining unit amounts, and "everything" selects all that is left', async () => {
  const { refundAmount, refundLines, selectEverything } = await import('../lib/utils/orders-list.ts');
  const items = [
    {
      id: 'i1',
      base: { remainingQuantity: 2, unitAmounts: ['3.10', '3.10'] },
      modifiers: [{ id: 'm1', remainingQuantity: 1, unitAmounts: ['0.40'] }],
    },
    { id: 'i2', base: { remainingQuantity: 0, unitAmounts: [] }, modifiers: [] },
  ];
  assert.equal(refundAmount(items, { 'item:i1': 1 }), 3.1);
  const all = selectEverything(items);
  assert.deepEqual(all, { 'item:i1': 2, 'modifier:m1': 1 });
  assert.equal(refundAmount(items, all), 6.6);
  assert.deepEqual(refundLines(items, all), [
    { orderItemId: 'i1', quantity: 2 },
    { orderItemId: 'i1', orderItemModifierId: 'm1', quantity: 1 },
  ]);
});

test('activity merges status changes and refunds with the gap since the previous event', async () => {
  const { formatGap, orderActivity, turnaround } = await import('../lib/utils/orders-list.ts');
  const t = (m: number) => new Date(Date.UTC(2026, 8, 26, 9, 0) + m * 60_000).toISOString();
  const history = [
    { status: 'pending', createdAt: t(0) },
    { status: 'ready', createdAt: t(6) },
    { status: 'preparing', createdAt: t(1.5) },
    { status: 'done', createdAt: t(8) },
  ];
  const events = orderActivity(history, [{ createdAt: t(30) }]);
  assert.deepEqual(
    events.map((e: { kind: string; gapMs: number | null }) => [e.kind, e.gapMs]),
    [
      ['status', null],
      ['status', 90_000],
      ['status', 270_000],
      ['status', 120_000],
      ['refund', 1_320_000],
    ],
  );
  assert.equal(turnaround(history as never), 'Ready in 6 min');
  assert.equal(
    turnaround([
      { status: 'pending', createdAt: t(0) },
      { status: 'cancelled', createdAt: t(0.75) },
    ] as never),
    'Cancelled after 45 s',
  );
  assert.equal(turnaround([{ status: 'pending', createdAt: t(0) }] as never), null);
  assert.equal(formatGap(59_000), '59 s');
  assert.equal(formatGap(65 * 60_000), '1 h 5 min');
  assert.equal(formatGap(50 * 3600_000), '2 days');
});

test('a restocked item carries restock on its own line only, never on a modifier', async () => {
  const { refundLines } = await import('../lib/utils/orders-list.ts');
  const items = [
    {
      id: 'i1',
      base: { remainingQuantity: 1, unitAmounts: ['5.00'] },
      modifiers: [{ id: 'm1', remainingQuantity: 1, unitAmounts: ['0.40'] }],
    },
  ];
  assert.deepEqual(refundLines(items, { 'item:i1': 1, 'modifier:m1': 1 }, new Set(['i1'])), [
    { orderItemId: 'i1', quantity: 1, restock: true },
    { orderItemId: 'i1', orderItemModifierId: 'm1', quantity: 1 },
  ]);
});

test('a delivery address prints as packing-slip lines, blanks dropped', async () => {
  const { shippingAddressLines } = await import('../lib/utils/orders-list.ts');
  assert.deepEqual(
    shippingAddressLines({
      recipientName: 'Sam Lee',
      line1: '1 High St',
      line2: '',
      city: 'Leeds',
      region: null,
      postcode: 'ls1 1aa',
      country: 'gb',
    }),
    ['Sam Lee', '1 High St', 'Leeds', 'LS1 1AA', 'GB'],
  );
  assert.deepEqual(
    shippingAddressLines({
      recipientName: 'A',
      line1: 'Flat 2',
      line2: '9 Mill Rd',
      city: 'Leeds',
      region: 'West Yorkshire',
      postcode: 'LS2',
      country: 'GB',
    }),
    ['A', 'Flat 2', '9 Mill Rd', 'Leeds, West Yorkshire', 'LS2', 'GB'],
  );
});

test('a website payment names its provider and a short reference', async () => {
  const { paymentSourceLabel } = await import('../lib/utils/orders-list.ts');
  assert.equal(paymentSourceLabel('stripe', 'pi_3NfAbCdEfGhIjKlMn'), 'Stripe · pi_3NfAbCdEfGhIj…');
  assert.equal(paymentSourceLabel('shopify_payments', null), 'Shopify Payments');
  assert.equal(paymentSourceLabel(null, 'x'), null);
});
