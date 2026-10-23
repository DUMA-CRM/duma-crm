import assert from 'node:assert/strict';
import test from 'node:test';

const { conditionDefaults, conditionSentence, operatorsFor, validOperator } = await import('../lib/utils/workflow-conditions.ts');

test('operatorsFor: only the comparisons that make sense', () => {
  assert.deepEqual(operatorsFor('yesno'), ['equals']);
  assert.deepEqual(operatorsFor('choice'), ['equals', 'not_equals']);
  assert.ok(operatorsFor('money').includes('greater_than_or_equal'));
  assert.ok(!operatorsFor('money').includes('contains'));
  assert.ok(operatorsFor('text').includes('contains'));
});

test('conditionDefaults: a starting value that can actually match', () => {
  assert.deepEqual(conditionDefaults('customer.marketingOptIn'), { operator: 'equals', value: true });
  assert.deepEqual(conditionDefaults('customer.tier'), { operator: 'equals', value: 'vip' });
  assert.deepEqual(conditionDefaults('order.totalAmount'), { operator: 'equals', value: 0 });
  assert.deepEqual(conditionDefaults('staff.role'), { operator: 'equals', value: '' });
});

test('validOperator: a comparison that no longer suits the field falls back', () => {
  assert.equal(validOperator('customer.tier', 'greater_than'), 'equals');
  assert.equal(validOperator('order.totalAmount', 'greater_than'), 'greater_than');
  assert.equal(validOperator('customer.marketingOptIn', 'not_equals'), 'equals');
});

test('conditionSentence: the condition in words', () => {
  assert.equal(conditionSentence({ field: 'customer.tier', operator: 'equals', value: 'gold' }), 'loyalty tier is Gold');
  assert.equal(
    conditionSentence({ field: 'order.totalAmount', operator: 'greater_than_or_equal', value: 20 }, { money: (n) => `£${n.toFixed(2)}` }),
    'order total is at least £20.00',
  );
  assert.equal(conditionSentence({ field: 'customer.marketingOptIn', operator: 'equals', value: true }), 'gets marketing emails');
  assert.equal(conditionSentence({ field: 'customer.marketingOptIn', operator: 'equals', value: false }), 'doesn’t get marketing emails');
  assert.equal(conditionSentence({ field: 'staff.locationId', operator: 'equals', value: 'l1' }, { locationName: () => 'North Street' }), 'works at North Street');
  assert.equal(conditionSentence({ field: 'staff.locationId', operator: 'not_equals', value: 'l1' }, { locationName: () => 'North Street' }), 'doesn’t work at North Street');
  assert.equal(conditionSentence({ field: 'staff.role', operator: 'contains', value: '' }), 'access role contains …');
});

