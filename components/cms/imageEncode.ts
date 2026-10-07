'use client';

import { type ImageOptions, isFullCrop, outputMimeType, preferConverted, renameForType, targetSize } from '@/lib/utils/media-storage';

// ---------------------------------------------------------------------------
// Re-encode an image in the browser before it is uploaded: resize, change
// format, recompress. Done here rather than on the API so the person sees the
// real result (and its size) before anything is stored, and the server spends
// no CPU on it. The rules are in lib/utils/media-storage.ts.
// ---------------------------------------------------------------------------

const encodable = new Map<string, boolean>();

/**
 * Can this browser *write* the type? Every browser decodes WebP and AVIF, but
 * canvas encoding varies — Safari cannot produce AVIF, and an unsupported
 * type silently comes back as PNG.
 */
export async function canEncode(mimeType: string): Promise<boolean> {
  const known = encodable.get(mimeType);
  if (known !== undefined) return known;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.8));
  const supported = blob?.type === mimeType;
  encodable.set(mimeType, supported);
  return supported;
}

export interface EncodedImage {
  /** What to upload: the converted file, or the original when converting only made it worse. */
  file: File;
  converted: boolean;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export async function encodeImage(source: File, options: ImageOptions): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(source);
  try {
    const original = { width: bitmap.width, height: bitmap.height };
    // The crop is in source pixels; a full-frame "crop" is no crop.
    const crop = options.crop && !isFullCrop(options.crop, bitmap.width, bitmap.height) ? options.crop : null;
    const region = crop ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const size = targetSize(region.width, region.height, options.maxWidth);
    const type = outputMimeType(source.type, options.format);

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot process images');
    // JPEG has no alpha; transparent pixels would turn black without a backdrop.
    if (type === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, region.x, region.y, region.width, region.height, 0, 0, size.width, size.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, options.quality));
    if (!blob || blob.type !== type) throw new Error(`This browser cannot create ${type.replace('image/', '').toUpperCase()} images`);

    const candidate = new File([blob], renameForType(source.name, type), { type, lastModified: Date.now() });
    const keep = preferConverted(
      { size: source.size, type: source.type, width: original.width },
      { size: candidate.size, type, width: size.width, cropped: crop !== null },
    );
    return keep
      ? { file: candidate, converted: true, ...size, originalWidth: original.width, originalHeight: original.height }
      : { file: source, converted: false, ...original, originalWidth: original.width, originalHeight: original.height };
  } finally {
    bitmap.close();
  }
}
