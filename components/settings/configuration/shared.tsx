'use client';

import { motion } from 'motion/react';
import { useSyncExternalStore } from 'react';

import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Bone } from '@/components/shared/Skeleton';
import { SectionSkeleton } from '@/components/shared/TileSkeleton';

import { cn } from '@/lib/utils/cn';

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

/** `ChangeRow`s without their words: a tile, a label over a value, a button. */
export function ChangeRowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Bone className="size-10 shrink-0" />
          <span className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-3.5 w-40 max-w-full" />
          </span>
          <Bone className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </>
  );
}

/**
 * A configuration page's body loading: two stacks of row sections in the main
 * column, the preview in the narrow rail — the loaded page's grid, so nothing
 * moves when it fills in. `preview` is the preview's aspect ratio class.
 */
export function ConfigurationBodySkeleton({ label, preview = 'aspect-[4/3]' }: { label: string; preview?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <SectionSkeleton>
          <ChangeRowsSkeleton rows={4} />
        </SectionSkeleton>
        <SectionSkeleton>
          <ChangeRowsSkeleton rows={3} />
        </SectionSkeleton>
      </div>
      <Bone className={cn('mt-7 w-full rounded-lg', preview)} />
    </div>
  );
}

/** The rail's live preview: no card around it — the sketch is the thing, under a small label. */
export function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={SECTION_RISE} className="pt-1">
      <p className="mb-2 text-center text-label uppercase text-muted-foreground">Preview</p>
      {children}
    </motion.div>
  );
}

/** The page's foot: where these settings live, and the way back to the defaults. */
export function ConfigurationFoot({ storage, children }: { storage: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <p className="text-xs text-muted-foreground">{storage}</p>
      {children}
    </div>
  );
}
