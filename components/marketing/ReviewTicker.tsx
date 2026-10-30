'use client';

import { useEffect, useState } from 'react';

import { Star } from '@/components/icons';

import type { Review } from '@/lib/marketing/reviews';
import { cn } from '@/lib/utils/cn';

const INTERVAL_MS = 5000;

/**
 * Five grey stars that stay put, and one short review beside them that changes
 * every five seconds — after the rating line above seline.com's product frame.
 * Pauses while hovered or focused; with reduced motion it still changes, but
 * without the fade. Every review is in the HTML for screen readers and
 * crawlers, so nothing depends on the rotation.
 */
export function ReviewTicker({ reviews, className }: { reviews: readonly Review[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reviews.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % reviews.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [paused, reviews.length]);

  if (reviews.length === 0) return null;
  const review = reviews[index];

  return (
    <figure
      className={cn('flex min-w-0 items-center gap-3 text-[0.9375rem] text-[var(--mkt-ink-3)]', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="flex shrink-0 gap-0.5" role="img" aria-label="Rated 5 out of 5">
        {[0, 1, 2, 3, 4].map((star) => (
          <Star key={star} className="size-4 fill-current" aria-hidden="true" />
        ))}
      </span>
      {review.source === 'google' && (
        <span className="flex shrink-0 items-center gap-1.5">
          on <GoogleMark className="size-3.5" />
          <span className="sr-only">Google</span>
        </span>
      )}
      <span aria-hidden="true">—</span>
      <blockquote key={index} className="mkt-review min-w-0 truncate" aria-hidden="true">
        “{review.quote}” <span className="text-[var(--mkt-ink-3)]/80">— {review.name}, {review.business}</span>
      </blockquote>
      <ul className="sr-only">
        {reviews.map((item) => (
          <li key={item.quote}>
            “{item.quote}” — {item.name}, {item.business}
            {item.source === 'google' && ', on Google'}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Google's "G" in its own four colours — the mark from Google's sign-in button. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
