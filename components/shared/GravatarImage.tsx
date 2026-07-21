'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { gravatarUrl } from '@/lib/utils/gravatar';

/**
 * Renders a Gravatar for `email`, falling back to `fallback` when the person has
 * no Gravatar (the image 404s) or the request fails.
 */
export function GravatarImage({
  email,
  px,
  className,
  alt,
  fallback,
}: {
  email: string;
  px: number;
  className?: string;
  alt: string;
  fallback: ReactElement;
}) {
  const [failed, setFailed] = useState(false);

  // Re-attempt when the email changes (e.g. a different row is rendered).
  useEffect(() => {
    setFailed(false);
  }, [email]);

  if (failed) return fallback;

  return <img src={gravatarUrl(email, px)} alt={alt} onError={() => setFailed(true)} className={className} />;
}
