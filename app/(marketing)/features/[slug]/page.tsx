import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlePage } from '@/components/marketing/blog/ArticlePage';
import { JsonLd } from '@/components/marketing/JsonLd';

import { getFeaturePage } from '@/lib/blog/feature-pages';
import type { BlogPost } from '@/lib/blog/posts';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema } from '@/lib/marketing/schema';
import { MODULES, type MarketingModule, SITE_NAME, modulePath } from '@/lib/marketing/site';

/**
 * /features/[slug] — one part of DUMA, written in the internal workspace's CMS
 * (type feature-page) and rendered in the blog's article layout. A module has a
 * page exactly when its entry is published; the slug must also be a module's,
 * so an entry can't invent an address. Anything else is a 404.
 */
async function resolve(slug: string): Promise<{ entry: MarketingModule; page: BlogPost } | undefined> {
  const entry = MODULES.find((m) => m.slug === slug);
  if (!entry) return undefined;
  const page = await getFeaturePage(slug);
  return page ? { entry, page } : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const found = await resolve((await params).slug);
  if (!found) return {};
  const { page } = found;
  return {
    ...marketingMetadata({
      title: page.seo.metaTitle ?? `${page.title} | ${SITE_NAME}`,
      description: page.seo.metaDescription ?? page.excerpt,
      path: modulePath(found.entry.slug),
    }),
    robots: { index: !page.seo.noIndex, follow: !page.seo.noFollow },
  };
}

export default async function FeatureRoute({ params }: { params: Promise<{ slug: string }> }) {
  const found = await resolve((await params).slug);
  if (!found) notFound();
  const { entry, page } = found;
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Features', path: '/features' }, { name: entry.name, path: modulePath(entry.slug) }])} />
      {page.faq.length > 0 && <JsonLd data={faqSchema(page.faq)} />}
      <ArticlePage post={page} crumb={{ label: 'Features', href: '/features' }} kind="feature" />
    </>
  );
}
