import type { Metadata } from 'next';

import { PostCard } from '@/components/marketing/blog/parts';
import { IndexHero } from '@/components/marketing/IndexCard';
import { JsonLd } from '@/components/marketing/JsonLd';
import { SecondaryButton, SignUpButton } from '@/components/marketing/sections';

import { listPosts } from '@/lib/blog/posts';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { blogSchema, breadcrumbSchema } from '@/lib/marketing/schema';

/** For search results — fuller than the line on the page. */
const DESCRIPTION =
  'Practical guides on running a café, restaurant or small shop — margins, rotas, stock, pricing and selling online — from the team behind DUMA.';

/** The line under the heading, kept short after seline.com/blog. */
const SUBTITLE = 'Notes on building DUMA, and practical guides for running a small business.';

export const metadata: Metadata = {
  ...marketingMetadata({ title: 'Blog — guides for cafés, restaurants and small shops | DUMA', description: DESCRIPTION, path: '/blog' }),
  alternates: { canonical: '/blog', types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'DUMA blog' }] } },
};

/**
 * /blog — every published post from DUMA's CMS, after seline.com/blog: a short
 * heading and a two-column grid of text cards (no authors, no images). Three states: posts, none yet (or not set
 * up), and a failed read with a retry.
 */
export default async function BlogPage() {
  const { posts, error } = await listPosts();

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Blog', path: '/blog' }])} />
      {posts.length > 0 && <JsonLd data={blogSchema(posts)} />}

      <IndexHero id="blog" title="Blog" subtitle={SUBTITLE}>

        <section className="relative px-4 pb-24 sm:px-6" aria-label="Posts">
          <div className="mx-auto max-w-5xl">
            {error ? (
              <div className="mkt-card mx-auto max-w-xl px-6 py-10 text-center">
                <p className="font-semibold">The posts couldn’t be loaded just now.</p>
                <SecondaryButton href="/blog" className="mt-5">
                  Try again
                </SecondaryButton>
              </div>
            ) : posts.length === 0 ? (
              <div className="mkt-card mx-auto max-w-xl px-6 py-10 text-center">
                <p className="font-semibold">The first posts are on their way.</p>
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
                  <a href="/blog/feed.xml" className="hover:text-primary">
                    RSS feed
                  </a>
                </p>
              </>
            )}

          </div>
        </section>
      </IndexHero>
    </>
  );
}
