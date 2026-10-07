'use client';

import { type CmsAsset, getCmsAssetFile, uploadCmsRendition } from '@/lib/modules/cms/client';
import { isConvertibleImage, renditionWidths } from '@/lib/utils/media-storage';

import { encodeImage } from './imageEncode';

/**
 * Make an image's smaller WebP copies in the browser and store each beside it
 * — the same reasoning as optimising before upload (UI-ADR-024): no image
 * library on the API, and the work happens where the file already is.
 * `source` is the file just uploaded, when there is one; otherwise the
 * original is read back through the API.
 */
export async function createRenditions(asset: CmsAsset, tenantId?: string, source?: File): Promise<number> {
  if (!isConvertibleImage(asset.mimeType)) return 0;
  const widths = renditionWidths(asset.width);
  if (widths.length === 0) return 0;
  const file = source ?? new File([await getCmsAssetFile(asset.id, tenantId)], asset.fileName, { type: asset.mimeType });
  let made = 0;
  for (const width of widths) {
    const encoded = await encodeImage(file, { format: 'image/webp', quality: 0.8, maxWidth: width });
    if (!encoded.converted || encoded.width >= (asset.width ?? 0)) continue;
    await uploadCmsRendition(asset.id, encoded.file, tenantId);
    made += 1;
  }
  return made;
}
