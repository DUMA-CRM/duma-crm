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
 * Crawl everything except the plumbing. App screens need no rule: without a
 * session they redirect to sign-in, and the guest pages (/order, /book, /f)
 * carry their own `noindex` — which a crawler can only read if it is allowed
 * to fetch them, so they are deliberately not disallowed here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
