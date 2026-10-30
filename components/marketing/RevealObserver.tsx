'use client';

import { useEffect } from 'react';

/**
 * Brings `[data-reveal]` elements in as they scroll into view (styles in
 * app/(marketing)/marketing.css). One observer for the whole page, so the
 * sections stay Server Components and only mark themselves up.
 *
 * Only elements still below the fold are hidden, and only after hydration:
 * what is already on screen never flickers out and back, the server HTML is
 * complete for crawlers and no-JS readers, and LCP is never delayed.
 *
 * `data-reveal-delay` staggers siblings, in milliseconds.
 */
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealState = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      element.style.setProperty('--reveal-delay', `${element.dataset.revealDelay ?? 0}ms`);
      element.dataset.revealState = 'hidden';
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
