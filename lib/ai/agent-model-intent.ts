import {
  type AgentProviderId,
  type AgentProviderInfo,
  type AgentProviderPreference,
  providerName,
} from './provider-chain.ts';

/**
 * Asking Ask DUMA about its own model, answered without asking a model.
 *
 * This is the same reflex as `agent-scope.ts`: decide deterministically, before
 * any provider is called. Two reasons it must be a rule rather than a tool.
 * A model that has run out of quota cannot tell you it has run out of quota —
 * "which models can you use?" is exactly the question you ask when the agent is
 * struggling. And the answer is a *setting change* in this browser's
 * localStorage, which no server-side tool can make.
 */

export type ModelIntent = { kind: 'list' } | { kind: 'switch'; target: AgentProviderPreference };

/** Names an operator would actually type for each provider. */
const PROVIDER_ALIASES: Array<readonly [AgentProviderId, RegExp]> = [
  ['gemini', /\bgemini\b/i],
  ['openrouter', /\bopen\s?router\b/i],
];

const BARE_PROVIDER = /^[^a-z0-9]*(?:gemini|open\s?router)[^a-z0-9]*$/i;

const AUTO = /\b(?:auto|automatic|automatically|default|whichever|you\s+(?:decide|choose|pick))\b/i;

const SWITCH_VERB = /\b(?:switch|change|swap|use|using|set|pick|choose|go|move)\b/i;

/**
 * "Away from Gemini", not "to Gemini".
 *
 * Without this, "stop using Gemini" reads as a switch verb next to a provider
 * name and would confidently switch *to* the one being complained about.
 */
const AWAY_FROM = /\b(?:stop|don'?t|do not|never|instead of|rather than|away from|other than|not)\b[^.?!]{0,24}\b(?:gemini|open\s?router)\b/i;

/**
 * Phrases that are unambiguously about the AI model.
 *
 * "model" alone is not enough — a coffee business has pricing models and
 * machine models, and `change the price model for wholesale` must reach the
 * agent, not the picker. Every pattern here either pairs the word with an AI
 * qualifier or puts a verb directly against it.
 */
const MODEL_TOPIC: RegExp[] = [
  // "what model" alone is not one of these: `what model is the espresso machine`
  // is a perfectly ordinary question about a coffee grinder.
  /\b(?:which|what)\s+(?:ai|llm)\s+models?\b/i,
  /\b(?:which|what)\s+models?\s+(?:are|do|can)\s+(?:you|we|i)\b/i,
  /\b(?:which|what)\s+models?\s+(?:is\s+)?(?:this|available|running)\b/i,
  /\bmodel\s+(?:can\s+)?(?:choose|decide|pick|select)\b/i,
  /\b(?:which|what)\s+ai\b/i,
  /\b(?:switch|change|swap|set|use|pick|choose)\s+(?:the\s+|my\s+|your\s+|a\s+|an\s+)?(?:ai\s+|llm\s+)?models?\b/i,
  /\b(?:switch|change|swap|set)\s+(?:the\s+|my\s+|your\s+)?(?:ai|llm)\b/i,
  /\bmodels?\s+(?:are\s+|is\s+)?available\b/i,
  /\bavailable\s+(?:ai\s+)?models?\b/i,
  /\blist\s+(?:the\s+|your\s+)?(?:ai\s+)?models?\b/i,
  /\bmodel\s+(?:picker|switcher)\b/i,
  /\b(?:ai|language)\s+model\b/i,
  /\bllm\b/i,
];

/** What the operator asked about the model, or `null` to let the agent answer. */
export function detectModelIntent(text: string): ModelIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const named = PROVIDER_ALIASES.find(([, pattern]) => pattern.test(trimmed))?.[0];
  const topic = MODEL_TOPIC.some((pattern) => pattern.test(trimmed));
  if (!named && !topic) return null;

  // "auto" is only a model word in a sentence already about models — on its own
  // it is far more likely to be about an automatic anything else.
  if (topic && AUTO.test(trimmed)) return { kind: 'switch', target: 'auto' };
  if (named && !AWAY_FROM.test(trimmed) && (BARE_PROVIDER.test(trimmed) || SWITCH_VERB.test(trimmed))) {
    return { kind: 'switch', target: named };
  }
  return { kind: 'list' };
}

export interface ModelIntentReply {
  /** The preference to store, when the operator named one this server can use. */
  apply?: AgentProviderPreference;
  /** What the assistant says back. Markdown — the panel renders it like any answer. */
  message: string;
}

const FALLBACK_NOTE = 'I’ll still fall back to the others if the one you pick is at its limit.';

/** "Gemini or OpenRouter" — a spoken list, not a comma-joined array. */
function spokenNames(providers: AgentProviderInfo[]): string {
  const names = providers.map((provider) => `**${provider.name}**`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** How the current setting reads in a sentence. */
export function describePreference(current: AgentProviderPreference, providers?: AgentProviderInfo[]): string {
  if (current !== 'auto') return providerName(current, providers);
  const primary = providers?.[0];
  return primary ? `Automatic (${primary.name} first)` : 'Automatic';
}

/** The compact label for the switcher in the composer footer. */
export function modelChipLabel(current: AgentProviderPreference, providers?: AgentProviderInfo[]): string {
  if (current !== 'auto') return providerName(current, providers);
  const primary = providers?.[0];
  return primary ? `Auto · ${primary.name}` : 'Auto';
}

/**
 * The reply, and the preference to store with it.
 *
 * `providers` is undefined while the list has not arrived (or failed to). A
 * switch is still applied then — the preference is inert for a provider the
 * server does not have, and the picker rendered underneath shows the truth as
 * soon as it loads. What is *never* done is claim a switch we know is wrong:
 * once the list is known, an unconfigured provider is refused in words.
 */
export function answerModelIntent(
  intent: ModelIntent,
  providers: AgentProviderInfo[] | undefined,
  current: AgentProviderPreference,
): ModelIntentReply {
  const known = providers !== undefined;
  const primary = providers?.[0];

  if (intent.kind === 'switch' && intent.target === 'auto') {
    return {
      apply: 'auto',
      message: primary
        ? `Back to choosing automatically — I’ll start with **${primary.name}**.`
        : 'Back to choosing automatically.',
    };
  }

  if (intent.kind === 'switch') {
    const match = providers?.find((provider) => provider.id === intent.target);
    if (known && !match) {
      const name = providerName(intent.target, providers);
      return {
        message: providers.length
          ? `**${name}** isn’t configured on this server, so I can’t switch to it. I can use ${spokenNames(providers)}.`
          : `**${name}** isn’t configured on this server, and neither is anything else — I can’t answer until an administrator adds a model key.`,
      };
    }
    const name = match?.name ?? providerName(intent.target, providers);
    const model = match ? ` (\`${match.model}\`)` : '';
    return {
      apply: intent.target,
      message: `Switched to **${name}**${model}. I’ll start there from your next question, and still fall back to the others if it’s at its limit.`,
    };
  }

  if (!known) return { message: 'Let me check which models this server can use.' };
  if (providers.length === 0) {
    return {
      message:
        'No AI model is configured on this server, so I can’t answer questions yet. An administrator needs to add a model key and restart the app.',
    };
  }

  return {
    message: `I can answer with ${spokenNames(providers)}. Right now I’m set to **${describePreference(current, providers)}**.\n\nPick one below — ${FALLBACK_NOTE}`,
  };
}
