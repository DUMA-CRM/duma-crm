import { unstable_rethrow } from 'next/navigation';

import { BLOG_CATEGORIES, BLOG_TYPE_KEY } from '@/lib/blog/model';
import { SAMPLE_POSTS } from '@/lib/blog/samples';
import { readingMinutes, slugify, wordCount } from '@/lib/utils/blog';

/** Published content from DUMA Admin's internal workspace. No API key is needed.
 * Reads bypass the Next cache so publishing and unpublishing take effect on the next visit.
 * Local design samples are opt-in with DUMA_BLOG_SAMPLES=true in development.
 */
const ORIGIN = (process.env.DUMA_CMS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://api.duma-business.com').replace(/\/+$/, '');

export type BlogMedia = { url: string; width: number | null; height: number | null; altText: string | null };

export type BlogSeo = {
  metaTitle?: string;
  metaDescription?: string;
  socialTitle?: string;
  socialDescription?: string;
  ogImage?: BlogMedia | null;
  canonicalUrl?: string;
  noIndex?: boolean;
  noFollow?: boolean;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  cover: BlogMedia | null;
  tldr: string | null;
  body: string;
  faq: { question: string; answer: string }[];
  seo: BlogSeo;
  /** First published — the article's date. */
  publishedAt: string;
  /** Last published change — "Last updated". */
  updatedAt: string;
  readingMinutes: number;
  wordCount: number;
  /** A sample shown on a local dev server only. */
  sample?: boolean;
};

export type BlogResult = { posts: BlogPost[]; error: boolean; configured: boolean };

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

function media(value: unknown): BlogMedia | null {
  const m = obj(value);
  const url = str(m.url);
  if (!url) return null;
  return {
    url,
    width: typeof m.width === 'number' ? m.width : null,
    height: typeof m.height === 'number' ? m.height : null,
    altText: str(m.altText) ?? null,
  };
}

/** An entry from the Content API, as a post. Anything unpublishable (no title, slug or body) is dropped. */
export function toPost(entry: unknown): BlogPost | null {
  const e = obj(entry);
  const f = obj(e.fields);
  const title = str(f.title);
  const slug = str(f.slug) ?? str(e.slug);
  const body = typeof f.body === 'string' ? f.body : '';
  if (!title || !slug || !body.trim()) return null;
  const known = BLOG_CATEGORIES.find((c) => c.label === f.category)?.label;
  const category = known ?? str(f.category) ?? 'Guides';
  const seo = obj(f.seo);
  const publishedAt = str(e.firstPublishedAt) ?? str(e.publishedAt) ?? str(e.createdAt) ?? new Date(0).toISOString();
  return {
    id: String(e.id ?? slug),
    slug,
    title,
    excerpt: str(f.excerpt) ?? '',
    category,
    categorySlug: slugify(category),
    cover: media(f.cover),
    tldr: str(f.tldr) ?? null,
    body,
    faq: (Array.isArray(f.faq) ? f.faq : [])
      .map(obj)
      .map((item) => ({ question: str(item.question) ?? '', answer: str(item.answer) ?? '' }))
      .filter((item) => item.question && item.answer),
    seo: {
      metaTitle: str(seo.metaTitle),
      metaDescription: str(seo.metaDescription),
      socialTitle: str(seo.socialTitle),
      socialDescription: str(seo.socialDescription),
      ogImage: media(seo.ogImage),
      canonicalUrl: str(seo.canonicalUrl),
      noIndex: seo.noIndex === true,
      noFollow: seo.noFollow === true,
    },
    publishedAt,
    updatedAt: str(e.publishedAt) ?? publishedAt,
    readingMinutes: readingMinutes(body),
    wordCount: wordCount(body),
  };
}

async function request(path: string): Promise<Response> {
  return fetch(`${ORIGIN}/v1/blog${path}`, {
    cache: 'no-store',
  });
}

const showSamples = () => process.env.NODE_ENV === 'development' && process.env.DUMA_BLOG_SAMPLES === 'true';

/** Every published post, newest first. API failures return `error: true`; framework control flow propagates. */
export async function listPosts(): Promise<BlogResult> {
  if (showSamples()) return { posts: SAMPLE_POSTS, error: false, configured: true };
  try {
    const posts: BlogPost[] = [];
    for (let page = 1; page <= 20; page++) {
      const response = await request(`/entries/${BLOG_TYPE_KEY}?sort=-publishedAt&limit=100&page=${page}&include=1`);
      if (response.status === 404) return { posts: [], error: false, configured: false };
      if (!response.ok) throw new Error(`Content API ${response.status}`);
      const json = obj(await response.json());
      for (const entry of Array.isArray(json.data) ? json.data : []) {
        const post = toPost(entry);
        if (post) posts.push(post);
      }
      const meta = obj(json.meta);
      if (typeof meta.pages !== 'number' || page >= meta.pages) break;
    }
    return { posts, error: false, configured: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error('[blog] listing posts failed', error);
    return { posts: [], error: true, configured: true };
  }
}

/** One published post by slug; null when there is none. Throws on a failed request, so the page errors rather than 404s. */
export async function getPost(slug: string): Promise<BlogPost | null> {
  if (showSamples()) return SAMPLE_POSTS.find((post) => post.slug === slug) ?? null;
  const response = await request(`/entries/${BLOG_TYPE_KEY}/${encodeURIComponent(slug)}?include=1`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Content API ${response.status}`);
  return toPost(obj(await response.json()).data);
}

/** Posts in the same category first, then the newest others — never the post itself. */
export function relatedPosts(post: BlogPost, all: readonly BlogPost[], count = 3): BlogPost[] {
  const others = all.filter((p) => p.slug !== post.slug);
  return [
    ...others.filter((p) => p.categorySlug === post.categorySlug),
    ...others.filter((p) => p.categorySlug !== post.categorySlug),
  ].slice(0, count);
}
