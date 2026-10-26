// Product analytics (PostHog) — the pure half, so the privacy rules are tested.
//
// DUMA handles customer and employee data, and the error reporters go out of
// their way to send none of it (instrumentation*.ts). Analytics keeps the same
// posture: who used which screen and tool, never what was on the screen.

/** Where the browser sends events. Rewritten to PostHog in next.config.ts. */
export const ANALYTICS_PATH = '/ingest';

/**
 * Guest surfaces — the QR order page, table booking and hosted forms — are used
 * by a business's customers, not by DUMA's operators, and nobody there has
 * agreed to be measured by us. Analytics never starts on them.
 */
const GUEST_PREFIXES = ['/order', '/book', '/f'];

export function isTrackedPath(pathname: string) {
  return !GUEST_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** PostHog's region hosts: ingestion `eu.i.posthog.com` → app `eu.posthog.com`. */
export function posthogUiHost(ingestHost: string) {
  return ingestHost.replace(/^https:\/\/(eu|us)\.i\.posthog\.com\/?$/, 'https://$1.posthog.com');
}

const URL_PROPERTIES = ['$current_url', '$initial_current_url', '$referrer', '$initial_referrer'] as const;

/**
 * A query string can hold a search term — a customer's name typed into a list
 * filter. Keep the path, which names the screen, and drop the rest.
 */
export function stripQuery(value: unknown) {
  if (typeof value !== 'string') return value;
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

export function scrubEventProperties<T extends Record<string, unknown>>(properties: T): T {
  const scrubbed: Record<string, unknown> = { ...properties };
  for (const key of URL_PROPERTIES) if (key in scrubbed) scrubbed[key] = stripQuery(scrubbed[key]);
  return scrubbed as T;
}

export interface AgentTurnSummary {
  tools: string[];
  outcome: string;
  provider?: string;
  model?: string;
  refused?: string;
  actionKind?: string;
  durationMs?: number;
  rounds?: number;
  page?: string;
  fellBack?: boolean;
}

/**
 * What an Ask DUMA turn tells analytics: which tools ran and how it went.
 * Deliberately not the question or the error text — both are free text that can
 * carry customer and employee details, and they already live in the API's own
 * turn log behind the workspace's permissions.
 */
export function agentTurnProperties(turn: AgentTurnSummary) {
  return {
    tools: turn.tools,
    tool_count: turn.tools.length,
    outcome: turn.outcome,
    provider: turn.provider,
    model: turn.model,
    refused: turn.refused,
    action_kind: turn.actionKind,
    duration_ms: turn.durationMs,
    rounds: turn.rounds,
    page: turn.page === undefined ? undefined : stripQuery(turn.page),
    fell_back: turn.fellBack,
  };
}
