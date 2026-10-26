import 'server-only';

import { type AgentTurnSummary, agentTurnProperties } from '@/lib/utils/product-analytics';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/**
 * One event to PostHog from the server, over its plain capture endpoint — a
 * whole SDK for a handful of server events would be a dependency with nothing to
 * do. Like `recordAgentTurn`, it can never be the reason a request fails.
 */
async function captureServerEvent(distinctId: string, event: string, properties: Record<string, unknown>) {
  if (!KEY) return;
  try {
    await fetch(`${HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, event, distinct_id: distinctId, properties, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Intentionally silent.
  }
}

/** An Ask DUMA turn: which tools it ran, for whom, and how it ended. */
export function captureAgentTurn(profile: { userId: string; tenantId: string; role: string }, turn: AgentTurnSummary) {
  void captureServerEvent(profile.userId, 'agent_turn', {
    ...agentTurnProperties(turn),
    role: profile.role,
    tenant_id: profile.tenantId,
  });
}
