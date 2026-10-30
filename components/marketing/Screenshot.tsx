import Image from 'next/image';

import { SCREENSHOTS, type ScreenshotKey, screenshotSrc } from '@/lib/marketing/screenshots';

/**
 * A real product capture, edge to edge in a rounded hairline frame — no
 * browser chrome. Only keys whose file exists in public/marketing/screenshots
 * should be passed; this renders the image as is.
 */
export function Screenshot({ shot, preload = false, className }: { shot: ScreenshotKey; preload?: boolean; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-[var(--mkt-line)] bg-field shadow-[0_24px_48px_-24px_rgb(32_55_45/0.35)] ${className ?? ''}`}>
      <Image src={screenshotSrc(shot)} alt={SCREENSHOTS[shot].alt} width={3662} height={2548} sizes="(min-width: 1024px) 1024px, 100vw" preload={preload} className="block h-auto w-full" />
    </div>
  );
}
