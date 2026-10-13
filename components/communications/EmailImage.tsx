'use client';

import { useState } from 'react';

import { ImageIcon } from '@/components/icons';

import { proxiedImageForEmail } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { imageHost } from '@/lib/utils/email-images';

/**
 * An email image as the editor can show it. A Media image loads through `/be`;
 * one linked from another site is refused by our CSP (or may simply be down),
 * so it gets an image frame naming its host instead of an empty gap. The email
 * itself still carries the real address.
 */
export function EmailImage({ url, alt, className, style }: { url: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const src = proxiedImageForEmail(url);
  // Keyed on the address, so pasting a new one tries again.
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === url) {
    const host = imageHost(url);
    return (
      <span
        role="img"
        aria-label={alt || 'Image'}
        className={cn(
          'inline-flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-sm border border-dashed border-current/25 bg-current/[0.03] px-4 py-5 align-middle text-xs opacity-70',
          className,
        )}
        style={style}
      >
        <ImageIcon size={22} aria-hidden="true" />
        <span className="font-medium">{failed === url ? 'This image couldn’t be loaded' : 'Shows in the inbox'}</span>
        {host && <span className="max-w-full truncate opacity-70">{host}</span>}
      </span>
    );
  }

  // Tenant media through /be, or a host the CSP allows — not an optimisable asset.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailed(url)} />;
}
