import assert from 'node:assert/strict';
import test from 'node:test';

import { ProviderCapacityError, providerChain } from '../lib/ai/provider-chain.ts';

type Reply = { type: 'answer'; text: string } | { type: 'capacity' } | { type: 'refuse' };

/** A provider that answers, runs out of capacity, or rejects the request outright. */
function stub(id: string, script: Reply[]) {
  const seen: unknown[][] = [];
  let call = 0;
  return {
    seen,
    provider: {
      id,
      model: `${id}-model`,
      label: id,
      async complete(messages: unknown[]) {
        seen.push(messages);
        const reply = script[Math.min(call++, script.length - 1)];
        if (reply.type === 'capacity') throw new ProviderCapacityError(`${id} is rate limited`, id);
        if (reply.type === 'refuse') throw new Error(`${id} rejected the request`);
        return { role: 'assistant' as const, content: reply.text };
      },
    },
  };
}

const TOOLS = [{ name: 'list_locations', description: 'List locations', parameters: { type: 'object' } }];

test('a rate-limited primary hands the same conversation to the backup', async () => {
  const primary = stub('gemini', [{ type: 'capacity' }]);
  const backup = stub('gemma', [{ type: 'answer', text: 'Two locations.' }]);
  const chain = providerChain([primary.provider, backup.provider], TOOLS);
  const switches: string[] = [];

  const conversation = [{ role: 'user', content: 'How many locations?' }];
  const message = await chain.complete(conversation, (next) => switches.push(next.label));

  assert.equal(message.content, 'Two locations.');
  assert.deepEqual(switches, ['gemma']);
  assert.equal(chain.fallback?.id, 'gemma');
  assert.equal(chain.answering.id, 'gemma');
  // The backup resumes the work rather than restarting it.
  assert.deepEqual(backup.seen[0], conversation);
});

test('once switched, later turns stay on the backup', async () => {
  const primary = stub('gemini', [{ type: 'capacity' }]);
  const backup = stub('gemma', [
    { type: 'answer', text: 'first' },
    { type: 'answer', text: 'second' },
  ]);
  const chain = providerChain([primary.provider, backup.provider], TOOLS);

  await chain.complete([{ role: 'user', content: 'one' }], () => {});
  const second = await chain.complete([{ role: 'user', content: 'two' }], () => {});

  assert.equal(second.content, 'second');
  // The exhausted primary is not asked again inside the same turn.
  assert.equal(primary.seen.length, 1);
});

test('a request the primary rejected is not replayed elsewhere', async () => {
  const primary = stub('gemini', [{ type: 'refuse' }]);
  const backup = stub('gemma', [{ type: 'answer', text: 'never reached' }]);
  const chain = providerChain([primary.provider, backup.provider], TOOLS);

  await assert.rejects(() => chain.complete([{ role: 'user', content: 'hi' }], () => {}), /gemini rejected the request/);
  assert.equal(backup.seen.length, 0);
  assert.equal(chain.fallback, undefined);
});

test('when every provider is out of capacity the last failure surfaces', async () => {
  const primary = stub('gemini', [{ type: 'capacity' }]);
  const backup = stub('gemma', [{ type: 'capacity' }]);
  const chain = providerChain([primary.provider, backup.provider], TOOLS);

  await assert.rejects(() => chain.complete([{ role: 'user', content: 'hi' }], () => {}), /gemma is rate limited/);
});

test('a single configured provider still answers', async () => {
  const only = stub('gemini', [{ type: 'answer', text: 'fine' }]);
  const chain = providerChain([only.provider], TOOLS);

  assert.equal((await chain.complete([], () => {})).content, 'fine');
  assert.equal(chain.fallback, undefined);
});
