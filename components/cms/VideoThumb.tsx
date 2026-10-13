'use client';

import { useEffect, useRef, useState } from 'react';

import { Play, Video } from '@/components/icons';

import { formatClipLength } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';

/**
 * A video in Media. As a grid tile it shows its first frame, its length, and
 * plays muted while the pointer is over it; the source is only set once the
 * tile scrolls into view, so a page of videos does not start forty downloads.
 * As the drawer's player it has full controls and sound.
 *
 * `src` is same-origin (`/be/…/file`), which the CSP's `media-src 'self'`
 * allows; the API answers byte ranges, so the browser reads only what it needs.
 */
export function VideoThumb({ src, variant, className }: { src: string; variant: 'tile' | 'player'; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(variant === 'player');
  const [length, setLength] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  if (failed) {
    return (
      <span
        className={cn(
          'flex aspect-video w-full flex-col items-center justify-center gap-1 bg-band/60 px-3 text-center text-muted-foreground',
          className,
        )}
      >
        <Video size={24} aria-hidden="true" />
        <span className="text-xs">{variant === 'player' ? 'This browser cannot play this video' : 'No preview'}</span>
      </span>
    );
  }

  if (variant === 'player') {
    return (
      <video
        ref={ref}
        src={src}
        controls
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className={cn('block max-h-80 w-full bg-black', className)}
      />
    );
  }

  // `#t=0.1` asks for a frame just past the start — the very first is often black.
  return (
    <span
      className={cn('relative block aspect-4/3 w-full overflow-hidden bg-black', className)}
      onMouseEnter={() => void ref.current?.play().catch(() => undefined)}
      onMouseLeave={() => ref.current?.pause()}
    >
      <video
        ref={ref}
        src={visible ? `${src}#t=0.1` : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onLoadedMetadata={(event) => setLength(event.currentTarget.duration)}
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-sm bg-black/65 px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-white">
        <Play size={10} aria-hidden="true" />
        {length !== null ? formatClipLength(length) : 'Video'}
      </span>
    </span>
  );
}
