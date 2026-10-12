import { completeText } from '@/lib/ai/agent-provider.server';
import { QUESTION_MAX, QUESTION_MIN, cleanAnswer, cleanFacts, reservationAssistMessages } from '@/lib/ai/reservation-assist';
import { consumeAgentBudget } from '@/lib/api/agent-state.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { getMyStaffProfile } from '@/lib/modules/identity/client';

// ---------------------------------------------------------------------------
// POST /api/reservations/assist — Ask DUMA in a booking's drawer: one quick
// question about that booking, answered from the facts the drawer sends (the
// agent has no reservations tools). Server-side because the provider keys are,
// and same-origin only. Gated on `reservations:read` — the facts are what the
// person can already see — and metered by the Ask DUMA budget. Nothing is saved.
// ---------------------------------------------------------------------------

const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return fail('Cross-origin requests are not allowed.', 403);
    } catch {
      return fail('The request origin was invalid.', 403);
    }
  }
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (!cookieHeader) return fail('Your session has expired. Sign in again.', 401);

  let body: { question?: unknown; facts?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail('The request body was not valid JSON.', 400);
  }
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (question.length < QUESTION_MIN) return fail('Ask a question first.', 400);
  if (question.length > QUESTION_MAX) return fail(`Keep the question under ${QUESTION_MAX} characters.`, 400);
  const facts = cleanFacts(body.facts);
  if (!facts) return fail('There is no booking to ask about.', 400);

  const profile = await getMyStaffProfile(cookieHeader).catch(() => null);
  if (!profile) return fail('Your session has expired. Sign in again.', 401);
  if (!hasCapability(profile, 'reservations:read')) return fail('You need access to reservations to ask about a booking.', 403);

  const budget = await consumeAgentBudget(cookieHeader);
  if (!budget.allowed) return fail('You’ve used today’s AI allowance. It resets tomorrow.', 429);

  try {
    const raw = await completeText(reservationAssistMessages(facts, question) as unknown as Array<Record<string, unknown>>, {
      maxTokens: 400,
      temperature: 0.3,
    });
    const answer = cleanAnswer(raw);
    if (!answer) return fail('The answer came back empty. Try again.', 502);
    return Response.json({ answer });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Ask DUMA is unavailable right now.', 502);
  }
}
