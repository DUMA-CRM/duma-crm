import { ApprovalError } from '@/lib/ai/action-seal';
import { consumeAgentBudget, recordAgentTurn } from '@/lib/api/agent-state.service';
import type { AgentActionSubmission, AgentChatMessage, AgentStreamEvent } from '@/lib/ai/agent-types';
import type { AgentContext } from '@/lib/ai/duma-agent.server';
import { CapabilityError, executeConfirmedAction, runDumaAgent } from '@/lib/ai/duma-agent.server';
import { isAgentProviderPreference } from '@/lib/ai/provider-chain';
import type { StaffProfile } from '@/lib/api/staff.service';
import { getMyStaffProfile } from '@/lib/api/staff.service';

export const runtime = 'nodejs';

/** Turns kept from a long conversation. The agent trims again to what the model reads. */
const MAX_HISTORY = 40;
/** Above this the payload is malformed or hostile rather than merely chatty. */
const MAX_HISTORY_PAYLOAD = 500;
const APP_PAGES = new Set([
  'audit-log',
  'cash-up',
  'communications',
  'compliance',
  'customers',
  'dashboard',
  'inventory',
  'kds',
  'menu',
  'my-hr',
  'orders',
  'pos',
  'reports',
  'scheduling',
  'settings',
  'staff',
  'support',
]);

interface AgentRequestBody {
  messages?: AgentChatMessage[];
  context?: AgentContext;
  confirmedAction?: AgentActionSubmission;
}

function safeContext(context: AgentContext | undefined): AgentContext {
  if (!context) return {};
  return {
    locationId: typeof context.locationId === 'string' ? context.locationId.slice(0, 100) : null,
    tenantId: typeof context.tenantId === 'string' ? context.tenantId.slice(0, 100) : null,
    page: typeof context.page === 'string' && APP_PAGES.has(context.page) ? context.page : undefined,
    // A model preference set on the client, so it is allow-listed like `page`:
    // anything else falls back to the server's own order.
    provider: isAgentProviderPreference(context.provider) ? context.provider : undefined,
  };
}

/**
 * A refusal by a security rule, as opposed to something going wrong.
 *
 * Both of these mean the operator may not do this, or that we cannot prove they
 * asked for it: a capability they do not hold, and an approval that would not
 * verify. Recognised by type rather than by matching the message, so rewording the
 * copy cannot silently turn a refusal back into a generic failure.
 */
function isSecurityRefusal(error: unknown) {
  return error instanceof CapabilityError || error instanceof ApprovalError;
}

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Ask DUMA could not complete that request.';
  return Response.json({ message, ...(isSecurityRefusal(error) ? { refused: 'security' } : {}) }, { status });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (error instanceof CapabilityError || /role cannot/i.test(message)) return 403;
  if (error instanceof ApprovalError || /approval|expired|verified|confirm again|still empty/i.test(message)) return 400;
  if (/not configured/i.test(message)) return 503;
  return 500;
}

/**
 * Progress arrives as NDJSON frames: the panel can name the tool it is running
 * instead of guessing from the prompt. Once the first frame is written the
 * status code is fixed, so failures after that point stream an error frame.
 */
function streamTurn(messages: AgentChatMessage[], context: AgentContext, cookieHeader: string, profile: StaffProfile) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: AgentStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of runDumaAgent(messages, context, cookieHeader, profile)) write(event);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ask DUMA could not complete that request.';
        write({ type: 'error', message });
        // A turn that throws never reaches the agent's own recording, and a
        // failure is precisely the turn worth having in the log.
        void recordAgentTurn(
          {
            question: messages.at(-1)?.content ?? '',
            tools: [],
            outcome: 'failed',
            errorMessage: message,
            page: context.page,
          },
          cookieHeader,
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return errorResponse(new Error('Cross-origin agent requests are not allowed.'), 403);
    } catch {
      return errorResponse(new Error('The request origin was invalid.'), 403);
    }
  }

  const cookieHeader = request.headers.get('cookie') ?? '';
  if (!cookieHeader) return errorResponse(new Error('Your session has expired. Sign in again.'), 401);

  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    return errorResponse(new Error('The request body was not valid JSON.'), 400);
  }

  try {
    const profile = await getMyStaffProfile(cookieHeader);
    if (!profile) return errorResponse(new Error('Your session has expired. Sign in again.'), 401);

    if (body.confirmedAction) {
      if (typeof body.confirmedAction.approvalToken !== 'string')
        return errorResponse(new Error('This approval is missing its token.'), 400);
      return Response.json(await executeConfirmedAction(body.confirmedAction, safeContext(body.context), cookieHeader, profile));
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse(new Error('Send at least one chat message.'), 400);
    }
    // A long conversation is normal use, not a bad request: keep the recent
    // window and answer. The agent trims again to what the model reads.
    if (body.messages.length > MAX_HISTORY_PAYLOAD) {
      return errorResponse(new Error('That conversation is too large to send. Clear the chat and ask again.'), 413);
    }

    // Before a provider is paid: one question is up to eight model calls and
    // dozens of API calls, and nothing else caps what one operator can spend.
    // The check fails open — see `consumeAgentBudget`.
    const budget = await consumeAgentBudget(cookieHeader);
    if (!budget.allowed) {
      const minutes = Math.max(1, Math.ceil((budget.resetAt * 1000 - Date.now()) / 60_000));
      return Response.json(
        {
          message: `You have reached the Ask DUMA limit of ${budget.limit} questions an hour. It resets in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        },
        { status: 429, headers: { 'Retry-After': String(minutes * 60) } },
      );
    }

    return streamTurn(body.messages.slice(-MAX_HISTORY), safeContext(body.context), cookieHeader, profile);
  } catch (error) {
    return errorResponse(error, statusFor(error));
  }
}
