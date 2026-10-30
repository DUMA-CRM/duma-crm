import { revalidateTag } from 'next/cache';

import { BLOG_TAG, BLOG_TYPE_KEY } from '@/lib/blog/model';
import { verifyCmsWebhook } from '@/lib/utils/blog';

/**
 * Optional signed webhook for existing integrations that use the blog cache tag.
 * The built-in blog now reads uncached, so Admin → Content requires no webhook.
 *
 * Set it up in that workspace: Content → Webhooks → https://duma-business.com/api/cms-webhook,
 * limited to the blog-post content type, and put its signing secret (whsec_…)
 * in DUMA_CMS_WEBHOOK_SECRET. Requests
 * whose signature or timestamp don't check out are refused.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const ok = verifyCmsWebhook(
    process.env.DUMA_CMS_WEBHOOK_SECRET ?? '',
    request.headers.get('x-duma-timestamp'),
    body,
    request.headers.get('x-duma-signature'),
  );
  if (!ok) return Response.json({ error: 'invalid_signature' }, { status: 401 });

  // duma-api lib/cms-publishing.ts sends { id, event, createdAt, data }, with entry events' type at data.entry.type.
  let event: { event?: string; data?: { entry?: { type?: string } } } = {};
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (event.event === 'ping') return Response.json({ ok: true });

  const type = event.data?.entry?.type;
  // An image can sit in any post, so asset changes refresh the blog too; other content types don't touch it.
  if (event.event === 'asset.changed' || !type || type === BLOG_TYPE_KEY) {
    revalidateTag(BLOG_TAG, 'max');
    return Response.json({ revalidated: true });
  }
  return Response.json({ revalidated: false });
}
