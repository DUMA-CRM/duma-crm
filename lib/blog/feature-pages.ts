import { unstable_rethrow } from 'next/navigation';

import { FEATURE_TYPE_KEY } from '@/lib/blog/feature-model';
import { type BlogPost, toPost } from '@/lib/blog/posts';

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

/** One published feature page by its module slug; null when there is none, or when it can't be read. */
export async function getFeaturePage(slug: string): Promise<BlogPost | null> {
  try {
    const response = await request(`/${encodeURIComponent(slug)}?include=1`);
    if (!response.ok) return null;
    const json = (await response.json()) as { data?: unknown };
    return asFeature(json.data);
  } catch (error) {
    unstable_rethrow(error);
    console.error('[features] reading a feature page failed', error);
    return null;
  }
}

/** The slugs of every published feature page; empty when none can be read. */
export async function featurePageSlugs(): Promise<Set<string>> {
  try {
    const response = await request('?limit=100&fields=slug');
    if (!response.ok) return new Set();
    const json = (await response.json()) as { data?: unknown[] };
    const slugs = (json.data ?? []).map((entry) => {
      const e = (entry ?? {}) as { slug?: unknown; fields?: { slug?: unknown } };
      return e.fields?.slug ?? e.slug;
    });
    return new Set(slugs.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0));
  } catch (error) {
    unstable_rethrow(error);
    console.error('[features] listing feature pages failed', error);
    return new Set();
  }
}
