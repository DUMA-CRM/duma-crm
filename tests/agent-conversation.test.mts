import assert from 'node:assert/strict';
import test from 'node:test';

import { conversationWindow, stableToolKey, visibleAnswer } from '../lib/ai/conversation.ts';

test('context is bounded and never starts with an orphan answer', () => {
  const messages = [
    { role: 'user' as const, content: 'old question' },
    { role: 'assistant' as const, content: 'old answer' },
    { role: 'user' as const, content: 'new question' },
  ];
  assert.deepEqual(conversationWindow(messages, 22), [messages[2]]);
});
test('suggestion metadata stays hidden even when its marker is split', () => {
  assert.equal(visibleAnswer('Done.\nFOLLOW_UPS: Check stock'), 'Done.');
  assert.equal(visibleAnswer('Done.\nFOLLOW_'), 'Done.');
  assert.equal(visibleAnswer('The stock is low.'), 'The stock is low.');
});
test('read deduplication ignores object ordering but preserves location, period and array ordering', () => {
  assert.equal(stableToolKey('orders', { end: 2, start: 1 }), stableToolKey('orders', { start: 1, end: 2 }));
  assert.notEqual(stableToolKey('orders', { locationId: 'a' }), stableToolKey('orders', { locationId: 'b' }));
  assert.notEqual(stableToolKey('orders', { ids: [1, 2] }), stableToolKey('orders', { ids: [2, 1] }));
});
