/**
 * Submits every URL in the live sitemap to IndexNow — run after a production
 * deploy by .github/workflows/indexnow.yml, or by hand:
 *
 *   INDEXNOW_KEY=… node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/indexnow.mts
 *
 * The whole sitemap, not a diff: the site is small, and which pages a commit
 * changed can't be read reliably from the files it touched. SITE_URL defaults
 * to production; the key must match the one the site serves at /indexnow.txt.
 */
import { isIndexNowKey, sitemapUrls, submitToIndexNow } from '../lib/utils/indexnow.ts';

const site = (process.env.SITE_URL ?? 'https://duma-business.com').replace(/\/+$/, '');
const key = process.env.INDEXNOW_KEY;

if (!isIndexNowKey(key)) {
  console.error('Set INDEXNOW_KEY to the key the site serves at /indexnow.txt (8–128 letters, digits or dashes).');
  process.exit(1);
}

const served = await fetch(`${site}/indexnow.txt`).then((r) => (r.ok ? r.text() : null));
if (served?.trim() !== key) {
  console.error(`${site}/indexnow.txt does not serve this key — set INDEXNOW_KEY in the site's environment and redeploy.`);
  process.exit(1);
}

const sitemap = await fetch(`${site}/sitemap.xml`);
if (!sitemap.ok) {
  console.error(`Could not read ${site}/sitemap.xml (${sitemap.status}).`);
  process.exit(1);
}
const urls = sitemapUrls(await sitemap.text());
const statuses = await submitToIndexNow(site, key, urls);

console.log(`Submitted ${urls.length} URLs to IndexNow: ${statuses.join(', ')}`);
if (statuses.some((status) => status !== 200 && status !== 202)) process.exit(1);
