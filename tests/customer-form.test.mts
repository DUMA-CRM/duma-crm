import assert from 'node:assert/strict';
import test from 'node:test';

import { type CustomerFormValues, customerFormSnapshot } from '../lib/utils/customer-form.ts';

const original: CustomerFormValues = {
  firstName: 'Test',
  lastName: 'Guest',
  phone: '+441234567890',
  email: 'test@example.com',
  dob: '2000-01-01',
  allergies: ['milk', 'eggs'],
  dietary: ['vegan'],
  seating: 'Window',
  alerts: [{ severity: 'warning', label: 'Check order' }],
};

test('every editable customer field is included in change detection', () => {
  const baseline = customerFormSnapshot(original);
  for (const change of [
    { firstName: 'Other' },
    { lastName: 'Other' },
    { phone: '' },
    { email: '' },
    { dob: '' },
    { allergies: [] },
    { dietary: [] },
    { seating: '' },
    { alerts: [] },
    { alerts: [{ severity: 'critical', label: 'Check order' }] },
    { alerts: [{ severity: 'warning', label: 'Different' }] },
    { alerts: [{ severity: 'warning', label: 'Check order', note: 'Detail' }] },
  ])
    assert.notEqual(customerFormSnapshot({ ...original, ...change }), baseline);
  assert.equal(customerFormSnapshot({ ...original, firstName: 'Test' }), baseline);
});

test('reordered selections and an absent alert note are not edits', () => {
  assert.equal(
    customerFormSnapshot({ ...original, allergies: ['eggs', 'milk'], alerts: [{ severity: 'warning', label: 'Check order', note: '' }] }),
    customerFormSnapshot(original),
  );
  assert.deepEqual(original.allergies, ['milk', 'eggs']);
});
