import { unstable_rethrow } from 'next/navigation';

import { FEATURE_TYPE_KEY } from '@/lib/blog/feature-model';
import { type BlogPost, toPost } from '@/lib/blog/posts';
import { FEATURE_PAGES, fallbackFeatureEntry } from '@/lib/marketing/features';

/**
 * Feature pages from DUMA Admin's internal workspace, read like blog posts and
 * shaped as one (BlogPost), so they render with the same article layout. A
 * failed or unconfigured read is "no CMS page": the route then falls back to
 * the page written in code (lib/marketing/features.ts), so a CMS outage never
 * takes a feature page down.
 */
const ORIGIN = (process.env.DUMA_CMS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://api.duma-business.com').replace(/\/+$/, '');

const request = (path: string) => fetch(`${ORIGIN}/v1/blog/entries/${FEATURE_TYPE_KEY}${path}`, { cache: 'no-store' });

/** An entry as a page: a post, labelled with the Features category rather than a blog one. */
const asFeature = (entry: unknown): BlogPost | null => {
  const post = toPost(entry);
  return post && { ...post, category: 'Features', categorySlug: 'features' };
};

/** Prefer a published CMS entry, then established copy; unknown slugs stay absent. */
export async function getFeaturePage(slug: string): Promise<BlogPost | null> {
  const fallback = () => asFeature(fallbackFeatureEntry(slug));
  try {
    const response = await request(`/${encodeURIComponent(slug)}?include=1`);
    if (!response.ok) return fallback();
    const json = (await response.json()) as { data?: unknown };
    return asFeature(json.data) ?? fallback();
  } catch (error) {
    unstable_rethrow(error);
    console.error('[features] reading a feature page failed', error);
    return fallback();
  }
}

/** CMS and established fallback slugs, shared by the feature index and sitemap. */
export async function featurePageSlugs(): Promise<Set<string>> {
  const published = new Set(FEATURE_PAGES.map((page) => page.slug));
  try {
    const response = await request('?limit=100&fields=slug');
    if (!response.ok) return published;
    const json = (await response.json()) as { data?: unknown[] };
    const slugs = (json.data ?? []).map((entry) => {
      const e = (entry ?? {}) as { slug?: unknown; fields?: { slug?: unknown } };
      return e.fields?.slug ?? e.slug;
    });
    for (const slug of slugs) if (typeof slug === 'string' && slug.length > 0) published.add(slug);
    return published;
  } catch (error) {
    unstable_rethrow(error);
    console.error('[features] listing feature pages failed', error);
    return published;
  }
}
