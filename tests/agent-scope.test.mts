import assert from 'node:assert/strict';
import test from 'node:test';

import { isAppRelatedRequest } from '../lib/ai/agent-scope.ts';

test('rejects general-purpose code generation before it reaches the model', () => {
  assert.equal(isAppRelatedRequest('Can you write HTML code for a calculator and make it ready to copy?'), false);
  assert.equal(isAppRelatedRequest('Build me a React landing page'), false);
});

test('rejects unrelated general questions', () => {
  assert.equal(isAppRelatedRequest('What is the weather tomorrow?'), false);
  assert.equal(isAppRelatedRequest('Write a poem about coffee'), false);
  assert.equal(isAppRelatedRequest('What is the capital of France?'), false);
});

test('allows operational DUMA questions and UI guidance', () => {
  assert.equal(isAppRelatedRequest('Create a purchase order for 10 litres of oat milk tomorrow'), true);
  assert.equal(isAppRelatedRequest('What sold least this week?'), true);
  assert.equal(isAppRelatedRequest('Why is this select not working in the drawer?'), true);
  assert.equal(isAppRelatedRequest('Guide me through closing the cash-up'), true);
  assert.equal(isAppRelatedRequest('How can I change my name?'), true);
  assert.equal(isAppRelatedRequest('Do I have any My HR warnings?'), true);
  assert.equal(isAppRelatedRequest('Review today’s operations and tell me the three things that need attention first.'), true);
  assert.equal(isAppRelatedRequest('What needs attention today?'), true);
  assert.equal(isAppRelatedRequest('What needs doing?'), true);
  assert.equal(isAppRelatedRequest('How is my business doing today?'), true);
  assert.equal(isAppRelatedRequest('Review today’s operations'), true);
  assert.equal(isAppRelatedRequest('Summarise our performance and biggest problems'), true);
});

test('allows short follow-ups only after an in-scope request', () => {
  assert.equal(isAppRelatedRequest('Tomorrow instead', ['Create a purchase order for oat milk']), true);
  assert.equal(isAppRelatedRequest('But this content is related to my business', ['What needs attention today?']), true);
  assert.equal(isAppRelatedRequest('Yes, do that', ['What is the weather tomorrow?']), false);
  assert.equal(isAppRelatedRequest('Yes, do that'), false);
});

test('an unrelated request stays blocked even after an app conversation', () => {
  assert.equal(isAppRelatedRequest('Now write the calculator in JavaScript', ['Show pending orders']), false);
});
