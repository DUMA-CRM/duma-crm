import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CalendarDays, ChevronRight, Clock } from '@/components/icons';
import { Markdown } from '@/components/marketing/blog/Markdown';
import { CategoryLabel, PostCard, formatPostDate } from '@/components/marketing/blog/parts';
import { ReadingProgress, TableOfContents } from '@/components/marketing/blog/ReadingAids';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ClosingCta, Faq } from '@/components/marketing/sections';
import { SideSignUpCard } from '@/components/marketing/SideSignUpCard';
import { RisingLines } from '@/components/marketing/Strokes';

import { BLOG_AUTHOR } from '@/lib/blog/model';
import { type BlogPost, getPost, listPosts, relatedPosts } from '@/lib/blog/posts';
import { blogPostingSchema, breadcrumbSchema, faqSchema } from '@/lib/marketing/schema';
import { SITE_NAME, absoluteUrl } from '@/lib/marketing/site';
import { extractHeadings } from '@/lib/utils/blog';

/** The share image: the SEO block's, then the cover, then the post's generated card. */
function shareImage(post: BlogPost) {
  const image = post.seo.ogImage ?? post.cover;
  if (image) return { url: image.url, width: image.width ?? undefined, height: image.height ?? undefined, alt: image.altText ?? post.title };
  return { url: `/blog/${post.slug}/og`, width: 1200, height: 630, alt: post.title };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: 'Post not found | DUMA', robots: { index: false } };

  const title = post.seo.metaTitle ?? `${post.title} | ${SITE_NAME}`;
  const description = post.seo.metaDescription ?? post.excerpt;
  const canonical = post.seo.canonicalUrl ?? absoluteUrl(`/blog/${post.slug}`);
  const image = shareImage(post);
  const index = !post.seo.noIndex && !post.sample;

  return {
    title,
    description,
    alternates: { canonical, types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'DUMA blog' }] } },
    robots: { index, follow: !post.seo.noFollow, 'max-image-preview': 'large', 'max-snippet': -1 },
    authors: [{ name: BLOG_AUTHOR.name, url: absoluteUrl(BLOG_AUTHOR.path) }],
    category: post.category,
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: SITE_NAME,
      locale: 'en_GB',
      title: post.seo.socialTitle ?? post.seo.metaTitle ?? post.title,
      description: post.seo.socialDescription ?? description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      section: post.category,
      authors: [absoluteUrl(BLOG_AUTHOR.path)],
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seo.socialTitle ?? post.seo.metaTitle ?? post.title,
      description: post.seo.socialDescription ?? description,
      images: [image],
    },
  };
}

/**
 * /blog/[slug] — one post from DUMA's CMS, after seline.com's post: breadcrumb,
 * title, dates and reading time, cover, TL;DR, the body; beside it a live
 * table of contents and the sign-up card; under it the questions,
 * related posts and the closing card.
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const headings = extractHeadings(post.body);
  const { posts } = await listPosts();
  const related = relatedPosts(post, posts);
  const updated = post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10);

  return (
    <>
      <JsonLd data={blogPostingSchema(post)} />
      <JsonLd data={breadcrumbSchema([{ name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }])} />
      {post.faq.length > 0 && <JsonLd data={faqSchema(post.faq)} />}

      <div className="px-4 pt-10 pb-20 sm:px-6 sm:pt-14">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
          <article className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-[var(--mkt-ink-3)]">
              <Link href="/blog" className="hover:text-foreground">
                Blog
              </Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <span className="truncate text-[var(--mkt-ink-2)]" aria-current="page">
                {post.title}
              </span>
            </nav>

            <h1 className="mt-4 text-balance text-4xl leading-[1.12] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-[2.75rem]">{post.title}</h1>

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

          <aside className="hidden lg:block" aria-label="About this post">
            <div className="sticky top-24 flex flex-col gap-8">
              <TableOfContents headings={headings} />
              <SideSignUpCard body="Till, stock, rotas, customers and reports — on one bill." className="mt-2" />
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

      <ClosingCta
        title="The one place to run your business."
        muted="One simple bill, or none at all."
        body="Get started in minutes, completely free. No card required, and we’re here to help you every step of the way."
        aside={<RisingLines id="post-cta" />}
      />
      <ReadingProgress />
    </>
  );
}

