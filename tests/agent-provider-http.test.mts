import assert from 'node:assert/strict';
import test from 'node:test';

import { providerChain } from '../lib/ai/provider-chain.ts';
import { completeChat, PROVIDER_UNAVAILABLE_MESSAGE } from '../lib/ai/provider-http.ts';

const opts = { url: 'https://example.test', headers: {}, body: {}, provider: 'Test' };
function response(text: string, finished = true) {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n${finished ? 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n' : ''}`,
  );
}
test('transport streams only answer text and requires a complete answer', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response('Answer'));
  const deltas: string[] = [];
  const result = await completeChat({ ...opts, onDelta: (text) => deltas.push(text) });
  assert.equal(result.content, 'Answer');
  assert.deepEqual(deltas, ['Answer']);
});
test('an incomplete stream falls through to the third provider', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => (++requests < 3 ? response('Partial', false) : response('Complete')));
  const providers = ['one', 'two', 'nvidia'].map((id) => ({
    id,
    model: id,
    label: id,
    complete: () => completeChat({ ...opts, provider: id }),
  }));
  const chain = providerChain(providers, []);
  assert.equal((await chain.complete([], () => {})).content, 'Complete');
  assert.equal(chain.fallback?.id, 'nvidia');
});
test('caller cancellation does not trigger another provider', async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async () => {
    controller.signal.throwIfAborted();
    return response('never');
  });
  await assert.rejects(completeChat({ ...opts, signal: controller.signal }), { name: 'AbortError' });
});
test('raw upstream errors are not exposed', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"secret upstream detail"}', { status: 429 }));
  await assert.rejects(
    completeChat(opts),
    (error: unknown) => error instanceof Error && error.message === PROVIDER_UNAVAILABLE_MESSAGE,
  );
});

test('a provider-specific bad request falls through without exposing technical details', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    ++requests === 1
      ? new Response('[{"error":{"code":400,"message":"Request contains an invalid argument."}}]', { status: 400 })
      : response('Recovered'),
  );
  const providers = ['gemini', 'backup'].map((id) => ({
    id,
    model: id,
    label: id,
    complete: () => completeChat({ ...opts, provider: id }),
  }));

  const answer = await providerChain(providers, []).complete([], () => {});
  assert.equal(answer.content, 'Recovered');
  assert.equal(requests, 2);
});
