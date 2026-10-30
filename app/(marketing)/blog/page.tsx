import type { Metadata } from 'next';

import { PostCard } from '@/components/marketing/blog/parts';
import { JsonLd } from '@/components/marketing/JsonLd';
import { SecondaryButton, SignUpButton } from '@/components/marketing/sections';
import { ChalkCurve } from '@/components/marketing/Strokes';

import { listPosts } from '@/lib/blog/posts';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { blogSchema, breadcrumbSchema } from '@/lib/marketing/schema';

/** For search results — fuller than the line on the page. */
const DESCRIPTION =
  'Practical guides on running a café, restaurant or small shop — margins, rotas, stock, pricing and selling online — from the team behind DUMA.';

/** The line under the heading, kept short after seline.com/blog. */
const SUBTITLE = 'Notes on building DUMA, and practical guides for running a small business.';

export const metadata: Metadata = {
  ...marketingMetadata({ title: 'Blog — Guides for Cafés, Restaurants and Small Shops | DUMA', description: DESCRIPTION, path: '/blog' }),
  alternates: { canonical: '/blog', types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'DUMA blog' }] } },
};

/**
 * /blog — every published post from DUMA's CMS, after seline.com/blog: a short
 * heading and a two-column grid of text cards (no authors, no images). Four states: posts, none yet, not set up, and
 * a failed read with a retry.
 */
export default async function BlogPage() {
  const { posts, error, configured } = await listPosts();

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Blog', path: '/blog' }])} />
      {posts.length > 0 && <JsonLd data={blogSchema(posts)} />}

      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="blog-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="blog-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />

        <section className="relative px-4 pt-32 pb-8 sm:px-6 sm:pt-40">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-5xl">Blog</h1>
            <p className="mt-4 text-pretty text-[var(--mkt-ink-2)]">{SUBTITLE}</p>
          </div>
        </section>

        <section className="relative px-4 pb-24 sm:px-6" aria-label="Posts">
          <div className="mx-auto max-w-5xl">
            {error ? (
              <div className="mkt-card mx-auto max-w-xl px-6 py-10 text-center">
                <p className="font-semibold">The posts couldn’t be loaded just now.</p>
                <p className="mt-2 text-sm text-[var(--mkt-ink-2)]">This is on our side, not yours. Try again in a moment.</p>
                <SecondaryButton href="/blog" className="mt-5">
                  Try again
                </SecondaryButton>
              </div>
            ) : posts.length === 0 ? (
              <div className="mkt-card mx-auto max-w-xl px-6 py-10 text-center">
                <p className="font-semibold">The first posts are on their way.</p>
                <p className="mt-2 text-sm text-[var(--mkt-ink-2)]">
                  {configured ? 'Guides on margins, rotas, stock and selling — coming soon.' : 'Guides on margins, rotas, stock and selling are coming soon.'}
                </p>
                <SignUpButton className="mt-5" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {posts.map((post) => (
                    <PostCard key={post.slug} post={post} />
                  ))}
                </div>
                <p className="mt-6 text-sm text-[var(--mkt-ink-3)]">
                  Showing {posts.length} post{posts.length === 1 ? '' : 's'} ·{' '}
                  <a href="/blog/feed.xml" className="hover:text-primary">
                    RSS feed
                  </a>
                </p>
              </>
            )}

          </div>
        </section>
      </div>
    </>
  );
}
