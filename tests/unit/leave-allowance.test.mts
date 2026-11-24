import assert from 'node:assert/strict';
import { test } from 'node:test';

import { allowanceSaveBlock } from '../../lib/utils/leave-allowance.ts';

const base = {
  editing: false,
  wantsDefaultAnnual: true,
  typesStatus: 'success',
  annualTypeExists: true,
  canConfigureLeave: false,
} as const;

test('a first allowance with no annual type needs hr.leave:config', () => {
  assert.equal(allowanceSaveBlock({ ...base, annualTypeExists: false }), 'needs-config');
  assert.equal(allowanceSaveBlock({ ...base, annualTypeExists: false, canConfigureLeave: true }), null);
});

test('never creates a type before the leave types have loaded', () => {
  assert.equal(allowanceSaveBlock({ ...base, typesStatus: 'pending', annualTypeExists: false, canConfigureLeave: true }), 'loading-types');
  assert.equal(allowanceSaveBlock({ ...base, typesStatus: 'error', annualTypeExists: false, canConfigureLeave: true }), 'types-failed');
});

test('editing, or choosing an existing type, is never blocked', () => {
  assert.equal(allowanceSaveBlock({ ...base, editing: true, typesStatus: 'error', annualTypeExists: false }), null);
  assert.equal(allowanceSaveBlock({ ...base, wantsDefaultAnnual: false, annualTypeExists: false }), null);
  assert.equal(allowanceSaveBlock(base), null);
});
