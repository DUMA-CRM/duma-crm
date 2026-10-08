import assert from 'node:assert/strict';
import test from 'node:test';

const { startOrderHref } = await import('../lib/utils/start-order.ts');

test('the Till when there is one; otherwise a new order on the Orders page; otherwise nothing', () => {
  assert.equal(startOrderHref('c1', { pos: true, manual: true }), '/pos?customer=c1');
  assert.equal(startOrderHref('c1', { pos: false, manual: true }), '/orders?newOrder=c1');
  assert.equal(startOrderHref('c1', { pos: false, manual: false }), null);
});
