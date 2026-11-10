import Link from 'next/link';

import { ChalkCurve } from '@/components/marketing/Strokes';

import { cn } from '@/lib/utils/cn';

/**
 * The top of an index page (/blog, /tools), after seline.com/blog: the two
 * chalk curves, a short centred heading and one line under it. The curves sit
 * on a wrapper round the hero and whatever follows it (`children`), so they
 * are not cut off mid-stroke.
 */
export function IndexHero({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="relative -mt-16 overflow-hidden">
      <ChalkCurve side="left" id={`${id}-left`} className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
      <ChalkCurve side="right" id={`${id}-right`} className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />

      <section className="relative px-4 pt-32 pb-8 sm:px-6 sm:pt-40">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-5xl">{title}</h1>
          <p className="mt-4 text-pretty text-[var(--mkt-ink-2)]">{subtitle}</p>
        </div>
      </section>

      {children}
    </div>
  );
}

/**
 * One entry on an index page, as a text card: a small label with a coloured
 * dot, the title (the whole card is the link, when there is one), a few lines
 * of description and a quiet line at the foot. No image, by design. Used by
 * blog posts and the features index.
 */
export function IndexCard({
  href,
  label,
  title,
  body,
  meta,
  heading: Heading = 'h3',
}: {
  /** Leave out for an entry with no page yet: the card shows, but links nowhere. */
  href?: string;
  label: React.ReactNode;
  title: string;
  body?: string;
  meta?: React.ReactNode;
  heading?: 'h2' | 'h3';
}) {
  return (
    <article
      className={cn('mkt-card group relative flex flex-col transition-colors', href && 'hover:border-[color-mix(in_oklab,var(--ink)_22%,transparent)]')}
    >
      <div className="flex flex-1 flex-col px-6 pt-5 pb-6">
        {label}
        <Heading className="mt-2.5 text-xl leading-snug font-semibold tracking-display text-[var(--mkt-heading)]">
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 group-hover:text-primary">
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        {body && <p className="mt-2.5 line-clamp-3 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{body}</p>}
        {meta && <div className="mt-auto pt-4 text-[13px] text-[var(--mkt-ink-3)]">{meta}</div>}
      </div>
    </article>
  );
}

/** The label at the top of an IndexCard: a dot in a domain colour and a word or two. */
export function IndexLabel({ dot, children, className }: { dot: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--mkt-ink-2)]', className)}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
      {children}
    </span>
  );
}
