import type { AssistantMessage, AssistantToolCall } from './provider-chain.ts';

/**
 * Reassembling one assistant message from an OpenAI-style SSE stream.
 *
 * Kept pure and separate from the fetch so it can be tested without a network
 * or a provider. The whole difficulty is in three details, and each has cost
 * somebody a day somewhere:
 *
 * 1. **Tool-call arguments arrive as string fragments**, split at arbitrary
 *    points — often mid-token, sometimes mid-UTF-8-escape. They must be
 *    concatenated in order and parsed only at the end.
 * 2. **Deltas are addressed by `index`, not by id**, and the id may appear on
 *    any fragment (or, on some routers, only the first). Accumulating into an
 *    array by position is the only thing that works across providers.
 * 3. **Unknown fields must survive.** Gemini's thinking models attach an
 *    `extra_content.google.thought_signature` to each tool call and reject the
 *    *next* request if it does not come back. So fragments are merged into the
 *    accumulator rather than used to rebuild a known shape — the same rule
 *    `normaliseMessage` follows for the non-streaming path.
 */

type JsonObject = Record<string, unknown>;

interface ToolCallDelta {
  index?: number;
  id?: unknown;
  type?: unknown;
  function?: { name?: unknown; arguments?: unknown } & JsonObject;
  [key: string]: unknown;
}

export interface StreamChoiceDelta {
  delta?: { content?: unknown; tool_calls?: unknown } & JsonObject;
  finish_reason?: string | null;
}

/** Accumulates SSE chunks into the single message the turn loop expects. */
export class StreamAccumulator {
  private content = '';
  private readonly calls: Array<JsonObject & { function: JsonObject }> = [];
  private readonly rest: JsonObject = {};

  /** Feed one `choices[0]` object. Returns the text added by this chunk, if any. */
  push(choice: StreamChoiceDelta | undefined): string {
    const delta = choice?.delta;
    if (!delta) return '';

    const { content, tool_calls: toolCalls, role, ...extra } = delta;
    void role; // Present on the first chunk of every stream; the shape is fixed.
    // Carry provider-specific fields that ride on the message itself.
    for (const [key, value] of Object.entries(extra)) if (value !== undefined) this.rest[key] = value;

    let added = '';
    if (typeof content === 'string' && content) {
      this.content += content;
      added = content;
    }

    if (Array.isArray(toolCalls)) {
      for (const [position, entry] of toolCalls.entries()) {
        const fragment = entry as ToolCallDelta;
        // `index` is authoritative; fall back to array position for the routers
        // that omit it on a single-call stream.
        const index = typeof fragment.index === 'number' ? fragment.index : position;
        const target = (this.calls[index] ??= { function: {} });

        const { function: fn, index: fragmentIndex, ...top } = fragment;
        void fragmentIndex; // Already consumed above to address the accumulator.
        for (const [key, value] of Object.entries(top)) if (value !== undefined) target[key] = value;

        if (fn) {
          const { name, arguments: args, ...fnExtra } = fn;
          for (const [key, value] of Object.entries(fnExtra)) if (value !== undefined) target.function[key] = value;
          if (typeof name === 'string' && name) target.function.name = name;
          // The fragment case: append, never replace.
          if (typeof args === 'string') target.function.arguments = `${(target.function.arguments as string) ?? ''}${args}`;
          else if (args !== undefined && args !== null) target.function.arguments = JSON.stringify(args);
        }
      }
    }

    return added;
  }

  /** The finished message, in the shape the non-streaming path produces. */
  message(): AssistantMessage {
    const tool_calls = this.calls
      .map((call, index) => {
        const name = typeof call.function.name === 'string' ? call.function.name : '';
        if (!name) return null;
        return {
          ...call,
          id: typeof call.id === 'string' && call.id ? call.id : `call-0-${index}`,
          type: 'function' as const,
          function: { ...call.function, name, arguments: (call.function.arguments as string) ?? '{}' },
        };
      })
      .filter((call): call is AssistantToolCall => Boolean(call));

    return {
      ...this.rest,
      role: 'assistant',
      content: this.content || null,
      ...(tool_calls.length ? { tool_calls } : {}),
    };
  }
}

/**
 * Split a raw SSE body chunk into complete `data:` payloads.
 *
 * Returns the payloads plus whatever tail did not end in a blank line, which
 * the caller feeds back in next time. A chunk boundary lands mid-event often
 * enough that treating each chunk as whole produces JSON parse errors under
 * exactly the load that makes them hardest to reproduce.
 */
export function readSseEvents(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: string[] = [];
  for (const part of parts) {
    for (const line of part.split('\n')) {
      const trimmed = line.trimStart();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload && payload !== '[DONE]') events.push(payload);
    }
  }
  return { events, rest };
}
