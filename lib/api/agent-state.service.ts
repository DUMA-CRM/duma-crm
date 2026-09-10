import { ApiError, apiFetch } from './client';

/**
 * The agent's server-side state, which lives in duma-api.
 *
 * Ask DUMA runs in this repository, but three things it needs cannot live in a
 * serverless UI process: a record of what was asked, a record of which
 * approvals have been spent, and a per-operator ceiling on what a turn may
 * cost. All three are in `duma-api/src/routes/agent.ts`, backed by the audit
 * log and the Redis the rate limiter already uses.
 *
 * Every call here takes the operator's own cookie, so the API applies the same
 * tenant scoping and capability rules it applies to everything else.
 */

export interface AgentBudget {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds when the allowance refills. */
  resetAt: number;
  /** True when no shared store was available, so the number is not enforced. */
  degraded: boolean;
}

/**
 * Take one unit of the operator's allowance before a turn runs.
 *
 * Fails **open**. The ceiling exists to stop one operator running up a bill, and
 * an outage in the counter is not a reason to take the assistant away from
 * everybody — the API's own per-route limiters still stand behind every tool
 * call the turn would make.
 */
export async function consumeAgentBudget(cookieHeader: string): Promise<AgentBudget> {
  try {
    return await apiFetch<AgentBudget>('/agent/budget/consume', { method: 'POST', cookieHeader, timeoutMs: 4_000 });
  } catch {
    return { allowed: true, limit: 0, remaining: 0, resetAt: 0, degraded: true };
  }
}

export class ApprovalAlreadyUsedError extends Error {}

/**
 * Spend one approval, once.
 *
 * Fails **closed**, unlike the budget: if we cannot establish that this
 * approval is unused, the write does not happen. A duplicated purchase order
 * or stock adjustment is a worse outcome than an approval the operator has to
 * confirm again.
 */
export async function claimAgentApproval(approvalId: string, cookieHeader: string): Promise<void> {
  try {
    await apiFetch<{ claimed: boolean }>('/agent/approvals/claim', {
      method: 'POST',
      cookieHeader,
      timeoutMs: 4_000,
      body: JSON.stringify({ approvalId }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new ApprovalAlreadyUsedError('This approval has already been used. Ask DUMA to prepare the action again.');
    }
    throw new ApprovalAlreadyUsedError('Could not confirm this approval is unused, so nothing was written. Try again.');
  }
}

export interface AgentTurnRecord {
  question: string;
  tools: string[];
  provider?: string;
  model?: string;
  refused?: 'scope' | 'security';
  actionKind?: string;
  outcome: 'answered' | 'refused' | 'failed' | 'stopped';
  durationMs?: number;
  rounds?: number;
  locationId?: string;
  page?: string;
  fellBack?: boolean;
  errorMessage?: string;
}

/**
 * Record what happened, without ever being the reason a turn fails.
 *
 * The operator already has their answer by the time this runs. Losing the
 * telemetry is a much smaller loss than turning a good answer into an error, so
 * every failure here is swallowed — deliberately, and this is the one place in
 * the agent where that is the right call.
 */
export async function recordAgentTurn(turn: AgentTurnRecord, cookieHeader: string): Promise<void> {
  try {
    await apiFetch('/agent/turns', {
      method: 'POST',
      cookieHeader,
      timeoutMs: 4_000,
      body: JSON.stringify(turn),
    });
  } catch {
    // Intentionally silent.
  }
}
