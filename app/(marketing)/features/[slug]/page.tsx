import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { FeaturePage } from '@/components/marketing/features/FeaturePage';

import { featureContent } from '@/lib/marketing/features';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { MODULES, modulePath } from '@/lib/marketing/site';

/**
 * A module gets a page once it has words (lib/marketing/features.ts) and is
 * published in lib/marketing/site.ts. Every other slug is a 404, so an
 * unpublished module can't be reached by guessing its URL.
 */
function livePage(slug: string) {
  const entry = MODULES.find((m) => m.slug === slug && m.published);
  const content = featureContent(slug);
  return entry && content ? { module: entry, content } : undefined;
}

export function generateStaticParams() {
  return MODULES.filter((m) => livePage(m.slug)).map((m) => ({ slug: m.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = livePage((await params).slug);
  if (!page) return {};
  return marketingMetadata({ title: page.content.metaTitle, description: page.content.description, path: modulePath(page.module.slug) });
}

export default async function FeatureRoute({ params }: { params: Promise<{ slug: string }> }) {
  const page = livePage((await params).slug);
  if (!page) notFound();
  return <FeaturePage module={page.module} content={page.content} />;
}
