import assert from 'node:assert/strict';
import test from 'node:test';

import { isAppRelatedRequest } from '../lib/ai/agent-scope.ts';

/**
 * The regression this file exists for.
 *
 * These nine questions were measured against the previous allow-list guard and
 * seven were refused before a model was ever called — not answered badly,
 * refused, because the operator used "takings" instead of "revenue" or named a
 * location the vocabulary did not contain. They are the reason the guard is now
 * a deny-list, and they are the first thing to re-run if anyone tightens it.
 */
test('ordinary manager questions reach the model', () => {
  for (const question of [
    'Are we busy on Saturday?',
    'Which barista is fastest?',
    'Why did takings drop last week?',
    'Should I hire another part-timer?',
    'Compare Camden and Shoreditch',
    'How much did we make yesterday?',
    'Is anyone off sick today?',
    'What should I do about the milk supplier?',
    'Write me a rota for next week',
  ]) {
    assert.equal(isAppRelatedRequest(question), true, question);
  }
});

test('the operational and UI questions the old guard already allowed still pass', () => {
  for (const question of [
    'Create a purchase order for 10 litres of oat milk tomorrow',
    'What sold least this week?',
    'Why is this select not working in the drawer?',
    'Guide me through closing the cash-up',
    'How can I change my name?',
    'Do I have any My HR warnings?',
    'Review today’s operations and tell me the three things that need attention first.',
    'What needs attention today?',
    'How is my business doing today?',
    'Why can’t customers place a QR code order at 19:49?',
  ]) {
    assert.equal(isAppRelatedRequest(question), true, question);
  }
});

test('short follow-ups no longer need the previous turn to vouch for them', () => {
  // The allow-list refused "yes, do that" unless it could prove the preceding
  // user turn was in scope. A deny-list has nothing to object to.
  assert.equal(isAppRelatedRequest('Yes, do that'), true);
  assert.equal(isAppRelatedRequest('Tomorrow instead'), true);
  assert.equal(isAppRelatedRequest('the first one'), true);
});

test('general-purpose software work is refused however it is framed', () => {
  for (const question of [
    'Can you write HTML code for a calculator and make it ready to copy?',
    'Build me a React landing page',
    'Write me a python script to parse this',
    'Now write the calculator in JavaScript',
    'Give me a regex for email addresses',
  ]) {
    assert.equal(isAppRelatedRequest(question), false, question);
  }
});

test('content, media and the outside world are refused', () => {
  for (const question of [
    'Write a poem about coffee',
    'Draft me a cover letter',
    'Generate an image of a latte',
    'What is the weather tomorrow?',
    'What is the bitcoin price?',
    'Translate this into French',
    'What is the capital of France?',
  ]) {
    assert.equal(isAppRelatedRequest(question), false, question);
  }
});

test('business language is never mistaken for the work DUMA refuses', () => {
  // Each of these contains a word that appears inside a deny pattern. The
  // pattern must be specific enough that the real question survives.
  for (const question of [
    'Who is on shift today?',
    'Which supplier is cheapest for oat milk?',
    'Design a new menu category for pastries',
    'What is our sales forecast for next week?',
    'Show me the picture on the QR menu item',
    'Write a note on this order',
  ]) {
    assert.equal(isAppRelatedRequest(question), true, question);
  }
});
