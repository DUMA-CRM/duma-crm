'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';

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
  const [failedEmail, setFailedEmail] = useState<string | null>(null);
  const failed = failedEmail === email;

  if (failed) return fallback;

  // Gravatar's 404 fallback is intentional and the requested size is already optimised.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={gravatarUrl(email, px)} alt={alt} onError={() => setFailedEmail(email)} className={className} />;
}
