import { notFound } from 'next/navigation';

import { SupportArticlePage } from '@/components/support/SupportArticlePage';

import { getSupportArticle } from '@/lib/content/support-articles';

// Not statically generated: the CRM layout resolves the session per request.
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getSupportArticle(slug);

  if (!article) notFound();

  return <SupportArticlePage article={article} />;
}
