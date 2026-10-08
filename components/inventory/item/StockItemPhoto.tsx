'use client';

import { useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { ImageIcon, Package, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { proxiedImage } from '@/lib/api/client';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { cn } from '@/lib/utils/cn';
import { mediaImagePath } from '@/lib/utils/image-src';

/**
 * An inventory item's photo, or the package glyph when it has none — or when
 * the stored address no longer loads (the asset was deleted from Media).
 */
export function StockItemThumb({ imageUrl, className }: { imageUrl?: string | null; className?: string }) {
  // Keyed by address, so picking a new photo clears an earlier failure.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const src = imageUrl && imageUrl !== brokenUrl ? proxiedImage(imageUrl) : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setBrokenUrl(imageUrl ?? null)} className={cn('shrink-0 bg-band object-cover', className)} />
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
