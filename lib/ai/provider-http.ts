import type { AssistantMessage } from './provider-chain.ts';
import { ProviderCapacityError } from './provider-chain.ts';
import { StreamAccumulator, readSseEvents } from './stream-accumulator.ts';

type Json = Record<string, unknown>;
export const PROVIDER_UNAVAILABLE_MESSAGE = 'I couldn’t get an answer just now. Please try again in a moment.';

function upstreamError(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: unknown } | Array<{ error?: unknown }>;
    const value = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
    if (!value || typeof value !== 'object') return undefined;
    return value as { code?: unknown; status?: unknown; message?: unknown };
  } catch {
    return undefined;
  }
}

/** One transport for both streamed and whole answers. Never forward reasoning fields to the UI. */
export async function completeChat({
  url,
  headers,
  body,
  provider,
  signal,
  onDelta,
}: {
  url: string;
  headers: Record<string, string>;
  body: Json;
  provider: string;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}): Promise<AssistantMessage> {
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
      body: JSON.stringify({ ...body, stream: true }),
      signal: requestSignal,
    });
    if (!response.ok) {
      // Keep upstream details out of the browser. In development, retain only
      // the provider's structured error code/message so schema incompatibilities
      // can be diagnosed without logging the submitted conversation or headers.
      const failureBody = await response.text().catch(() => '');
      if (process.env.NODE_ENV !== 'production' && failureBody) {
        const upstream = upstreamError(failureBody);
        if (upstream) {
          console.error('[Ask DUMA provider rejection]', {
            provider,
            status: response.status,
            code: typeof upstream?.code === 'number' ? upstream.code : undefined,
            reason: typeof upstream?.status === 'string' ? upstream.status : undefined,
            message: typeof upstream?.message === 'string' ? upstream.message.slice(0, 500) : undefined,
          });
        } else {
          console.error('[Ask DUMA provider rejection]', { provider, status: response.status });
        }
      }
      // A compatibility-layer rejection can be specific to one provider. Let
      // the chain try the next configured model, while keeping provider names,
      // status codes and upstream wording out of the operator-facing chat.
      throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
    }
    if (!response.body) throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
    reader = response.body.getReader();
    const accumulator = new StreamAccumulator();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      if (buffer.length > 1_000_000) throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
      const parsed = readSseEvents(buffer);
      buffer = parsed.rest;
      for (const frame of parsed.events) {
        const event = JSON.parse(frame) as { error?: unknown; choices?: Array<{ delta?: Json; finish_reason?: string | null }> };
        if (event.error) throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
        const choice = event.choices?.[0];
        if (choice?.finish_reason === 'length') throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
        if (choice?.finish_reason) finished = true;
        const text = accumulator.push(choice);
        if (text) onDelta?.(text);
      }
    }
    const message = accumulator.message();
    if (!finished || (!message.content?.trim() && !message.tool_calls?.length))
      throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
    return message;
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof ProviderCapacityError) throw error;
    if (error instanceof TypeError || error instanceof SyntaxError || requestSignal.aborted)
      throw new ProviderCapacityError(PROVIDER_UNAVAILABLE_MESSAGE, provider);
    throw error;
  } finally {
    await reader?.cancel().catch(() => {});
    reader?.releaseLock();
  }
}
