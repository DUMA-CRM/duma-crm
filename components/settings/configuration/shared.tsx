'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { ArrowLeft } from '@/components/icons';

/**
 * These settings live in this device's localStorage, so the server render
 * can't know them: render only once mounted, or the first paint shows the
 * defaults and then jumps.
 */
export const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function ConfigurationHeader({
  title,
  description,
  storageLabel = 'Saved on this device',
}: {
  title: string;
  description: string;
  storageLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link
          href="/settings/configuration"
          className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Configuration
        </Link>
        <h2 className="text-2xl font-semibold tracking-headline text-foreground">{title}</h2>
        <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="rounded-full bg-band px-3 py-1 text-xs font-medium text-muted-foreground">{storageLabel}</p>
    </div>
  );
}
