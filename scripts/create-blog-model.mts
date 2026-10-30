/**
 * Creates the "Blog post" content type (lib/blog/model.ts) in the DUMA
 * workspace that owns the marketing blog, through the Content Management API.
 * Run once:
 *
 *   DUMA_CMS_SECRET_KEY=dk_sec_… node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/create-blog-model.mts
 *
 * The key needs the `content:models` scope (Settings → Developers). Point
 * DUMA_CMS_API_URL at another API (e.g. http://localhost:7777) to try it
 * locally first. A 409 means the type already exists — nothing is changed.
 */
import { BLOG_MODEL } from '../lib/blog/model.ts';

const origin = (process.env.DUMA_CMS_API_URL ?? 'https://api.duma-business.com').replace(/\/+$/, '');
const key = process.env.DUMA_CMS_SECRET_KEY;

if (!key?.startsWith('dk_sec_')) {
  console.error('Set DUMA_CMS_SECRET_KEY to a secret workspace key (dk_sec_…) with the content:models scope.');
  process.exit(1);
}

const response = await fetch(`${origin}/v1/cms/manage/content-types`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(BLOG_MODEL),
});
const body = await response.json().catch(() => null);

if (response.status === 409) {
  console.log(`The "${BLOG_MODEL.key}" content type already exists in this workspace — left as it is.`);
} else if (!response.ok) {
  console.error(`Failed (${response.status}):`, JSON.stringify(body, null, 2));
  process.exit(1);
} else {
  console.log(`Created the "${BLOG_MODEL.name}" content type (${BLOG_MODEL.key}) with ${BLOG_MODEL.fields.length} fields.`);
  console.log('For the DUMA website, this model must belong to the internal workspace. Admin → Content can set it up without an API key.');
}
