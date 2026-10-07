'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { ArrowLeft } from '@/components/icons';
import { SectionSkeleton, TileSkeleton } from '@/components/shared/TileSkeleton';
import { Bone } from '@/components/shared/Skeleton';

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

/**
 * A configuration page's body loading: the settings sections on the left, the
 * live preview on the right — the `SettingsTabBody` grid, so nothing moves when
 * it fills in. `preview` is the preview's aspect ratio class.
 */
export function ConfigurationBodySkeleton({ label, preview = 'aspect-[4/3]' }: { label: string; preview?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <SectionSkeleton>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((index) => (
              <TileSkeleton key={index} index={index} tile="size-9" className="min-h-16 border-rule/70 bg-field px-4 py-3.5" />
            ))}
          </div>
        </SectionSkeleton>
        <SectionSkeleton>
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <TileSkeleton key={index} index={index + 2} tile="size-9" trailing="h-5 w-9 rounded-full" />
            ))}
          </div>
        </SectionSkeleton>
      </div>
      <SectionSkeleton>
        <Bone className={`w-full rounded-lg ${preview}`} />
      </SectionSkeleton>
    </div>
  );
}
