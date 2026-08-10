import type { AgentActionSubmission, AgentChatMessage, AgentStreamEvent } from '@/lib/ai/agent-types';
import type { AgentContext } from '@/lib/ai/duma-agent.server';
import { executeConfirmedAction, runDumaAgent } from '@/lib/ai/duma-agent.server';
import type { StaffProfile } from '@/lib/api/staff.service';
import { getMyStaffProfile } from '@/lib/api/staff.service';

export const runtime = 'nodejs';

/** Turns kept from a long conversation. The agent trims again to what the model reads. */
const MAX_HISTORY = 40;
/** Above this the payload is malformed or hostile rather than merely chatty. */
const MAX_HISTORY_PAYLOAD = 500;

interface AgentRequestBody {
  messages?: AgentChatMessage[];
  context?: AgentContext;
  confirmedAction?: AgentActionSubmission;
}

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Ask DUMA could not complete that request.';
  return Response.json({ message }, { status });
}

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/role cannot/i.test(message)) return 403;
  if (/approval|expired|verified|confirm again|still empty/i.test(message)) return 400;
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
        write({ type: 'error', message: error instanceof Error ? error.message : 'Ask DUMA could not complete that request.' });
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
      return Response.json(await executeConfirmedAction(body.confirmedAction, body.context ?? {}, cookieHeader, profile));
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return errorResponse(new Error('Send at least one chat message.'), 400);
    }
    // A long conversation is normal use, not a bad request: keep the recent
    // window and answer. The agent trims again to what the model reads.
    if (body.messages.length > MAX_HISTORY_PAYLOAD) {
      return errorResponse(new Error('That conversation is too large to send. Clear the chat and ask again.'), 413);
    }

    return streamTurn(body.messages.slice(-MAX_HISTORY), body.context ?? {}, cookieHeader, profile);
  } catch (error) {
    return errorResponse(error, statusFor(error));
  }
}
