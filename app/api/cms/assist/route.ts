import { completeText } from '@/lib/ai/agent-provider.server';
import {
  ASSIST_TASKS,
  type AssistTask,
  assistMessages,
  cleanAssistText,
  modelMessages,
  parseModelReply,
  parseSeoSuggestion,
  parseTranslation,
} from '@/lib/ai/cms-assist';
import { consumeAgentBudget } from '@/lib/api/agent-state.service';
import { apiFetch } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import type { CmsAsset } from '@/lib/modules/cms/client';
import { getMyStaffProfile } from '@/lib/modules/identity/client';
import { normaliseModelDraft } from '@/lib/utils/cms-model-draft';
import { DESCRIPTION_IDEAL_MIN, SEO_SCHEMA_TYPES, SERP_TITLE_MAX, TITLE_MIN, fitDescription, fitTitle } from '@/lib/utils/cms-seo';

// ---------------------------------------------------------------------------
// POST /api/cms/assist — Content's writing help. Server-side because the
// provider keys are, and same-origin only. Gated on `cms:write` (only someone
// who could type the result may ask for it) and metered by the Ask DUMA
// budget. Returns a suggestion; nothing is saved.
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MODEL_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fail = (message: string, status: number) => Response.json({ error: message }, { status });

/** The smallest copy of the image a model can read well: a rendition when there is one. */
async function imageDataUrl(assetId: string, tenantId: string | undefined, cookieHeader: string): Promise<string> {
  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const asset = await apiFetch<CmsAsset>(`/cms/assets/${assetId}${query}`, { cookieHeader, timeoutMs: 15_000 });
  const rendition = asset.renditions.find((candidate) => candidate.width >= 480) ?? asset.renditions.at(-1);
  let blob: Blob;
  let type: string;
  if (rendition) {
    const response = await fetch(rendition.url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('The image could not be read.');
    blob = await response.blob();
    type = rendition.mimeType;
  } else {
    blob = await apiFetch<Blob>(`/cms/assets/${assetId}/file${query}`, { cookieHeader, asBlob: true, timeoutMs: 30_000 });
    type = asset.mimeType;
  }
  if (!MODEL_IMAGE_TYPES.has(type))
    throw new Error('Make sizes for this image first (or convert it to WebP) — the AI can’t read this format.');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('The image is too large to describe. Make its smaller sizes first.');
  return `data:${type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
}

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

  let body: {
    task?: string;
    assetId?: string;
    tenantId?: string;
    title?: string;
    text?: string;
    kind?: string;
    site?: string;
    prompt?: string;
    name?: string;
    existingFields?: Array<{ key?: unknown; label?: unknown; type?: unknown }>;
    models?: Array<{ key?: unknown; name?: unknown }>;
    fields?: Record<string, unknown>;
    from?: string;
    to?: string;
  };
  try {
    body = await request.json();
  } catch {
    return fail('The request body was not valid JSON.', 400);
  }
  if (!ASSIST_TASKS.includes(body.task as AssistTask)) return fail('Unknown task.', 400);
  const task = body.task as AssistTask;

  const profile = await getMyStaffProfile(cookieHeader).catch(() => null);
  if (!profile) return fail('Your session has expired. Sign in again.', 401);
  if (!hasCapability(profile, 'cms:write')) return fail('You need permission to edit content to use writing help.', 403);

  const budget = await consumeAgentBudget(cookieHeader);
  if (!budget.allowed) return fail('You’ve used today’s AI allowance. It resets tomorrow.', 429);

  try {
    if (task === 'translate') {
      const fields = Object.fromEntries(
        Object.entries(body.fields ?? {})
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
          .slice(0, 40),
      );
      if (Object.keys(fields).length === 0) return fail('There is no text to translate.', 400);
      if (!body.to) return fail('Choose a language to translate into.', 400);
      const raw = await completeText(assistMessages('translate', { fields, from: body.from, to: body.to }) as never, {
        maxTokens: 4000,
        temperature: 0.2,
      });
      const translated = parseTranslation(raw, Object.keys(fields));
      if (!translated) return fail('The translation came back unreadable. Try again.', 502);
      return Response.json({ fields: translated });
    }
    if (task === 'model') {
      // Shaping a model is a schema change: the same capability the API asks for to save one.
      if (!hasCapability(profile, 'cms.schema:write')) return fail('You need permission to edit content models.', 403);
      const prompt = (body.prompt ?? '').trim();
      if (prompt.length < 3) return fail('Say what the model is for — a sentence is enough.', 400);
      const existing = (body.existingFields ?? [])
        .filter((field) => typeof field.label === 'string' && typeof field.type === 'string')
        .slice(0, 60)
        .map((field) => ({ key: String(field.key ?? ''), label: String(field.label), type: String(field.type) }));
      const models = (body.models ?? [])
        .filter((model) => typeof model.key === 'string' && typeof model.name === 'string')
        .slice(0, 50)
        .map((model) => ({ key: String(model.key), name: String(model.name) }));
      const messages = modelMessages({ prompt, existingFields: existing, models, name: body.name }) as unknown as Array<
        Record<string, unknown>
      >;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const raw = await completeText(messages, { maxTokens: 2500, temperature: 0.3 });
        const draft = normaliseModelDraft(parseModelReply(raw), {
          existingKeys: existing.map((field) => field.key),
          referenceKeys: models.map((model) => model.key),
        });
        if (draft) return Response.json({ draft });
      }
      return fail('I couldn’t turn that into a model. Try describing it a little differently.', 502);
    }
    if (task === 'seo') {
      if (!body.text?.trim() && !body.title?.trim()) return fail('Write the entry first — there is nothing to describe.', 400);
      const input = { title: body.title, text: body.text, kind: body.kind, site: body.site };
      // One retry with the specific problems, then fit whatever came back to the limits.
      let messages = assistMessages('seo', input) as unknown as Array<Record<string, unknown>>;
      let best: ReturnType<typeof parseSeoSuggestion> = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const raw = await completeText(messages, { maxTokens: 400, temperature: 0.3 });
        const parsed = parseSeoSuggestion(raw, SEO_SCHEMA_TYPES);
        if (!parsed) continue;
        best = parsed;
        const problems = [
          parsed.metaTitle.length > SERP_TITLE_MAX && `metaTitle is ${parsed.metaTitle.length} characters; keep it to ${SERP_TITLE_MAX}`,
          parsed.metaTitle.length < TITLE_MIN && `metaTitle is only ${parsed.metaTitle.length} characters; make it at least ${TITLE_MIN}`,
          parsed.metaDescription.length > 155 && `metaDescription is ${parsed.metaDescription.length} characters; keep it to 155`,
          parsed.metaDescription.length < DESCRIPTION_IDEAL_MIN &&
            `metaDescription is only ${parsed.metaDescription.length} characters; make it at least ${DESCRIPTION_IDEAL_MIN}`,
        ].filter(Boolean);
        if (problems.length === 0) break;
        messages = [
          ...messages,
          { role: 'assistant', content: raw },
          { role: 'user', content: `Fix these and return the JSON again: ${problems.join('; ')}.` },
        ];
      }
      if (!best) return fail('The suggestion came back unreadable. Try again.', 502);
      return Response.json({
        seo: {
          ...best,
          metaTitle: fitTitle(best.metaTitle),
          metaDescription: fitDescription(best.metaDescription),
          socialTitle: fitTitle(best.socialTitle, 70),
          socialDescription: best.socialDescription ? fitDescription(best.socialDescription, 200) : '',
        },
      });
    }
    const input =
      task === 'alt-text'
        ? { imageDataUrl: await imageDataUrl(String(body.assetId ?? ''), body.tenantId, cookieHeader), title: body.title }
        : { title: body.title, text: body.text };
    if (task !== 'alt-text' && !input.text?.trim()) return fail('Write some text first — there is nothing to work from.', 400);
    const raw = await completeText(assistMessages(task, input) as never, { maxTokens: task === 'summary' ? 400 : 200 });
    return Response.json({ text: cleanAssistText(task, raw) });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Writing help is unavailable right now.', 502);
  }
}
