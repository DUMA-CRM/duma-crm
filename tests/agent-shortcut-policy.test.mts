import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentShortcut } from '../lib/ai/agent-types.ts';
import { selectRelevantShortcuts } from '../lib/ai/shortcut-policy.ts';

const shortcuts: AgentShortcut[] = [
  { label: 'Open reports', href: '/reports', kind: 'page' },
  { label: 'Open customers', href: '/customers', kind: 'page' },
  { label: 'Open orders', href: '/orders', kind: 'page' },
  { label: 'Open inventory', href: '/inventory', kind: 'page' },
];

test('an informational answer does not become a list of supporting pages', () => {
  assert.deepEqual(selectRelevantShortcuts('How did latte sales perform?', 'Sales increased by 4%.', shortcuts), []);
});

test('an explicit navigation request gets only the best matching destination', () => {
  assert.deepEqual(selectRelevantShortcuts('Open the inventory page', 'Inventory is ready.', shortcuts), [shortcuts[3]]);
});

test('one directly related destination is retained', () => {
  assert.deepEqual(selectRelevantShortcuts('Which orders are pending?', 'There are 3 pending orders.', [shortcuts[2]]), [shortcuts[2]]);
});

test('one tangential supporting destination is still hidden', () => {
  assert.deepEqual(selectRelevantShortcuts('How many people are working?', 'Three people are clocked in.', [shortcuts[2]]), []);
});

test('an ambiguous navigation request does not choose an arbitrary page', () => {
  assert.deepEqual(selectRelevantShortcuts('Take me there', 'I found the information.', shortcuts), []);
});

test('the answer can resolve a referential navigation request', () => {
  assert.deepEqual(selectRelevantShortcuts('Open it for me', 'The inventory workspace has the full stock list.', shortcuts), [
    shortcuts[3],
  ]);
});

test('a personal-name question keeps the exact My HR action', () => {
  const editDetails: AgentShortcut = {
    label: 'Edit your details',
    href: '/my-hr?tab=overview&action=edit-details',
    description: 'My HR · Review your name and edit personal details',
    kind: 'page',
  };
  assert.deepEqual(selectRelevantShortcuts('How can I change my name?', 'You can update your personal details in My HR.', [editDetails]), [
    editDetails,
  ]);
});
