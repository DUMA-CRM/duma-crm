import { IndexCard, IndexLabel } from '@/components/marketing/IndexCard';

import type { BlogPost } from '@/lib/blog/posts';

/**
 * The blog's building blocks: the category label and the post cards — after
 * seline.com/blog. Cards carry no author and no image, by design.
 */

/** Each category's dot colour, from the product's domain tones; anything unknown is ink. */
const CATEGORY_DOT: Record<string, string> = {
  guides: 'bg-primary',
  'cafes-and-restaurants': 'bg-measured',
  'retail-and-online-stores': 'bg-reference',
  'pricing-and-comparisons': 'bg-stock',
  'duma-news': 'bg-success',
};
const dotOf = (slug: string) => CATEGORY_DOT[slug] ?? 'bg-foreground';

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
export const formatPostDate = (iso: string) => DATE.format(new Date(iso));

export function CategoryLabel({ post, className }: { post: Pick<BlogPost, 'category' | 'categorySlug'>; className?: string }) {
  return (
    <IndexLabel dot={dotOf(post.categorySlug)} className={className}>
      {post.category}
    </IndexLabel>
  );
}

/** A post in the grid, after seline.com/blog: category, title, excerpt and date — no author, no image. */
export function PostCard({ post }: { post: BlogPost }) {
  return (
    <IndexCard
      href={`/blog/${post.slug}`}
      label={<CategoryLabel post={post} />}
      title={post.title}
      body={post.excerpt ?? undefined}
      meta={
        <>
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time> · {post.readingMinutes} min read
        </>
      }
    />
  );
}
