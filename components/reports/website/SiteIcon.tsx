'use client';

import { useState } from 'react';

import { Globe } from '@/components/icons';

import { API_PREFIX } from '@/lib/api/client';
import { faviconPath } from '@/lib/utils/web-analytics';

/**
 * A site's favicon beside a referrer, browser or system — through the API,
 * which fetches and caches it, so the page only ever loads from our origin.
 * No icon, or none known: a quiet globe in the same box, so rows stay aligned.
 */
export function SiteIcon({ domain }: { domain: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!domain || failed === domain) {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
        <Globe size={13} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 16px icon from our own API; next/image adds nothing here.
    <img
      src={`${API_PREFIX}${faviconPath(domain)}`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      className="size-4 shrink-0 rounded-[3px]"
      onError={() => setFailed(domain)}
    />
  );
}
