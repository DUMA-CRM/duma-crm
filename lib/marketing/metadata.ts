import type { Metadata } from 'next';

import { SITE_NAME, absoluteUrl } from '@/lib/marketing/site';

/**
 * Metadata for one marketing page. Every page goes through this so none ships
 * without a canonical URL — the guard against `?utm_…` and trailing-slash
 * variants being indexed as separate pages — or with social cards that still
 * describe whatever page the root layout was written for.
 *
 * `title` is used as written: search titles are hand-tuned per page, so no
 * template appends to them.
 *
 * The share card is restated, not inherited: Next merges metadata shallowly,
 * so a page's `openGraph` drops the image app/opengraph-image.tsx would have
 * given it (measured — only pages without their own `openGraph` kept it). A
 * page with its own `opengraph-image.tsx` still gets that one: file-based
 * metadata in the page's segment outranks this object.
 */
const DEFAULT_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'DUMA — run your whole business from one workspace. Free to use.' };

export function marketingMetadata({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  /** For pages that are ways in rather than content, such as /welcome. */
  noindex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: 'website', locale: 'en_GB', images: [DEFAULT_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_IMAGE] },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}
