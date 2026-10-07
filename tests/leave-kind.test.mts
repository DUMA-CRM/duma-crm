import assert from 'node:assert/strict';
import test from 'node:test';

const { leaveKind } = await import('../lib/utils/my-hr.ts');

test('leave kind reads annual leave under its usual names', () => {
  assert.equal(leaveKind('Annual leave'), 'annual');
  assert.equal(leaveKind('Holiday'), 'annual');
  assert.equal(leaveKind('Paid vacation'), 'annual');
});

test('leave kind reads sickness', () => {
  assert.equal(leaveKind('Sick leave'), 'sick');
  assert.equal(leaveKind('Sickness'), 'sick');
});

test('anything else is other, including an empty name', () => {
  assert.equal(leaveKind('Compassionate leave'), 'other');
  assert.equal(leaveKind('Bank holiday swap'), 'annual');
  assert.equal(leaveKind(''), 'other');
  assert.equal(leaveKind(null), 'other');
});
