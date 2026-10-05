'use client';

import { useEffect, useRef } from 'react';

import { Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

/**
 * Loads the next page as the end of the list comes into view — started a
 * screen early so scrolling rarely meets the spinner. The button stays as the
 * way on when that can't happen: keyboard reading, or a failed load that left
 * the sentinel sitting in view with nothing new to observe.
 */
export function LoadMore({ hasMore, loading, onLoadMore }: { hasMore: boolean; loading: boolean; onLoadMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);
  // The latest callback, so the observer isn't rebuilt on every render.
  const load = useRef(onLoadMore);
  useEffect(() => {
    load.current = onLoadMore;
  });

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && load.current(), {
      rootMargin: '600px 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;
  return (
    <div ref={sentinel} className="flex justify-center pb-2">
      {loading ? (
        <p className="flex h-9 items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Loading more…
        </p>
      ) : (
        <Button variant="ghost" size="sm" onClick={onLoadMore} className="text-muted-foreground">
          Load more
        </Button>
      )}
    </div>
  );
}
