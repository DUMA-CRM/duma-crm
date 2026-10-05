import assert from 'node:assert/strict';
import test from 'node:test';

import { StreamAccumulator, readSseEvents } from '../lib/ai/stream-accumulator.ts';

function feed(accumulator: StreamAccumulator, deltas: unknown[]) {
  return deltas.map((delta) => accumulator.push({ delta: delta as Record<string, unknown> })).join('');
}

test('text arrives in fragments and comes back as one answer', () => {
  const accumulator = new StreamAccumulator();
  const emitted = feed(accumulator, [{ role: 'assistant', content: 'Yesterday you took ' }, { content: '£1,240' }, { content: '.' }]);

  assert.equal(emitted, 'Yesterday you took £1,240.');
  assert.equal(accumulator.message().content, 'Yesterday you took £1,240.');
  assert.equal(accumulator.message().tool_calls, undefined);
});

test('tool-call arguments split mid-JSON are concatenated, not overwritten', () => {
  // The failure this prevents: taking the last fragment as the arguments, which
  // yields `d"}` and a tool call that cannot be parsed.
  const accumulator = new StreamAccumulator();
  feed(accumulator, [
    { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'get_sales_report', arguments: '' } }] },
    { tool_calls: [{ index: 0, function: { arguments: '{"from":"2026-' } }] },
    { tool_calls: [{ index: 0, function: { arguments: '09-01","to":"2026-09-10"}' } }] },
  ]);

  const [call] = accumulator.message().tool_calls ?? [];
  assert.equal(call.function.name, 'get_sales_report');
  assert.deepEqual(JSON.parse(call.function.arguments), { from: '2026-09-01', to: '2026-09-10' });
});

test('complete Gemini argument snapshots replace earlier snapshots', () => {
  const accumulator = new StreamAccumulator();
  feed(accumulator, [
    { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'list_helpdesk_tickets', arguments: '{}' } }] },
    { tool_calls: [{ index: 0, function: { arguments: '{"from":null,"limit":20,"status":null}' } }] },
    { tool_calls: [{ index: 0, function: { arguments: '{"status":"open"}' } }] },
  ]);

  const [call] = accumulator.message().tool_calls ?? [];
  assert.deepEqual(JSON.parse(call.function.arguments), { status: 'open' });
});

test('parallel tool calls are kept apart by index, not by arrival order', () => {
  const accumulator = new StreamAccumulator();
  feed(accumulator, [
    { tool_calls: [{ index: 0, id: 'a', function: { name: 'list_orders', arguments: '{"stat' } }] },
    { tool_calls: [{ index: 1, id: 'b', function: { name: 'list_locations', arguments: '{}' } }] },
    { tool_calls: [{ index: 0, function: { arguments: 'us":"pending"}' } }] },
  ]);

  const calls = accumulator.message().tool_calls ?? [];
  assert.equal(calls.length, 2);
  assert.equal(calls[0].id, 'a');
  assert.deepEqual(JSON.parse(calls[0].function.arguments), { status: 'pending' });
  assert.equal(calls[1].function.name, 'list_locations');
});

test('Gemini calls with ids but no indexes are kept as separate calls', () => {
  const accumulator = new StreamAccumulator();
  feed(accumulator, [
    { tool_calls: [{ id: 'call_a', function: { name: 'list_locations', arguments: '{}' } }] },
    { tool_calls: [{ id: 'call_b', function: { name: 'list_orders', arguments: '{"status":"open"}' } }] },
    { tool_calls: [{ id: 'call_c', function: { name: 'list_helpdesk_tickets', arguments: '{"status":"open"}' } }] },
  ]);

  const calls = accumulator.message().tool_calls ?? [];
  assert.deepEqual(
    calls.map((call) => [call.id, call.function.name]),
    [
      ['call_a', 'list_locations'],
      ['call_b', 'list_orders'],
      ['call_c', 'list_helpdesk_tickets'],
    ],
  );
});

test('a provider field we do not know about survives the round trip', () => {
  // Gemini attaches a thought_signature to each tool call and rejects the next
  // request if it does not come back. Rebuilding a known shape would drop it,
  // and the conversation would fail one turn later, far from the cause.
  const accumulator = new StreamAccumulator();
  feed(accumulator, [
    {
      tool_calls: [
        {
          index: 0,
          id: 'c1',
          function: { name: 'get_inventory_status', arguments: '{}' },
          extra_content: { google: { thought_signature: 'sig-abc' } },
        },
      ],
    },
  ]);

  const [call] = accumulator.message().tool_calls ?? [];
  assert.deepEqual((call as unknown as Record<string, unknown>).extra_content, { google: { thought_signature: 'sig-abc' } });
});

test('a tool call that never receives a name is dropped rather than sent nameless', () => {
  const accumulator = new StreamAccumulator();
  feed(accumulator, [{ tool_calls: [{ index: 0, function: { arguments: '{}' } }] }]);
  assert.equal(accumulator.message().tool_calls, undefined);
});

test('an event split across two chunks waits for its blank line', () => {
  const first = readSseEvents('data: {"a":1}\n\ndata: {"b":');
  assert.deepEqual(first.events, ['{"a":1}']);
  assert.equal(first.rest, 'data: {"b":');

  const second = readSseEvents(`${first.rest}2}\n\n`);
  assert.deepEqual(second.events, ['{"b":2}']);
  assert.equal(second.rest, '');
});

test('stream bookkeeping lines are not mistaken for payloads', () => {
  const { events } = readSseEvents(': keep-alive\n\ndata: [DONE]\n\ndata: {"real":true}\n\n');
  assert.deepEqual(events, ['{"real":true}']);
});
