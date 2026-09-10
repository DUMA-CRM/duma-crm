import 'server-only';

import type { AgentProviderInfo, AssistantMessage, AssistantToolCall, ChatProvider } from './provider-chain.ts';
import { AGENT_PROVIDER_NAMES, ProviderCapacityError, orderProviders } from './provider-chain.ts';
import { StreamAccumulator, readSseEvents } from './stream-accumulator.ts';
import { relaxSchema } from './tool-schema.ts';

/**
 * The configured chat providers, in preference order.
 *
 * The agent is only useful while a model will answer, and the Gemini free tier
 * runs out mid-shift. So the turn loop is written against a list of providers
 * rather than one endpoint (see `providerChain`): when the primary reports a
 * capacity problem, the same conversation continues on the next provider
 * instead of failing in front of the operator.
 *
 * Both providers speak the OpenAI chat-completions dialect, so the only real
 * differences are the URL, the auth header and how fussy each one is about
 * JSON Schema (see `relaxSchema`).
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
// A second open model OpenRouter can route to when the first is rate-limited.
// Both must support tool calling — the agent is useless without it.
const DEFAULT_OPENROUTER_BACKUP = 'google/gemma-4-26b-a4b-it:free';
const REQUEST_TIMEOUT_MS = 60_000;
const RATE_LIMIT_RETRIES = 1;
const RATE_LIMIT_BACKOFF_MS = 1_500;

type JsonObject = Record<string, unknown>;

interface CompletionChoice {
  message?: { role?: string; content?: string | null; tool_calls?: unknown };
}

/** A `choices[0]` from a streamed response — the delta shape, not the message shape. */
interface StreamChoice {
  delta?: { content?: unknown; tool_calls?: unknown } & JsonObject;
  finish_reason?: string | null;
}

interface CompletionBody {
  choices?: Array<CompletionChoice & StreamChoice>;
  // OpenRouter wraps the upstream provider's own message in `metadata.raw`;
  // that inner text is the one worth showing ("temporarily rate-limited
  // upstream") rather than its generic "Provider returned error".
  error?: { message?: string; code?: string | number; metadata?: { raw?: string; provider_name?: string } };
}

function errorMessage(result: CompletionBody, status: number, providerId: string) {
  const raw = typeof result.error?.metadata?.raw === 'string' ? result.error.metadata.raw : '';
  return (raw || result.error?.message || `${providerId} returned ${status}.`).slice(0, 300);
}

/**
 * Tool calls come back with small differences between routers: arguments as an
 * object rather than a JSON string, or a missing call id. Normalise those so the
 * turn loop only ever sees one shape.
 *
 * Everything else on the message is carried through untouched. Gemini's thinking
 * models attach an `extra_content.google.thought_signature` to each call and
 * reject the next request if it does not come back, so this must add and correct
 * fields rather than rebuild the object.
 */
function normaliseMessage(raw: CompletionChoice, index: number): AssistantMessage {
  const { tool_calls: rawCalls, content, ...rest } = (raw.message ?? {}) as JsonObject & { content?: string | null; tool_calls?: unknown };
  const calls: unknown[] = Array.isArray(rawCalls) ? rawCalls : [];
  const tool_calls = calls
    .map((entry, position) => {
      const call = entry as JsonObject & { id?: unknown; function?: JsonObject & { name?: unknown; arguments?: unknown } };
      const name = typeof call.function?.name === 'string' ? call.function.name : '';
      if (!name) return null;
      const args = call.function?.arguments;
      return {
        ...call,
        id: typeof call.id === 'string' && call.id ? call.id : `call-${index}-${position}`,
        type: 'function' as const,
        function: { ...call.function, name, arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) },
      };
    })
    .filter((call): call is AssistantToolCall => Boolean(call));

  return {
    ...rest,
    role: 'assistant',
    content: typeof content === 'string' ? content : null,
    ...(tool_calls.length ? { tool_calls } : {}),
  };
}

/**
 * The same request as `post`, but reading the answer as it is written.
 *
 * Eight tool rounds can pass before the operator sees a word; without this the
 * final answer then lands in one block after the longest silence of the turn.
 * `onDelta` is called with each fragment of visible text — tool-call fragments
 * are accumulated but not surfaced, because a half-built JSON argument is not
 * something to show anybody.
 *
 * Failure handling matches `post` deliberately: a stream that dies mid-answer
 * is a capacity problem like any other, and the chain should try the next
 * provider rather than hand the operator half a sentence.
 */
async function postStream(
  url: string,
  headers: HeadersInit,
  body: unknown,
  providerId: string,
  onDelta: (text: string) => void,
): Promise<AssistantMessage> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
      body: JSON.stringify({ ...(body as JsonObject), stream: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderCapacityError(error instanceof Error ? error.message : `${providerId} could not be reached.`, providerId);
  }

  if (!response.ok || !response.body) {
    // An error body is JSON even when we asked for a stream.
    const result = (await response.json().catch(() => ({}))) as CompletionBody;
    const message = errorMessage(result, response.status, providerId);
    if (response.status === 429 || response.status >= 500 || !response.body) throw new ProviderCapacityError(message, providerId);
    throw new Error(message);
  }

  const accumulator = new StreamAccumulator();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let sawAnything = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = readSseEvents(buffer);
      buffer = rest;
      for (const event of events) {
        let parsed: CompletionBody;
        try {
          parsed = JSON.parse(event) as CompletionBody;
        } catch {
          continue; // A malformed frame is not worth abandoning the answer for.
        }
        // A routed upstream failure arrives as an error frame mid-stream.
        if (parsed.error) throw new ProviderCapacityError(errorMessage(parsed, response.status, providerId), providerId);
        const choice = parsed.choices?.[0] as StreamChoice | undefined;
        if (!choice) continue;
        sawAnything = true;
        const text = accumulator.push(choice);
        if (text) onDelta(text);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (!sawAnything) throw new ProviderCapacityError(`${providerId} returned an empty stream.`, providerId);
  return accumulator.message();
}

async function post(url: string, headers: HeadersInit, body: unknown, providerId: string, attempt = 0): Promise<AssistantMessage> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // A timeout or a dead socket is exactly what a second provider might survive.
    throw new ProviderCapacityError(error instanceof Error ? error.message : `${providerId} could not be reached.`, providerId);
  }

  const result = (await response.json().catch(() => ({}))) as CompletionBody;
  if (!response.ok) {
    const message = errorMessage(result, response.status, providerId);
    // Free shared pools rate-limit in short bursts, so one 429 is worth sitting
    // out before giving up on this provider entirely.
    if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS * (attempt + 1)));
      return post(url, headers, body, providerId, attempt + 1);
    }
    // 429 is a quota or rate limit; 5xx is an overloaded or broken backend.
    // Both are worth retrying elsewhere. A 4xx we caused is not.
    if (response.status === 429 || response.status >= 500) throw new ProviderCapacityError(message, providerId);
    throw new Error(message);
  }

  const choice = result.choices?.[0];
  // A body with no choices but an error field is a routed upstream failure.
  if (!choice) throw new ProviderCapacityError(errorMessage(result, response.status, providerId), providerId);
  return normaliseMessage(choice, 0);
}

function geminiProvider(apiKey: string): ChatProvider {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return {
    id: 'gemini',
    model,
    label: model,
    complete(messages, tools, onDelta) {
      const request = {
        model,
        messages,
        tools: tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.parameters },
        })),
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 2_000,
      };
      const auth = { Authorization: `Bearer ${apiKey}` };
      return onDelta ? postStream(GEMINI_URL, auth, request, 'Gemini', onDelta) : post(GEMINI_URL, auth, request, 'Gemini');
    },
  };
}

function openRouterProvider(apiKey: string): ChatProvider {
  const model = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const backup = process.env.OPENROUTER_BACKUP_MODEL || DEFAULT_OPENROUTER_BACKUP;
  // OpenRouter's own routing: if the first model is rate-limited it tries the
  // next one in this list before returning an error to us.
  const models = [...new Set([model, backup])].filter(Boolean);

  return {
    id: 'openrouter',
    model,
    label: model.replace(/^google\//, '').replace(/:free$/, ''),
    complete(messages, tools, onDelta) {
      const auth = {
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter attributes free-tier traffic to the calling app.
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://duma.app',
        'X-Title': 'DUMA Agent',
      };
      const request = {
        model,
        ...(models.length > 1 ? { models } : {}),
        messages,
        tools: tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: relaxSchema(tool.parameters) },
        })),
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 2_000,
      };
      return onDelta
        ? postStream(OPENROUTER_URL, auth, request, 'OpenRouter', onDelta)
        : post(OPENROUTER_URL, auth, request, 'OpenRouter');
    },
  };
}

/**
 * Every configured provider, primary first.
 *
 * `preference` promotes one of them to primary for this turn (Settings →
 * General); the rest stay behind it as fallbacks. Empty when the agent has no
 * key at all.
 */
export function chatProviders(preference?: string | null): ChatProvider[] {
  const providers: ChatProvider[] = [];
  if (process.env.GEMINI_API_KEY) providers.push(geminiProvider(process.env.GEMINI_API_KEY));
  if (process.env.OPENROUTER_API_KEY) providers.push(openRouterProvider(process.env.OPENROUTER_API_KEY));
  return orderProviders(providers, preference);
}

/**
 * What the settings screen may know about the providers: their ids and the model
 * each one would use. No key, and nothing derived from one — a model name is
 * configuration, an API key is a secret.
 */
export function describeProviders(): AgentProviderInfo[] {
  return chatProviders().map(({ id, model }) => ({ id, name: AGENT_PROVIDER_NAMES[id] ?? id, model }));
}
