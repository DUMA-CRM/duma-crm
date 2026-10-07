import 'server-only';

import type { AgentProviderInfo, ChatProvider } from './provider-chain.ts';
import { AGENT_PROVIDER_NAMES, orderProviders } from './provider-chain.ts';
import { completeChat } from './provider-http.ts';
import { relaxSchema } from './tool-schema.ts';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function provider(id: string, model: string, apiKey: string, signal?: AbortSignal): ChatProvider {
  const gemini = id === 'gemini';
  const label = id === 'nvidia' ? 'NVIDIA Nemotron' : (AGENT_PROVIDER_NAMES[id] ?? id);
  return {
    id,
    model,
    label,
    complete(messages, tools, onDelta) {
      return completeChat({
        url: gemini ? GEMINI_URL : OPENROUTER_URL,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(!gemini ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://duma.app', 'X-Title': 'DUMA Agent' } : {}),
        },
        provider: label,
        signal,
        onDelta,
        body: {
          model,
          messages,
          tools: tools.map((tool) => ({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: gemini ? tool.parameters : relaxSchema(tool.parameters),
            },
          })),
          tool_choice: 'auto',
          temperature: 0.1,
          max_tokens: id === 'nvidia' ? 8000 : 4000,
          ...(!gemini ? { provider: { require_parameters: true } } : {}),
        },
      });
    },
  };
}

/** Chosen primary → remaining primary → NVIDIA. The last resort is never promoted. */
export function chatProviders(preference?: string | null, signal?: AbortSignal): ChatProvider[] {
  const configured: ChatProvider[] = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  const routerKey = process.env.OPENROUTER_API_KEY;
  if (geminiKey) configured.push(provider('gemini', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', geminiKey, signal));
  if (routerKey) configured.push(provider('openrouter', process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free', routerKey, signal));
  const ordered = orderProviders(configured, preference);
  if (routerKey)
    ordered.push(provider('nvidia', process.env.OPENROUTER_NVIDIA_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free', routerKey, signal));
  return ordered;
}

export function describeProviders(): AgentProviderInfo[] {
  return chatProviders()
    .filter(({ id }) => id !== 'nvidia')
    .map(({ id, model, label }) => ({ id, model, name: label }));
}

/**
 * One plain completion — no tools, no streaming to the caller — over the same
 * configured providers, falling through to the next on failure. For short
 * writing help (Content's assist), not for the agent loop.
 */
export async function completeText(messages: Array<Record<string, unknown>>, options: { maxTokens?: number; temperature?: number; signal?: AbortSignal } = {}): Promise<string> {
  const candidates: Array<{ id: string; url: string; model: string; key: string }> = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  const routerKey = process.env.OPENROUTER_API_KEY;
  if (geminiKey) candidates.push({ id: 'gemini', url: GEMINI_URL, model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', key: geminiKey });
  if (routerKey) candidates.push({ id: 'openrouter', url: OPENROUTER_URL, model: process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free', key: routerKey });
  if (candidates.length === 0) throw new Error('No AI provider is configured.');
  let last: unknown;
  for (const candidate of candidates) {
    try {
      const reply = await completeChat({
        url: candidate.url,
        headers: {
          Authorization: `Bearer ${candidate.key}`,
          ...(candidate.id !== 'gemini' ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://duma.app', 'X-Title': 'DUMA Content' } : {}),
        },
        provider: AGENT_PROVIDER_NAMES[candidate.id] ?? candidate.id,
        signal: options.signal,
        body: { model: candidate.model, messages, temperature: options.temperature ?? 0.4, max_tokens: options.maxTokens ?? 600 },
      });
      const text = typeof reply.content === 'string' ? reply.content.trim() : '';
      if (text) return text;
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error('No answer from the AI provider.');
}
