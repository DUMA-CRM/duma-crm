import { ImageIcon } from '@/components/icons';
import { Screenshot } from '@/components/marketing/Screenshot';

import { SCREENSHOTS, type ScreenshotKey, screenshotSrc } from '@/lib/marketing/screenshots';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { cn } from '@/lib/utils/cn';

/**
 * Where a product screenshot goes: the real capture once its PNG is in
 * public/marketing/screenshots, and until then a gray box of the same size
 * with the icon and what it will show. Dropping the file in is the whole job.
 * In development the box also names the file it is waiting for.
 */
export function ScreenshotSlot({ shot, preload = false, className }: { shot: ScreenshotKey; preload?: boolean; className?: string }) {
  if (hasScreenshot(shot)) return <Screenshot shot={shot} preload={preload} className={className} />;
  return (
    <div
      role="img"
      aria-label={SCREENSHOTS[shot].alt}
      className={cn(
        // The real captures' size (Screenshot's 3662 × 2548), so nothing moves when the file arrives.
        'flex aspect-[3662/2548] w-full flex-col items-center justify-center gap-3 rounded-lg border border-[var(--mkt-line)] px-6 text-center',
        'bg-[color-mix(in_oklab,var(--mkt-ground)_90%,var(--ink))]',
        className,
      )}
    >
      <ImageIcon className="size-8 text-[var(--mkt-ink-3)]" aria-hidden="true" />
      <p className="max-w-sm text-pretty text-sm font-medium text-[var(--mkt-ink-2)]">{SCREENSHOTS[shot].alt}</p>
      {process.env.NODE_ENV === 'development' && <p className="font-mono text-xs text-[var(--mkt-ink-3)]">public{screenshotSrc(shot)}</p>}
    </div>
  );
}
