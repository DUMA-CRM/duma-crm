import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

import { BLOG_TAG, BLOG_TYPE_KEY } from '@/lib/blog/model';
import { listPosts } from '@/lib/blog/posts';
import { SITE_URL, absoluteUrl } from '@/lib/marketing/site';
import { verifyCmsWebhook } from '@/lib/utils/blog';
import { isIndexNowKey, submitToIndexNow } from '@/lib/utils/indexnow';

/** Entry events that change what a post's URL shows — and so are worth a recrawl. */
const RECRAWL_EVENTS = new Set(['entry.published', 'entry.unpublished', 'entry.deleted']);

/**
 * Asks IndexNow engines to recrawl a post and the blog index (lib/utils/indexnow.ts).
 * The post's URL comes from its slug field when it is still published, falling back
 * to the entry's own slug — an unpublished or deleted post is no longer listed, and
 * its old URL is exactly the one to recrawl.
 */
async function recrawlPost(entry: { id?: string; slug?: string }) {
  const key = process.env.INDEXNOW_KEY;
  if (!isIndexNowKey(key)) return;
  const { posts } = await listPosts();
  const slug = posts.find((post) => post.id === entry.id)?.slug ?? entry.slug;
  const urls = [absoluteUrl('/blog'), ...(slug ? [absoluteUrl(`/blog/${slug}`)] : [])];
  const statuses = await submitToIndexNow(SITE_URL, key, urls).catch(() => [0]);
  if (statuses.some((status) => status !== 200 && status !== 202)) console.warn('IndexNow submission failed', { urls, statuses });
}

/**
 * Optional signed webhook for existing integrations that use the blog cache tag.
 * The built-in blog now reads uncached, so Admin → Content requires no webhook.
 *
 * Set it up in that workspace: Settings → Developers → Webhooks → https://duma-business.com/api/cms-webhook,
 * sending the three Entry events (other content types are ignored here), and put its signing secret (whsec_…)
 * in DUMA_CMS_WEBHOOK_SECRET. Requests
 * whose signature or timestamp don't check out are refused.
 *
 * It is also how a new post reaches search engines quickly: a blog entry
 * published, unpublished or deleted is sent to IndexNow once the response is out.
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
  let event: { event?: string; data?: { entry?: { id?: string; type?: string; slug?: string } } } = {};
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
    const entry = event.data?.entry;
    if (type === BLOG_TYPE_KEY && entry && RECRAWL_EVENTS.has(event.event ?? '')) after(() => recrawlPost(entry));
    return Response.json({ revalidated: true });
  }
  return Response.json({ revalidated: false });
}
