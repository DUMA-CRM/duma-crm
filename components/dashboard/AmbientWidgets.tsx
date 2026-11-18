'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { assetPreviewSrc } from '@/components/cms/shared';
import { Widget, WidgetDot, WidgetRow, useFamily, useRows } from '@/components/dashboard/widget/Widget';
import { CalendarDays, Check, ExternalLink, ImageIcon, Pin, StickyNote } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { NATURE_PHOTOS } from '@/lib/dashboard/nature-photos';
import { getCmsAsset, getCmsAssets } from '@/lib/modules/cms/client';
import { getNotes } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { dailyPick } from '@/lib/utils/dashboard-cards';
import { relativeTime } from '@/lib/utils/relative-time';
import { resolvedTimeZone, workspaceDateKey, zonedParts } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* Widgets for a pleasant board rather than a figure to act on: the shop's
 * clock, a photo of the day (from the workspace's own Media, or a calm
 * landscape), and the notes you pinned. Each fills its cell; the photos run to
 * its edges. */

/** The card the ambient widgets sit on — the same porcelain as the shared Needs attention block. */
const CARD = 'relative h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm';

// ── Clock ────────────────────────────────────────────────────────────────────

/**
 * The minute on the clock, shared by every clock on the page; null on the server, so its time never
 * reaches the page. Checked each second so the minute turns on time, re-rendering only when it does.
 */
const subscribeToClock = (onTick: () => void) => {
  const timer = window.setInterval(onTick, 1000);
  return () => window.clearInterval(timer);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribeToClock, currentMinute, () => null);
  return minute === null ? null : new Date(minute * 60_000);
}

/** The shop's local time, the number alone, larger as the tile grows. */
export function ClockWidget() {
  const family = useFamily();
  const now = useNow();
  if (!now) return <div className={CARD} aria-busy="true" />;
  const time = zonedParts(now, resolvedTimeZone()).time;
  return (
    <section className={cn(CARD, 'flex items-center justify-center px-4')} aria-label={`The time is ${time}`}>
      <p
        className={cn(
          'leading-none font-semibold tracking-[-0.04em] text-heading tabular-nums',
          family === 'compact' ? 'text-[34px]' : family === 'bar' ? 'text-[44px]' : family === 'small' ? 'text-[48px]' : 'text-[76px]',
        )}
      >
        {time}
      </p>
    </section>
  );
}

// ── Photos ───────────────────────────────────────────────────────────────────

/** A photo to the tile's edges, a soft shade under its caption so the words read on any picture. */
function PhotoTile({ src, alt, position, caption }: { src: string; alt: string; position?: string; caption?: React.ReactNode }) {
  return (
    <figure className={cn(CARD, 'bg-band')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" style={{ objectPosition: position }} />
      {caption && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-3.5 pt-8 pb-2.5 text-[11px] leading-4 text-white/90">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * The photo you chose for the board, kept in this browser per person and workspace. It is a
 * cosmetic preference: the layout API stores no per-person widget settings, and if it is ever
 * lost the widget simply goes back to the photo of the day.
 */
function useChosenPhoto(tenantId: string | null) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const key = tenantId && userId ? `duma:dashboard-photo:${tenantId}:${userId}` : null;
  const read = () => {
    try {
      return key ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const [chosen, setChosen] = useState<string | null>(() => (typeof window === 'undefined' ? null : read()));
  const choose = (assetId: string | null) => {
    setChosen(assetId);
    try {
      if (!key) return;
      if (assetId) window.localStorage.setItem(key, assetId);
      else window.localStorage.removeItem(key);
    } catch {
      // Storage refused (a private window): the choice lasts until the page closes.
    }
  };
  return [chosen, choose] as const;
}

/**
 * A photo from the workspace's Media library: the one you chose, or a different one each day.
 * Right-click it to choose which — the menu lists the library's images, with the photo of the day
 * as the way back to rotating.
 */
export function MediaPhotoWidget() {
  const router = useRouter();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const images = useQuery({
    queryKey: moduleQueryKeys.cms.key('assets', tenantId, 'dashboard-photo'),
    queryFn: () => getCmsAssets({ kind: 'image' }, tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const [chosenId, choose] = useChosenPhoto(tenantId);
  const listed = images.data?.data ?? [];
  // A chosen photo past the first page is read on its own; one since deleted falls back to the day's.
  const chosenElsewhere = useQuery({
    queryKey: moduleQueryKeys.cms.key('assets', tenantId, 'dashboard-photo', chosenId),
    queryFn: () => getCmsAsset(chosenId!, tenantId ?? undefined),
    enabled: !!tenantId && !!chosenId && images.isSuccess && !listed.some((asset) => asset.id === chosenId),
    retry: false,
  });
  const [today] = useState(() => workspaceDateKey());
  const chosen =
    listed.find((asset) => asset.id === chosenId) ??
    (chosenElsewhere.data?.mimeType.startsWith('image/') ? chosenElsewhere.data : undefined);
  const photo = chosen ?? dailyPick(listed, today);

  if (images.isPending || images.isError || !photo) {
    return (
      <Widget
        title="Photo from Media"
        icon={ImageIcon}
        surface="plain"
        href="/content?tab=media"
        hrefLabel="Open Media"
        loading={images.isPending}
        skeleton={<Bone className="min-h-0 w-full flex-1 rounded-md" />}
        error={images.isError}
        onRetry={() => void images.refetch()}
        empty={{ icon: ImageIcon, title: 'No photos in Media yet', detail: 'Upload one in Content → Media and it shows here.' }}
      />
    );
  }

  const focal = photo.focalPoint ? `${photo.focalPoint.x * 100}% ${photo.focalPoint.y * 100}%` : undefined;
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full">
          <PhotoTile
            src={assetPreviewSrc(photo)}
            alt={photo.altText ?? photo.title ?? ''}
            position={focal}
            caption={<span className="block truncate font-medium">{photo.title ?? photo.fileName}</span>}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem icon={chosen ? CalendarDays : Check} onSelect={() => choose(null)}>
          Photo of the day
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Show this photo</ContextMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {listed.map((asset) => (
            <ContextMenuItem key={asset.id} onSelect={() => choose(asset.id)}>
              <span className="flex min-w-0 items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetPreviewSrc(asset)} alt="" className="size-8 shrink-0 rounded-sm bg-band object-cover" loading="lazy" />
                <span className="min-w-0 flex-1 truncate">{asset.title ?? asset.fileName}</span>
                {chosen?.id === asset.id && <Check size={14} className="shrink-0 text-primary" aria-label="Showing" />}
              </span>
            </ContextMenuItem>
          ))}
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem icon={ExternalLink} onSelect={() => router.push('/content?tab=media')}>
          Open Media
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** A calm landscape from the curated set, a new one each day, with its photographer's credit. */
export function NaturePhotoWidget() {
  const [today] = useState(() => workspaceDateKey());
  const photo = dailyPick(NATURE_PHOTOS, today);
  if (!photo) return null;
  return (
    <PhotoTile
      src={`/dashboard/nature/${photo.file}`}
      alt={photo.alt}
      caption={
        <a href={photo.source} target="_blank" rel="noreferrer" className="hover:underline">
          Photo by {photo.photographer}
        </a>
      }
    />
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────

/** The notes you pinned, as a sticky note: the first in full at small, a list from medium. */
export function PinnedNotesWidget() {
  const family = useFamily();
  const [now] = useState(() => Date.now());
  const capacity = useRows(40, 8);
  const pinned = useQuery({
    // Under the notes list's key, so pinning, unpinning and editing a note refresh it.
    queryKey: moduleQueryKeys.notes.key('list', 'pinned', 'dashboard'),
    queryFn: () => getNotes({ view: 'pinned', limit: 12 }),
  });
  const notes = pinned.data ?? [];
  const [first] = notes;

  return (
    <Widget
      title="Pinned notes"
      icon={StickyNote}
      tint="stock"
      href="/notes"
      hrefLabel="Open notes"
      loading={pinned.isPending}
      error={pinned.isError}
      onRetry={() => void pinned.refetch()}
      empty={notes.length === 0 ? { icon: Pin, title: 'No pinned notes', detail: 'Pin a note in Notes to keep it here.' } : undefined}
    >
      {family === 'small' && first ? (
        <a href={`/notes?note=${first.id}`} className="flex min-h-0 flex-1 flex-col justify-end">
          <p className="line-clamp-4 text-[17px] leading-6 font-semibold text-heading">{first.title || 'Untitled'}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Edited {relativeTime(first.updatedAt, now)}
            {notes.length > 1 && ` · ${notes.length - 1} more pinned`}
          </p>
        </a>
      ) : (
        <ul className="min-w-0">
          {notes.slice(0, capacity).map((note) => (
            <WidgetRow
              key={note.id}
              href={`/notes?note=${note.id}`}
              mark={<WidgetDot className="bg-stock" />}
              title={note.title || 'Untitled'}
              value={relativeTime(note.updatedAt, now)}
              valueClassName="font-normal text-muted-foreground"
            />
          ))}
        </ul>
      )}
    </Widget>
  );
}
