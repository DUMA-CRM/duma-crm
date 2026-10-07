// ---------------------------------------------------------------------------
// Pure rules behind Content → Storage and image optimisation: the usage meter,
// quota units, what a pasted bucket URL means, and how an image is resized.
// The canvas work lives in components/cms/imageEncode.ts; the decisions are
// here so they can be tested.
// ---------------------------------------------------------------------------

export type StorageKind = 'image' | 'video' | 'audio' | 'document';

/** Fixed order: a kind keeps its colour whichever kinds are present. */
export const STORAGE_KINDS: ReadonlyArray<{ kind: StorageKind; label: string; colorClass: string }> = [
  { kind: 'image', label: 'Images', colorClass: 'bg-series-1' },
  { kind: 'video', label: 'Video', colorClass: 'bg-series-2' },
  { kind: 'audio', label: 'Audio', colorClass: 'bg-series-3' },
  { kind: 'document', label: 'Documents', colorClass: 'bg-series-4' },
];

export type MeterState = 'ok' | 'nearly' | 'full';

export interface StorageMeter {
  usedBytes: number;
  /** Null when there is no limit. */
  quotaBytes: number | null;
  freeBytes: number | null;
  /** 0–100, capped; null without a limit. */
  percentUsed: number | null;
  state: MeterState;
  /** Each kind's share of the bar's width. Without a limit the bar is the used total. */
  segments: Array<{ kind: StorageKind; bytes: number; percent: number }>;
}

/** At or past this share of the limit, the meter says "nearly full". */
export const NEARLY_FULL = 0.9;

export function storageMeter(byKind: Record<StorageKind, number>, quotaBytes: number | null): StorageMeter {
  const usedBytes = STORAGE_KINDS.reduce((sum, { kind }) => sum + Math.max(0, byKind[kind] ?? 0), 0);
  const scale = quotaBytes && quotaBytes > 0 ? Math.max(quotaBytes, usedBytes) : usedBytes;
  const segments = STORAGE_KINDS.map(({ kind }) => {
    const bytes = Math.max(0, byKind[kind] ?? 0);
    return { kind, bytes, percent: scale > 0 ? (bytes / scale) * 100 : 0 };
  }).filter((segment) => segment.bytes > 0);

  if (!quotaBytes || quotaBytes <= 0) {
    return { usedBytes, quotaBytes: null, freeBytes: null, percentUsed: null, state: 'ok', segments };
  }
  const ratio = usedBytes / quotaBytes;
  return {
    usedBytes,
    quotaBytes,
    freeBytes: Math.max(0, quotaBytes - usedBytes),
    percentUsed: Math.min(100, ratio * 100),
    state: ratio >= 1 ? 'full' : ratio >= NEARLY_FULL ? 'nearly' : 'ok',
    segments,
  };
}

// ─── Quota units ─────────────────────────────────────────────────────────────

export const QUOTA_UNITS = ['MB', 'GB', 'TB'] as const;
export type QuotaUnit = (typeof QUOTA_UNITS)[number];
const UNIT_BYTES: Record<QuotaUnit, number> = { MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

/** "10" + GB → bytes. Blank means no limit (null); anything unusable is undefined. */
export function quotaToBytes(value: string, unit: QuotaUnit): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Math.round(amount * UNIT_BYTES[unit]);
}

/** The largest unit that shows the quota as a whole-ish number, for editing. */
export function bytesToQuota(bytes: number | null): { value: string; unit: QuotaUnit } {
  if (!bytes || bytes <= 0) return { value: '', unit: 'GB' };
  const unit = [...QUOTA_UNITS].reverse().find((candidate) => bytes >= UNIT_BYTES[candidate]) ?? 'MB';
  const amount = bytes / UNIT_BYTES[unit];
  return { value: String(Number.isInteger(amount) ? amount : Number(amount.toFixed(2))), unit };
}

// ─── Bucket URLs ─────────────────────────────────────────────────────────────

export type S3Preset = 'r2' | 'aws' | 'other';

/**
 * What a person pastes from a provider dashboard. Cloudflare shows
 * `https://<account>.r2.cloudflarestorage.com/<bucket>`, so a path is the
 * bucket. Returns null for something that is not a URL.
 */
export function parseBucketUrl(raw: string): { endpoint: string; bucket: string; preset: S3Preset } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const bucket = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';
  const preset: S3Preset = url.hostname.endsWith('.r2.cloudflarestorage.com')
    ? 'r2'
    : url.hostname.endsWith('.amazonaws.com')
      ? 'aws'
      : 'other';
  return { endpoint: url.origin, bucket, preset };
}

// ─── Images ──────────────────────────────────────────────────────────────────

export type ImageFormat = 'original' | 'image/webp' | 'image/jpeg' | 'image/png' | 'image/avif';

/** `short` fits under the label on a format card; `hint` is the full sentence. */
export const IMAGE_FORMATS: ReadonlyArray<{ value: ImageFormat; label: string; short: string; hint: string }> = [
  { value: 'image/webp', label: 'WebP', short: 'Smallest · recommended', hint: 'Smallest for photos and graphics; every current browser' },
  {
    value: 'image/avif',
    label: 'AVIF',
    short: 'Smaller still · slower',
    hint: 'Smaller still; slower to encode, not every browser can create it',
  },
  { value: 'image/jpeg', label: 'JPEG', short: 'Photos · no transparency', hint: 'Photos, everywhere; no transparency' },
  { value: 'image/png', label: 'PNG', short: 'Lossless · large', hint: 'Lossless; large for photos' },
  { value: 'original', label: 'Keep format', short: 'Only resize and recompress', hint: 'Only resize and recompress' },
];

/**
 * What the browser can decode and re-encode faithfully. GIF is left alone
 * (re-encoding drops its animation) and SVG is already as small as it gets.
 */
export const isConvertibleImage = (mimeType: string) => ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(mimeType);

/** Formats with a quality knob. PNG is lossless, so quality does nothing there. */
export const hasQuality = (mimeType: string) => mimeType !== 'image/png';

export interface ImageOptions {
  format: ImageFormat;
  /** 0.1–1. */
  quality: number;
  /** The width stays at or under this; null keeps the size. */
  maxWidth: number | null;
  /** Source-pixel rectangle to keep; null keeps the whole image. */
  crop?: CropRect | null;
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = { format: 'image/webp', quality: 0.82, maxWidth: 2560 };

export const MAX_WIDTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Original size' },
  { value: '3840', label: '3840 px (4K)' },
  { value: '2560', label: '2560 px' },
  { value: '1920', label: '1920 px (full HD)' },
  { value: '1280', label: '1280 px' },
  { value: '800', label: '800 px' },
];

/** Scale down to fit `maxWidth` on the width, never up; whole pixels, at least 1. */
export function targetSize(width: number, height: number, maxWidth: number | null): { width: number; height: number } {
  if (!maxWidth || width <= maxWidth) return { width, height };
  const scale = maxWidth / width;
  return { width: maxWidth, height: Math.max(1, Math.round(height * scale)) };
}

export const outputMimeType = (sourceType: string, format: ImageFormat) => (format === 'original' ? sourceType : format);

const EXTENSIONS: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/avif': 'avif' };

/** `holiday.PNG` → `holiday.webp`. The base name is kept so the file stays recognisable. */
export function renameForType(fileName: string, mimeType: string): string {
  const extension = EXTENSIONS[mimeType];
  if (!extension) return fileName;
  const base = fileName.replace(/\.[^./\\]+$/, '') || 'image';
  return `${base}.${extension}`;
}

/**
 * Use the converted file, or keep the original? A conversion that grew the
 * file is only worth keeping when the person asked for a different format or
 * a smaller size, or cropped it — otherwise it is just a worse copy.
 */
export function preferConverted(
  original: { size: number; type: string; width: number },
  converted: { size: number; type: string; width: number; cropped?: boolean },
): boolean {
  if (converted.size < original.size || converted.cropped) return true;
  return converted.type !== original.type || converted.width < original.width;
}

/** "−64%", "+12%" or "same", relative to the original. */
export function sizeChange(before: number, after: number): string {
  if (before <= 0) return 'same';
  const change = Math.round(((after - before) / before) * 100);
  if (change === 0) return 'same';
  return change < 0 ? `−${Math.abs(change)}%` : `+${change}%`;
}

// ─── Crop ────────────────────────────────────────────────────────────────────

/** A rectangle in the source image's own pixels. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

/** `original` keeps the image's own shape; `free` is unconstrained. */
export const CROP_ASPECTS: ReadonlyArray<{ value: string; label: string; ratio: number | 'original' | null }> = [
  { value: 'free', label: 'Free', ratio: null },
  { value: 'original', label: 'Original', ratio: 'original' },
  { value: '1:1', label: '1:1', ratio: 1 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: '4:5', label: '4:5', ratio: 4 / 5 },
];

/** Smallest crop edge, in source pixels, so a stray drag cannot collapse it. */
export const MIN_CROP = 16;

export function aspectRatioOf(value: string, width: number, height: number): number | null {
  const ratio = CROP_ASPECTS.find((aspect) => aspect.value === value)?.ratio ?? null;
  return ratio === 'original' ? width / height : ratio;
}

/** The largest centred rectangle of `ratio` inside the image (the whole image when free). */
export function centeredCrop(width: number, height: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, width, height };
  const cropWidth = Math.min(width, height * ratio);
  const cropHeight = cropWidth / ratio;
  return round({ x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight });
}

const round = (rect: CropRect): CropRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.round(rect.width),
  height: Math.round(rect.height),
});

/** Is this crop the whole image — i.e. no crop at all? */
export const isFullCrop = (rect: CropRect, width: number, height: number) =>
  rect.x <= 0 && rect.y <= 0 && rect.width >= width && rect.height >= height;

/**
 * Apply a drag of (dx, dy) source pixels to one handle. Moving keeps the size
 * and stays inside the image; a corner resizes from the opposite corner,
 * holding `ratio` when one is set, never smaller than MIN_CROP and never past
 * the image's edge.
 */
export function dragCrop(
  start: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: { width: number; height: number },
  ratio: number | null,
): CropRect {
  if (handle === 'move') {
    return round({
      ...start,
      x: Math.min(Math.max(0, start.x + dx), bounds.width - start.width),
      y: Math.min(Math.max(0, start.y + dy), bounds.height - start.height),
    });
  }

  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  // The fixed corner, and how much room there is beyond it in the drag direction.
  const anchorX = west ? start.x + start.width : start.x;
  const anchorY = north ? start.y + start.height : start.y;
  const roomX = west ? anchorX : bounds.width - anchorX;
  const roomY = north ? anchorY : bounds.height - anchorY;

  let width = Math.min(roomX, Math.max(MIN_CROP, start.width + (west ? -dx : dx)));
  let height = Math.min(roomY, Math.max(MIN_CROP, start.height + (north ? -dy : dy)));
  if (ratio) {
    // Follow whichever edge moved further, then fit the other within the room left.
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    if (width > roomX) {
      width = roomX;
      height = width / ratio;
    }
    if (height > roomY) {
      height = roomY;
      width = height * ratio;
    }
  }
  return round({ x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height });
}

// ─── Responsive sizes ────────────────────────────────────────────────────────

/** The widths sites most often lay images out at: a phone column, a tablet/half-width, a full desktop width. */
export const RENDITION_WIDTHS = [480, 960, 1600] as const;

/**
 * Which smaller copies an image of `width` gets: each standard width that is
 * meaningfully smaller (under 90%) than the original — a 1000px image gets
 * 480 and 960 is skipped, since a copy nearly the original's size saves nothing.
 */
export const renditionWidths = (width: number | null) =>
  width ? RENDITION_WIDTHS.filter((candidate) => candidate < width * 0.9) : [];

/** A focal point from a click on the image, clamped to the picture and rounded to 3 places. */
/**
 * A focal point on the original, as it lands on the cropped image. A point the
 * crop cut away moves to the nearest edge of what is kept — the subject was
 * that way.
 */
export function focalAfterCrop(
  focal: { x: number; y: number },
  crop: { x: number; y: number; width: number; height: number } | null | undefined,
  natural: { width: number; height: number },
): { x: number; y: number } {
  if (!crop || crop.width <= 0 || crop.height <= 0) return focal;
  const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
  return {
    x: clamp((focal.x * natural.width - crop.x) / crop.width),
    y: clamp((focal.y * natural.height - crop.y) / crop.height),
  };
}

export function focalFromClick(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  const clamp = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
  return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
}
