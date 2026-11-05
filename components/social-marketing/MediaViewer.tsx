'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { ChevronLeft, ChevronRight } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { type Asset, assetSrc } from '@/lib/modules/marketing/client';

const sizeLabel = (bytes: number) =>
  bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * A post's media, large, without leaving DUMA: an image at full size or the
 * video playing. With several files, arrows (and ← →) step through them.
 */
export function MediaViewer({ assets, start, onClose }: { assets: Asset[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const a = assets[index]!;
  const many = assets.length > 1;
  const step = (delta: number) => setIndex((i) => (i + delta + assets.length) % assets.length);
  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + assets.length) % assets.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % assets.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, assets.length]);
  const video = a.mimeType.startsWith('video/');
  return (
    <Modal
      title={a.fileName}
      description={`${video ? 'Video' : 'Image'} · ${sizeLabel(a.sizeBytes)}${many ? ` · ${index + 1} of ${assets.length}` : ''}`}
      size="2xl"
      onClose={onClose}
    >
      <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-black/90">
        {video ? (
          // `key` restarts the player when stepping to another video.
          <video key={a.id} src={assetSrc(a)} controls autoPlay playsInline className="max-h-[70vh] w-full" />
        ) : (
          <Image
            key={a.id}
            unoptimized
            width={1600}
            height={1200}
            src={assetSrc(a)}
            alt={a.fileName}
            className="max-h-[70vh] w-auto object-contain"
          />
        )}
        {many && (
          <>
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous file"
              onClick={() => step(-1)}
              className="absolute left-3 top-1/2 size-9 -translate-y-1/2 rounded-full bg-background/85 backdrop-blur"
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Next file"
              onClick={() => step(1)}
              className="absolute right-3 top-1/2 size-9 -translate-y-1/2 rounded-full bg-background/85 backdrop-blur"
            >
              <ChevronRight />
            </Button>
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
          {assets.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.fileName}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`relative size-14 shrink-0 overflow-hidden rounded-md border-2 bg-band/50 focus-visible:outline-2 focus-visible:outline-ring ${i === index ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              {item.mimeType.startsWith('video/') ? (
                <video src={assetSrc(item)} preload="metadata" muted className="size-full object-cover" />
              ) : (
                <Image unoptimized width={112} height={112} src={assetSrc(item)} alt="" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
