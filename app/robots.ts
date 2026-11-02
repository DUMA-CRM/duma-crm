import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/marketing/site';

/** Plumbing no crawler needs: the API proxy, analytics and route handlers. */
const DISALLOW = ['/be/', '/ingest/', '/api/'];

/**
 * AI assistants and answer engines named outright, so the choice to let them
 * read and cite DUMA's pages is explicit rather than implied by `*` (GEO).
 * /llms.txt is their map of the site.
 */
const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'];

/**
 * Content Signals (contentsignals.org): what crawled pages may be used for.
 * All yes, matching the GEO stance above — GPTBot, Google-Extended and
 * Applebot-Extended are training crawlers and are already let in by name, and
 * `ai-input` is what lets an answer engine quote and cite a page.
 */
const CONTENT_SIGNAL = { 'Content-Signal': 'search=yes, ai-input=yes, ai-train=yes' };

/**
 * Crawl everything except the plumbing. App screens need no rule: without a
 * session they redirect to sign-in, and the guest pages (/order, /book, /f)
 * carry their own `noindex` — which a crawler can only read if it is allowed
 * to fetch them, so they are deliberately not disallowed here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW, other: CONTENT_SIGNAL },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW, other: CONTENT_SIGNAL },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
