import { completeText } from '@/lib/ai/agent-provider.server';
import { cleanPlainText, cleanPreheader, missingMergeTokens, plainTextMessages, preheaderMessages } from '@/lib/ai/email-assist';
import { consumeAgentBudget } from '@/lib/api/agent-state.service';
import { hasCapability } from '@/lib/auth/capabilities';
import { getMyStaffProfile } from '@/lib/modules/identity/client';

// ---------------------------------------------------------------------------
// POST /api/communications/assist — Ask DUMA for email templates: the
// plain-text version written from the HTML (`plain-text`), and the inbox
// preview line written from the subject and content (`preheader`). Server-side because the
// provider keys are, and same-origin only. Gated on `email:write` (only someone
// who could type the result may ask for it) and metered by the Ask DUMA
// budget. Returns a suggestion; nothing is saved.
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

  let body: { task?: string; html?: string; subject?: string };
  try {
    body = await request.json();
  } catch {
    return fail('The request body was not valid JSON.', 400);
  }
  if (body.task !== 'plain-text' && body.task !== 'preheader') return fail('Unknown task.', 400);
  const html = typeof body.html === 'string' ? body.html : '';
  if (!html.trim()) return fail('Write the email first — there is nothing to work from.', 400);

  const profile = await getMyStaffProfile(cookieHeader).catch(() => null);
  if (!profile) return fail('Your session has expired. Sign in again.', 401);
  if (!hasCapability(profile, 'email:write')) return fail('You need permission to edit email templates to use Ask DUMA here.', 403);

  const budget = await consumeAgentBudget(cookieHeader);
  if (!budget.allowed) return fail('You’ve used today’s AI allowance. It resets tomorrow.', 429);

  try {
    if (body.task === 'preheader') {
      const raw = await completeText(
        preheaderMessages({ html, subject: typeof body.subject === 'string' ? body.subject : undefined }) as unknown as Array<
          Record<string, unknown>
        >,
        { maxTokens: 120, temperature: 0.5 },
      );
      const text = cleanPreheader(raw);
      if (!text) return fail('The preview text came back empty. Try again.', 502);
      return Response.json({ text });
    }

    // One retry naming any merge field the first reply dropped, then take what came back.
    let messages = plainTextMessages(html) as unknown as Array<Record<string, unknown>>;
    let text = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await completeText(messages, { maxTokens: 3000, temperature: 0.1 });
      text = cleanPlainText(raw);
      const missing = missingMergeTokens(html, text);
      if (text && missing.length === 0) break;
      messages = [
        ...messages,
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: text
            ? `You left out ${missing.join(', ')}. Keep every merge field exactly where it appears and return the full plain text again.`
            : 'That was empty. Return the full plain text of the email.',
        },
      ];
    }
    if (!text) return fail('The plain text came back empty. Try again.', 502);
    return Response.json({ text });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Ask DUMA is unavailable right now.', 502);
  }
}
