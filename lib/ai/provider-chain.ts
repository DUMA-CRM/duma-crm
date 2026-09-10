type JsonObject = Record<string, unknown>;

export interface ProviderTool {
  name: string;
  description: string;
  parameters: JsonObject;
}

export interface AssistantToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AssistantMessage extends JsonObject {
  role: 'assistant';
  content?: string | null;
  tool_calls?: AssistantToolCall[];
}

/** Every provider the agent knows how to talk to, in default preference order. */
export const AGENT_PROVIDER_IDS = ['gemini', 'openrouter'] as const;

export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

/**
 * Which model answers first: `auto` keeps the default order, an id promotes that
 * provider. Chosen per device in Settings → General.
 */
export type AgentProviderPreference = 'auto' | AgentProviderId;

/** The operator-facing name of each provider — the model id is too cryptic to choose by. */
export const AGENT_PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
};

/** What the settings screen and the chat picker may know about a provider. Never a key. */
export interface AgentProviderInfo {
  id: string;
  /** "Gemini", "OpenRouter" — what the setting is called. */
  name: string;
  /** The model that would actually answer, e.g. `gemini-3.5-flash-lite`. */
  model: string;
}

/** A provider's name whether or not the server has told us about it yet. */
export function providerName(id: string, providers?: AgentProviderInfo[]): string {
  return providers?.find((provider) => provider.id === id)?.name ?? AGENT_PROVIDER_NAMES[id] ?? id;
}

export function isAgentProviderPreference(value: unknown): value is AgentProviderPreference {
  return value === 'auto' || (typeof value === 'string' && (AGENT_PROVIDER_IDS as readonly string[]).includes(value));
}

/**
 * Promote the operator's chosen provider to primary, keeping the rest behind it.
 *
 * A preference is a preference, not a restriction: the others stay in the chain
 * as fallbacks, because an agent that stops answering when one free tier runs
 * out is the failure mode `providerChain` exists to avoid. An unknown or
 * unconfigured id changes nothing.
 */
export function orderProviders<T extends { id: string }>(providers: T[], preference?: string | null): T[] {
  if (!preference || preference === 'auto') return providers;
  const index = providers.findIndex((provider) => provider.id === preference);
  if (index <= 0) return providers;
  return [providers[index], ...providers.slice(0, index), ...providers.slice(index + 1)];
}

export interface ChatProvider {
  id: string;
  model: string;
  /** Shown to the operator when this provider answered instead of the primary. */
  label: string;
  complete(messages: unknown[], tools: ProviderTool[]): Promise<AssistantMessage>;
}

/**
 * A provider failure that a different provider might not have — a quota, a rate
 * limit, an overloaded backend, a timeout. Anything else (a malformed request,
 * a bad key) would fail identically everywhere and must not trigger a hand-off.
 */
export class ProviderCapacityError extends Error {
  // Written as a plain field, not a constructor parameter property: the test
  // runner strips types rather than compiling them.
  readonly provider: string;

  constructor(message: string, provider: string) {
    super(message);
    this.name = 'ProviderCapacityError';
    this.provider = provider;
  }
}

/**
 * Ask the current provider, stepping down the list when one is out of capacity.
 *
 * The conversation carries over untouched, so a hand-off part-way through a turn
 * keeps every tool result the previous model had already gathered — the backup
 * resumes the work rather than starting it again.
 */
export function providerChain(providers: ChatProvider[], tools: ProviderTool[]) {
  let current = 0;
  let switched: ChatProvider | undefined;

  return {
    /** The provider that answered, or would answer next. */
    get answering() {
      return providers[Math.min(current, providers.length - 1)];
    },
    /** Set once a backup took over, so the answer can say which model wrote it. */
    get fallback() {
      return switched;
    },
    async complete(messages: unknown[], onSwitch: (next: ChatProvider, reason: string) => void): Promise<AssistantMessage> {
      let lastError: unknown = new Error('No AI provider is configured.');
      while (current < providers.length) {
        try {
          return await providers[current].complete(messages, tools);
        } catch (error) {
          lastError = error;
          if (!(error instanceof ProviderCapacityError) || current === providers.length - 1) throw error;
          current += 1;
          switched = providers[current];
          onSwitch(providers[current], error.message);
        }
      }
      throw lastError instanceof Error ? lastError : new Error('No AI provider could answer.');
    },
  };
}
