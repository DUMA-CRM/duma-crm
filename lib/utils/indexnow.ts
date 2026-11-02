/**
 * IndexNow: tells Bing, Yandex, Seznam, Naver and Yep (and, through Bing,
 * DuckDuckGo, Ecosia and ChatGPT search) that pages changed, instead of
 * waiting for a crawl. Google does not take part — it reads the sitemap.
 *
 * Two callers: app/api/cms-webhook (a blog post published, unpublished or
 * deleted) and scripts/indexnow.mts (every sitemap URL after a production
 * deploy, from .github/workflows/indexnow.yml). The key is INDEXNOW_KEY;
 * app/indexnow.txt serves it at the site root, which is what lets it vouch
 * for every URL on the host.
 *
 * Dependency-free with a relative `.ts` import path, so the deploy script can
 * run it with plain Node and no install.
 */

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_KEY_PATH = '/indexnow.txt';
/** The protocol's limit per request. */
const BATCH = 10_000;

/** 8–128 characters of a–z, A–Z, 0–9 and dashes (indexnow.org/documentation). */
export const isIndexNowKey = (key: string | undefined): key is string => !!key && /^[a-zA-Z0-9-]{8,128}$/.test(key);

/** Every `<loc>` in a sitemap. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]!.replaceAll('&amp;', '&'));
}

/**
 * Submits URLs on `siteUrl`'s host; URLs on any other host are dropped, since
 * the key only vouches for its own. Returns each batch's HTTP status — 200 and
 * 202 are success, 403 means the key file could not be read.
 */
export async function submitToIndexNow(siteUrl: string, key: string, urls: readonly string[]): Promise<number[]> {
  const site = new URL(siteUrl);
  const own = [...new Set(urls)].filter((url) => new URL(url).host === site.host);
  const statuses: number[] = [];
  for (let i = 0; i < own.length; i += BATCH) {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: site.host, key, keyLocation: new URL(INDEXNOW_KEY_PATH, site).href, urlList: own.slice(i, i + BATCH) }),
    });
    statuses.push(response.status);
  }
  return statuses;
}
