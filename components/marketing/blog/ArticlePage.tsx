import Image from 'next/image';
import Link from 'next/link';

import { CalendarDays, ChevronRight, Clock } from '@/components/icons';
import { Markdown } from '@/components/marketing/blog/Markdown';
import { CategoryLabel, PostCard, formatPostDate } from '@/components/marketing/blog/parts';
import { ReadingProgress, TableOfContents } from '@/components/marketing/blog/ReadingAids';
import { ClosingCta, Faq } from '@/components/marketing/sections';
import { SideSignUpCard } from '@/components/marketing/SideSignUpCard';
import { RisingLines } from '@/components/marketing/Strokes';

import type { BlogPost } from '@/lib/blog/posts';
import { extractHeadings } from '@/lib/utils/blog';

/**
 * The reading layout for a CMS page, after seline.com's post: breadcrumb,
 * title, label, dates and reading time, cover, TL;DR, the body; beside it a
 * live table of contents and the sign-up card; under it the questions, related
 * pages and the closing card. Blog posts and feature pages both render through
 * it, so the two always read the same. Structured data stays with each route.
 */
export function ArticlePage({
  post,
  crumb,
  kind,
  related = [],
}: {
  post: BlogPost;
  /** The breadcrumb's first step: the index this page belongs to. */
  crumb: { label: string; href: string };
  /** What the page is, for labels and ids: "post", "feature". */
  kind: string;
  related?: readonly BlogPost[];
}) {
  const headings = extractHeadings(post.body);
  const updated = post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10);

  return (
    <>
      <div className="px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <article className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--mkt-ink-3)]">
              <Link href={crumb.href} className="hover:text-foreground">
                {crumb.label}
              </Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="truncate text-[var(--mkt-ink-2)]" aria-current="page">
                {post.title}
              </span>
            </nav>

            <h1 className="mt-4 text-balance text-4xl leading-[1.12] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-5xl">{post.title}</h1>

            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--mkt-ink-3)]">
              <CategoryLabel post={post} />
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden="true" />
                {updated ? 'Last updated ' : 'Published '}
                <time dateTime={updated ? post.updatedAt : post.publishedAt} className="font-medium text-[var(--mkt-ink-2)]">
                  {formatPostDate(updated ? post.updatedAt : post.publishedAt)}
                </time>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {post.readingMinutes} min read
              </span>
            </p>

            {post.cover && (
              <figure className="mt-8 overflow-hidden rounded-[12px] border border-[var(--mkt-line)]">
                <Image
                  src={post.cover.url}
                  alt={post.cover.altText ?? ''}
                  width={post.cover.width ?? 1600}
                  height={post.cover.height ?? 900}
                  sizes="(min-width: 1024px) 720px, 100vw"
                  preload
                  className="block h-auto w-full"
                />
              </figure>
            )}

            {post.tldr && (
              <section aria-labelledby="tldr" className="mt-8 rounded-[12px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-6 py-5">
                <h2 id="tldr" className="text-sm font-semibold tracking-[0.06em] text-foreground uppercase">
                  TL;DR
                </h2>
                <p className="mt-2 text-pretty text-[1.0625rem] leading-relaxed text-foreground">{post.tldr}</p>
              </section>
            )}

            <div id="post-body" className="mt-10">
              <Markdown source={post.body} />
            </div>

            {post.faq.length > 0 && (
              <section aria-labelledby="questions" className="mt-14">
                <h2 id="questions" className="scroll-mt-24 text-2xl font-semibold tracking-display text-[var(--mkt-heading)]">
                  Questions and answers
                </h2>
                <div className="mt-5">
                  <Faq items={post.faq} />
                </div>
              </section>
            )}

          </article>

          <aside className="hidden lg:block" aria-label={`About this ${kind}`}>
            <div className="sticky top-24 flex flex-col gap-8">
              <TableOfContents headings={headings} />
              <SideSignUpCard body="Till, stock, rotas, customers and reports — in one place." />
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="keep-reading" className="mx-auto mt-24 max-w-5xl">
            <h2 id="keep-reading" className="text-2xl font-semibold tracking-display text-[var(--mkt-heading)]">
              Keep reading
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {related.map((item) => (
                <PostCard key={item.slug} post={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ClosingCta title="Run your whole business from one place." aside={<RisingLines id={`${kind}-cta`} />} />
      <ReadingProgress />
    </>
  );
}
