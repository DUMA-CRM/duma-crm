import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowUpRight, CalendarDays, ChevronRight, Clock } from '@/components/icons';
import { Markdown } from '@/components/marketing/blog/Markdown';
import { ReadingProgress, TableOfContents } from '@/components/marketing/blog/ReadingAids';
import { formatPostDate } from '@/components/marketing/blog/parts';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ClosingCta, Faq } from '@/components/marketing/sections';
import { SideSignUpCard } from '@/components/marketing/SideSignUpCard';
import { RisingLines } from '@/components/marketing/Strokes';

import { GLOSSARY, glossaryTerm } from '@/lib/marketing/glossary';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { publishedPage } from '@/lib/marketing/site';
import { breadcrumbSchema, faqSchema, glossaryTermSchema } from '@/lib/marketing/schema';
import { extractHeadings, readingMinutes } from '@/lib/utils/blog';

/** One page per term, all built ahead of time; any other slug is a 404. */
export function generateStaticParams() {
  return GLOSSARY.map((term) => ({ slug: term.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const term = glossaryTerm((await params).slug);
  if (!term) return {};
  return marketingMetadata({
    title: term.metaTitle ?? `${term.title} | DUMA`,
    description: term.short,
    path: `/glossary/${term.slug}`,
  });
}

/**
 * /glossary/[slug] — one term as a short article, laid out like a blog post:
 * breadcrumb, the question as the headline, the one-line definition as a TL;DR, the body, the
 * a "See it in DUMA" link to the audience page it belongs to, the questions,
 * related terms; the live table of contents and the sign-up card
 * beside it.
 */
export default async function GlossaryTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const term = glossaryTerm((await params).slug);
  if (!term) notFound();

  const headings = [...extractHeadings(term.body), { depth: 2 as const, text: 'Questions and answers', id: 'questions' }];
  const related = term.related.map(glossaryTerm).filter((item) => item !== undefined);
  // Only a published page is linked, so an unpublished one never becomes a 404.
  const seeIt = publishedPage(term.seeIt.path) ? term.seeIt : undefined;

  return (
    <>
      <JsonLd data={glossaryTermSchema(term)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Terms & definitions', path: '/glossary' },
          { name: term.term, path: `/glossary/${term.slug}` },
        ])}
      />
      <JsonLd data={faqSchema(term.faq)} />

      <div className="px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <article className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--mkt-ink-3)]">
              <Link href="/glossary" className="hover:text-foreground">
                Terms &amp; definitions
              </Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="truncate text-[var(--mkt-ink-2)]" aria-current="page">
                {term.term}
              </span>
            </nav>

            <h1 className="mt-4 text-balance text-4xl leading-[1.12] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-[2.75rem]">
              {term.title}
            </h1>

            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--mkt-ink-3)]">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                Last updated{' '}
                <time dateTime={term.updated} className="font-medium text-[var(--mkt-ink-2)]">
                  {formatPostDate(term.updated)}
                </time>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {readingMinutes(term.body)} min read
              </span>
            </p>

            <section aria-labelledby="tldr" className="mt-8 rounded-[12px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-6 py-5">
              <h2 id="tldr" className="text-sm font-semibold tracking-[0.06em] text-foreground uppercase">
                TL;DR
              </h2>
              <p className="mt-2 text-pretty text-[1.0625rem] leading-relaxed text-foreground">{term.short}</p>
            </section>

            <div id="post-body" className="mt-10">
              <Markdown source={term.body} />
            </div>

            {seeIt && (
              <p className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[12px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-6 py-4 text-[0.9375rem]">
                <span className="font-semibold text-foreground">See it in DUMA:</span>
                <Link href={seeIt.path} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  {seeIt.label}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </p>
            )}

            <section aria-labelledby="questions" className="mt-14">
              <h2 id="questions" className="scroll-mt-24 text-2xl font-semibold tracking-display text-[var(--mkt-heading)]">
                Questions and answers
              </h2>
              <div className="mt-5">
                <Faq items={term.faq} />
              </div>
            </section>
          </article>

          <aside className="hidden lg:block" aria-label="About this term">
            <div className="sticky top-24 flex flex-col gap-8">
              <TableOfContents headings={headings} />
              <SideSignUpCard body="Recipes costed, stock counted and the reports built from your sales." className="mt-2" />
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related" className="mx-auto mt-24 max-w-5xl">
            <h2 id="related" className="text-2xl font-semibold tracking-display text-[var(--mkt-heading)]">
              Related terms
            </h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/glossary/${item.slug}`}
                    className="mkt-card group flex h-full items-start gap-4 px-5 py-4 transition-colors hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[var(--mkt-heading)] group-hover:text-primary">{item.term}</span>
                      <span className="mt-1 block text-pretty text-sm leading-relaxed text-[var(--mkt-ink-2)]">{item.short}</span>
                    </span>
                    <ArrowUpRight className="mt-1 size-4 shrink-0 text-[var(--mkt-ink-3)] group-hover:text-primary" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ClosingCta
        title="Know your numbers without the spreadsheet."
        muted="Free to start."
        body="DUMA works these out from the sales, recipes and stock you already have — get started in minutes, no card required."
        aside={<RisingLines id={`glossary-${term.slug}-cta`} />}
      />
      <ReadingProgress />
    </>
  );
}
