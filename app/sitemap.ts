import type { MetadataRoute } from 'next';

import { listPosts } from '@/lib/blog/posts';
import { docEndpoints } from '@/lib/marketing/developers';
import { MODULES, PAGES, absoluteUrl, modulePath } from '@/lib/marketing/site';

/**
 * Every published marketing page, read from lib/marketing/site.ts — the same
 * registry the nav uses, so the sitemap cannot list a page nobody links to or
 * miss one they do — plus every blog post and API reference page.
 *
 * Only blog posts carry `lastModified`: their date is the post's real last
 * publish. A date that changed on every build would teach Google to ignore
 * it. Blog category archives are left out on purpose (they are noindex), as
 * are noindexed posts. If the CMS can't be read, the rest still ships.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts } = await listPosts();

  return [
    ...PAGES.filter((p) => p.published).map((p) => ({
      url: absoluteUrl(p.path),
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...MODULES.filter((m) => m.published).map((m) => ({
      url: absoluteUrl(modulePath(m.slug)),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...posts
      .filter((post) => !post.sample && !post.seo.noIndex && !post.seo.canonicalUrl)
      .map((post) => ({
        url: absoluteUrl(`/blog/${post.slug}`),
        lastModified: post.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        ...(post.cover && { images: [post.cover.url] }),
      })),
    ...docEndpoints().map((endpoint) => ({
      url: absoluteUrl(`/developers/${endpoint.slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ];
}
