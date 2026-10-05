import assert from 'node:assert/strict';
import test from 'node:test';

const { direction, itemLine, otherSide, quantityError, signedChange } = await import('../lib/utils/transfers.ts');

const t = {
  fromLocationId: 'a',
  toLocationId: 'b',
  status: 'pending' as const,
  fromLocation: { name: 'North Street' },
  toLocation: { name: 'Canal Side' },
  lines: [
    { stockItemId: 'milk', quantity: '2.00' },
    { stockItemId: 'beans', quantity: '1.50' },
  ],
};

test('direction, other side and the signed change', () => {
  assert.equal(direction(t, 'a'), 'out');
  assert.equal(otherSide(t, 'a'), 'Canal Side');
  assert.equal(otherSide(t, 'b'), 'North Street');
  assert.equal(signedChange(t, 'milk', 'a'), -2);
  assert.equal(signedChange(t, 'milk', 'b'), 2);
  assert.equal(signedChange(t, 'oat', 'a'), null);
  assert.deepEqual(itemLine(t, 'beans'), { quantity: 1.5, others: 1 });
});

test('quantity checks match the API', () => {
  assert.equal(quantityError('2', 3), null);
  assert.equal(quantityError('0,5', 3), null);
  assert.ok(quantityError('', 3));
  assert.ok(quantityError('1.234', 3));
  assert.ok(quantityError('0', 3));
  assert.equal(quantityError('4', 3), 'Only 3 available.');
});
