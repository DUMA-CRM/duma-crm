import assert from 'node:assert/strict';
import test from 'node:test';

import { learnAgentMemory } from '../lib/ai/agent-memory.ts';

test('learns and replaces an explicit answer-detail preference', () => {
  const detailed = learnAgentMemory('', 'Please respond with more detailed answers.');
  assert.equal(detailed, '- Response detail: Prefer detailed answers.');
  assert.equal(learnAgentMemory(detailed!, 'Keep the answer short and concise.'), '- Response detail: Prefer concise answers.');
});

test('preserves manual notes while learning presentation preferences', () => {
  const result = learnAgentMemory('I usually manage the morning shift.', 'Use charts for comparisons when useful.');
  assert.equal(result, 'I usually manage the morning shift.\n- Visuals: Prefer charts for suitable comparisons.');
});

test('does not infer memory from ordinary operational questions', () => {
  assert.equal(learnAgentMemory('Existing note', 'Compare refunds this week with last week.'), null);
});
