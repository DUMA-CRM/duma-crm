'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { ImageIcon, Loader2, Package, Pencil, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { proxiedImage } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { updateStockItem } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';
import { mediaImagePath } from '@/lib/utils/image-src';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/**
 * An inventory item's photo, or the package glyph when it has none — or when
 * the stored address no longer loads (the asset was deleted from Media).
 * `fallback` replaces the glyph, for a place that has its own tile.
 */
export function StockItemThumb({
  imageUrl,
  className,
  fallback,
}: {
  imageUrl?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}) {
  // Keyed by address, so picking a new photo clears an earlier failure.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const src = imageUrl && imageUrl !== brokenUrl ? proxiedImage(imageUrl) : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setBrokenUrl(imageUrl ?? null)} className={cn('shrink-0 bg-band object-cover', className)} />
  ) : fallback !== undefined ? (
    fallback
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center bg-band text-muted-foreground', className)} aria-hidden="true">
      <Package size={18} />
    </span>
  );
}

/**
 * Choose the item's photo from what has already been uploaded to Media (or
 * upload one there in place). The media library is Content's, so without that
 * module there is nothing to choose from — the field says how to get it.
 */
export function StockItemPhotoField({ value, onChange }: { value: string | null; onChange: (imageUrl: string | null) => void }) {
  const { contentEnabled } = useCatalogWords();
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex items-center gap-3.5">
      <StockItemThumb imageUrl={value} className="size-16 rounded-lg" />
      <div className="min-w-0 flex-1">
        {contentEnabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5 bg-control" onClick={() => setPicking(true)}>
              <ImageIcon size={14} aria-hidden="true" />
              {value ? 'Change photo' : 'Choose from Media'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onChange(null)}>
                <Trash2 size={14} aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Photos come from the media library, which needs <span className="font-semibold text-foreground">Website content</span>.
            Switch it on in Settings → Modules.
          </p>
        )}
        {contentEnabled && <p className="mt-1.5 text-xs text-muted-foreground">Helps staff spot it on a shelf or in a delivery.</p>}
      </div>

      {picking && (
        <MediaPicker
          multiple={false}
          groups={['image']}
          onClose={() => setPicking(false)}
          onPick={(_ids, assets) => {
            const asset = assets[0];
            if (asset) onChange(mediaImagePath(asset));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * The item page's header photo, changed in place: hover (or focus) shows a
 * pencil, a click opens the media library, and the pick saves straight away.
 * Only for someone who may both edit the item (`stock:write`, as the API's
 * PATCH requires) and read Media (`cms:read`), with Content switched on —
 * anyone else sees the photo, or the glyph, as it is.
 */
export function StockItemPhotoButton({
  itemId,
  itemName,
  imageUrl,
  canEdit,
  onSaved,
  className,
  fallback,
}: {
  itemId: string;
  itemName: string;
  imageUrl?: string | null;
  canEdit: boolean;
  /** Invalidate whatever shows the item, so the new photo appears. */
  onSaved: () => void;
  className?: string;
  /** Shown when there is no photo, instead of the package glyph — it should fill the box. */
  fallback?: React.ReactNode;
}) {
  const { contentEnabled } = useCatalogWords();
  const capabilities = useAuthStore((state) => state.capabilities);
  const [picking, setPicking] = useState(false);

  const save = useMutation({
    mutationFn: (next: string) => updateStockItem(itemId, { imageUrl: next }),
    onSuccess: () => {
      onSaved();
      toast('success', imageUrl ? 'Photo changed.' : 'Photo added.');
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The photo wasn’t saved. Try again.'),
  });

  const thumb = <StockItemThumb imageUrl={imageUrl} className={cn('size-full', className)} fallback={fallback} />;
  if (!canEdit || !contentEnabled || !hasCapability(capabilities, 'cms:read')) {
    // Nothing to show and nothing to do: the caller's own placeholder, or null
    // so the header keeps its badge.
    if (!imageUrl) return fallback ?? null;
    return <span className={cn('flex shrink-0 overflow-hidden', className)}>{thumb}</span>;
  }

  const label = imageUrl ? `Change the photo of ${itemName}` : `Add a photo of ${itemName}`;
  return (
    <>
      <button
        type="button"
        onClick={() => setPicking(true)}
        disabled={save.isPending}
        aria-label={label}
        title={label}
        className={cn(
          'group/photo relative flex shrink-0 overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          className,
        )}
      >
        {thumb}
        {/* Hidden until hover or focus; stays up while the pick is saving. */}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity',
            save.isPending ? 'opacity-100' : 'opacity-0 group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100',
          )}
          aria-hidden="true"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
        </span>
      </button>

      {picking && (
        <MediaPicker
          multiple={false}
          groups={['image']}
          onClose={() => setPicking(false)}
          onPick={(_ids, assets) => {
            setPicking(false);
            const asset = assets[0];
            if (asset) save.mutate(mediaImagePath(asset));
          }}
        />
      )}
    </>
  );
}
