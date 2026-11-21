'use client';

import { useState } from 'react';

import { listingImageUrl } from '@/lib/api/marketplace.service';

import { appAppearance } from './app-appearance';

export function ListingImageView({ src, alt, className, onError }: {
  src: string;
  alt: string;
  className: string;
  onError?: () => void;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- Listing media requires the viewer's same-origin session cookie.
  return <img src={src} alt={alt} loading="lazy" className={className} onError={onError} />;
}

export function ListingIcon({ appId, imageId, builtin }: {
  appId: string;
  imageId?: string | null;
  builtin?: Parameters<typeof appAppearance>[0];
}) {
  const [failed, setFailed] = useState<string>();
  const { icon: Icon, tile } = appAppearance(builtin);
  return (
    <span className={`grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl ${tile}`}>
      {imageId && failed !== imageId ? (
        <ListingImageView src={listingImageUrl(appId, imageId)} alt="" className="size-full object-cover" onError={() => setFailed(imageId)} />
      ) : <Icon aria-hidden="true" size={24} />}
    </span>
  );
}
