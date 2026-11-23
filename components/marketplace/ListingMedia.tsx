'use client';

import { useState } from 'react';

import { listingImageUrl } from '@/lib/api/marketplace.service';
import { cn } from '@/lib/utils/cn';

import { appAppearance } from './app-appearance';

export function ListingImageView({ src, alt, className, onError }: {
  src: string;
  alt: string;
  className: string;
  onError?: () => void;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- Listing media requires the viewer's same-origin session cookie.
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} onError={onError} />;
}

const SIZES = {
  xs: { box: 'size-6 rounded-md', glyph: 14 },
  sm: { box: 'size-9 rounded-lg', glyph: 18 },
  md: { box: 'size-12 rounded-xl', glyph: 22 },
  lg: { box: 'size-16 rounded-2xl', glyph: 28 },
} as const;

/** The app's icon, or its built-in glyph on a tinted tile when it has none (or it fails to load). */
export function ListingIcon({ appId, imageId, builtin, size = 'md', className }: {
  appId: string;
  imageId?: string | null;
  builtin?: Parameters<typeof appAppearance>[0];
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const { icon: Icon, tile } = appAppearance(builtin);
  const { box, glyph } = SIZES[size];
  const image = imageId && failed !== imageId;
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden', box, image ? 'border border-border bg-card' : tile, className)}>
      {image ? (
        <ListingImageView src={listingImageUrl(appId, imageId)} alt="" className="size-full object-cover" onError={() => setFailed(imageId)} />
      ) : <Icon aria-hidden="true" size={glyph} />}
    </span>
  );
}
