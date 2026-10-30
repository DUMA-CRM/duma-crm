'use client';

import { useEffect, useState } from 'react';

import type { TocHeading } from '@/lib/utils/blog';
import { cn } from '@/lib/utils/cn';

/**
 * The post's table of contents, after seline.com: ## headings with their ###
 * underneath, and the section you're reading highlighted. Long lists fold to
 * the first eight with "Show more". Works as plain links without JavaScript.
 */
export function TableOfContents({
  headings,
  title = 'Table of contents',
  fold = 8,
}: {
  headings: TocHeading[];
  title?: string;
  /** How many entries show before "Show more". */
  fold?: number;
}) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const elements = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;
  const shown = expanded ? headings : headings.slice(0, fold);

  return (
    <nav aria-label="Table of contents">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--mkt-ink-3)] uppercase">{title}</p>
      <ul className="mt-3 flex flex-col gap-1 border-l border-[var(--mkt-line)] text-sm">
        {shown.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={active === heading.id ? 'location' : undefined}
              className={cn(
                '-ml-px block border-l-2 py-1 leading-snug transition-colors',
                heading.depth === 3 ? 'pl-6' : 'pl-3',
                active === heading.id ? 'border-primary text-primary' : 'border-transparent text-[var(--mkt-ink-2)] hover:text-foreground',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
      {headings.length > fold && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-2 pl-3 text-xs text-[var(--mkt-ink-3)] hover:text-foreground">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </nav>
  );
}

/**
 * Seline's reading-progress pill: how far through the post you are, and a
 * circle that scrolls back to the top — with a "Scroll to top" tooltip on
 * hover or keyboard focus. Shown only while you're inside the post: hidden at
 * the top, and again once the post's end has scrolled past.
 */
export function ReadingProgress() {
  const [percent, setPercent] = useState(0);
  // Past the end of the post — related posts, the closing card, the footer — the pill gets out of the way.
  const [past, setPast] = useState(false);

  useEffect(() => {
    const update = () => {
      const article = document.getElementById('post-body');
      if (!article) return;
      const { top, height } = article.getBoundingClientRect();
      const read = Math.min(1, Math.max(0, (window.innerHeight * 0.4 - top) / height));
      setPercent(Math.round(read * 100));
      // The whole article — body and its questions — not just the body, so the pill stays while the questions are read.
      const end = (article.closest('article') ?? article).getBoundingClientRect().bottom;
      setPast(end < window.innerHeight * 0.5);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const toTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transition-opacity duration-200 md:bottom-6',
        percent > 2 && !past ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {/* At rest the pill sits at 90%; it grows to full size on hover. Only hovering the icon itself fills its circle and shows the tooltip. */}
      <div className="flex w-fit scale-90 items-center gap-1.5 rounded-full bg-stone-950/90 p-1.5 text-white shadow-md shadow-stone-950/20 backdrop-blur-sm transition-transform duration-200 ease-out hover:scale-100">
        <span className="relative">
          <button
            type="button"
            onClick={toTop}
            aria-label="Scroll to top"
            className="peer flex size-8 items-center justify-center rounded-full transition-colors hover:bg-stone-700 focus-visible:bg-stone-700 focus-visible:outline-none"
          >
            {/* Lucide's arrow-up-to-line. */}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              <path d="M5 3h14M18 13l-6-6-6 6M12 7v14" />
            </svg>
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 rounded-[7px] border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground opacity-0 shadow-md transition-[opacity,translate] duration-150 peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100"
          >
            Scroll to top
          </span>
        </span>
        <span className="w-[50px] cursor-default px-2 text-sm font-medium tabular-nums select-none">
          {percent}%<span className="sr-only"> read</span>
        </span>
      </div>
    </div>
  );
}
