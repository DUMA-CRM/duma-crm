import assert from 'node:assert/strict';
import test from 'node:test';

import { smallTalkResponse } from '../lib/ai/conversation-smalltalk.ts';

test('a greeting receives a short conversational reply', () => {
  assert.equal(smallTalkResponse('hello'), 'Hi! What can I help you with?');
  assert.equal(smallTalkResponse('Hey DUMA!'), 'Hi! What can I help you with?');
  assert.equal(smallTalkResponse('Good morning.'), 'Hi! What can I help you with?');
});

test('thanks and social check-ins remain lightweight', () => {
  assert.equal(smallTalkResponse('thank you'), 'You’re welcome.');
  assert.equal(smallTalkResponse('How are you?'), 'I’m ready to help. What would you like to check?');
});

test('real questions continue through the full agent', () => {
  assert.equal(smallTalkResponse('How are sales today?'), null);
  assert.equal(smallTalkResponse('Hello, can you check stock?'), null);
  assert.equal(smallTalkResponse('List recent orders'), null);
});
