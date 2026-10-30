import Link from 'next/link';

import type { BlogPost } from '@/lib/blog/posts';
import { cn } from '@/lib/utils/cn';

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
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--mkt-ink-2)]', className)}>
      <span className={cn('size-1.5 rounded-full', dotOf(post.categorySlug))} aria-hidden="true" />
      {post.category}
    </span>
  );
}

function Meta({ post }: { post: BlogPost }) {
  return (
    <p className="text-[13px] text-[var(--mkt-ink-3)]">
      <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time> — {post.readingMinutes} min read
    </p>
  );
}

/** A post in the grid, after seline.com/blog: category, title, excerpt and date — no author, no image. */
export function PostCard({ post }: { post: BlogPost }) {
  return (
    <article className="mkt-card group relative flex flex-col transition-shadow hover:shadow-[0_16px_40px_-20px_rgb(32_55_45/0.35)]">
      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryLabel post={post} />
        </div>
        <h3 className="mt-2.5 text-xl leading-snug font-semibold tracking-display text-[var(--mkt-heading)]">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="mt-2.5 line-clamp-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{post.excerpt}</p>}
        <div className="mt-auto pt-4">
          <Meta post={post} />
        </div>
      </div>
    </article>
  );
}
