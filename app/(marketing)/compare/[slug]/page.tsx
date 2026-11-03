import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ComparePage, compareMetadata } from '@/components/marketing/compare/ComparePage';

import { COMPARISONS, comparisonFor } from '@/lib/marketing/compare';
import { PAGES } from '@/lib/marketing/site';

/**
 * /compare/<slug>: one page per Comparison in lib/marketing/compare/, once it
 * is published in lib/marketing/site.ts. Every other slug is a 404, so a
 * comparison still being written can't be reached by guessing its URL.
 */
function livePage(slug: string) {
  const content = comparisonFor(slug);
  return content && PAGES.some((page) => page.path === content.path && page.published) ? content : undefined;
}

export function generateStaticParams() {
  return COMPARISONS.filter((comparison) => livePage(comparison.slug)).map((comparison) => ({ slug: comparison.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const content = livePage((await params).slug);
  return content ? compareMetadata(content) : {};
}

export default async function CompareRoute({ params }: { params: Promise<{ slug: string }> }) {
  const content = livePage((await params).slug);
  if (!content) notFound();
  return <ComparePage content={content} />;
}
