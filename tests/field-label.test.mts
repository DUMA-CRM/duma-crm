import assert from 'node:assert/strict';
import test from 'node:test';

import { fieldLabel } from '../lib/utils/field-label.ts';

test('drawer labels mark optional fields without duplicating existing wording', () => {
  assert.deepEqual(fieldLabel('Email (optional)', false, true), { text: 'Email', required: false, optional: true });
  assert.deepEqual(fieldLabel('Note', false, true), { text: 'Note', required: false, optional: true });
});

test('required fields override optional wording and normalise legacy asterisks', () => {
  assert.deepEqual(fieldLabel('Quantity (optional)', true, true), { text: 'Quantity', required: true, optional: false });
  assert.deepEqual(fieldLabel('Expiry *', false, true), { text: 'Expiry', required: true, optional: false });
});

test('labels outside forms and read-only context do not acquire optional wording', () => {
  assert.deepEqual(fieldLabel('From'), { text: 'From', required: false, optional: false });
});
