'use client';

import { useEffect, useMemo, useState } from 'react';

import { Crop, RotateCcw, Target } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  CROP_ASPECTS,
  type CropRect,
  DEFAULT_IMAGE_OPTIONS,
  IMAGE_FORMATS,
  type ImageOptions,
  MAX_WIDTH_OPTIONS,
  aspectRatioOf,
  centeredCrop,
  focalAfterCrop,
  focalFromClick,
  hasQuality,
  isConvertibleImage,
  isFullCrop,
  outputMimeType,
  sizeChange,
} from '@/lib/utils/media-storage';

import { CropFrame } from './CropFrame';
import { type EncodedImage, canEncode, encodeImage } from './imageEncode';

type Result = { status: 'pending' } | { status: 'done'; image: EncodedImage } | { status: 'failed'; message: string };

const LABEL = 'text-label uppercase text-muted-foreground';

/**
 * Crop, convert and compress images before they are stored, and see what each
 * one will weigh before committing. One image gets the full stage with a crop
 * frame; several get a list (cropping is one image at a time). Files that are
 * not convertible images (video, PDF, GIF, SVG) pass through untouched.
 *
 * `replace` is the drawer's "Edit image" — one existing image. It also holds
 * the image's focal point: set alone it is saved without touching the file;
 * with a crop it moves with the crop.
 */
export function ImageOptionsDialog({
  files,
  mode,
  freeBytes,
  isPending,
  onConfirm,
  onClose,
  focal = null,
  onSaveFocal,
}: {
  files: File[];
  mode: 'upload' | 'replace';
  /** The image's focal point now — `replace` only. */
  focal?: { x: number; y: number } | null;
  /** Save a new focal point without replacing the file; enables the Focus tool. */
  onSaveFocal?: (focal: { x: number; y: number } | null) => void;
  /** Space left where uploads go; null when there is no limit. */
  freeBytes: number | null;
  isPending: boolean;
  /** `focal` is set when the focal point changed or a crop moved it. */
  onConfirm: (files: File[], focal?: { x: number; y: number } | null) => void;
  onClose: () => void;
}) {
  const images = useMemo(() => files.filter((file) => isConvertibleImage(file.type)), [files]);
  const others = useMemo(() => files.filter((file) => !isConvertibleImage(file.type)), [files]);
  const single = images.length === 1 ? images[0]! : null;

  const [options, setOptions] = useState<ImageOptions>(DEFAULT_IMAGE_OPTIONS);
  const [formats, setFormats] = useState(IMAGE_FORMATS.filter((format) => format.value !== 'image/avif'));
  const [results, setResults] = useState<Map<File, Result>>(new Map());
  const [tool, setTool] = useState<'edit' | 'focus'>('edit');
  const [focalDraft, setFocalDraft] = useState(focal);

  // Crop state: the frame follows the pointer live; the encode runs on release.
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [aspect, setAspect] = useState<string>('none');
  const [liveCrop, setLiveCrop] = useState<CropRect | null>(null);
  const ratio = natural && aspect !== 'none' ? aspectRatioOf(aspect, natural.width, natural.height) : null;

  // One object URL per file for previews, released when the dialog goes.
  const previews = useMemo(() => new Map(images.map((file) => [file, URL.createObjectURL(file)])), [images]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  useEffect(() => {
    void canEncode('image/avif').then((supported) => {
      if (supported) setFormats([...IMAGE_FORMATS]);
    });
  }, []);

  // Re-encode on every committed change, debounced, one file at a time; a newer change abandons the run.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setResults(new Map(images.map((file) => [file, { status: 'pending' } as Result])));
      for (const file of images) {
        let result: Result;
        try {
          result = { status: 'done', image: await encodeImage(file, single ? options : { ...options, crop: null }) };
        } catch (error) {
          result = { status: 'failed', message: error instanceof Error ? error.message : 'Could not convert' };
        }
        if (cancelled) return;
        setResults((current) => new Map(current).set(file, result));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [images, options, single]);

  const chooseAspect = (value: string) => {
    setAspect(value);
    if (!natural || value === 'none') {
      setLiveCrop(null);
      setOptions((current) => ({ ...current, crop: null }));
      return;
    }
    // Free starts from a gentle inset so the frame is visible; a ratio starts at its largest centred fit.
    const next =
      value === 'free'
        ? {
            x: Math.round(natural.width * 0.05),
            y: Math.round(natural.height * 0.05),
            width: Math.round(natural.width * 0.9),
            height: Math.round(natural.height * 0.9),
          }
        : centeredCrop(natural.width, natural.height, aspectRatioOf(value, natural.width, natural.height));
    setLiveCrop(next);
    setOptions((current) => ({ ...current, crop: next }));
  };

  const outputs = images.map((file) => {
    const result = results.get(file);
    return result?.status === 'done' ? result.image.file : file;
  });
  const busy = images.some((file) => results.get(file)?.status === 'pending' || !results.has(file));
  const before = files.reduce((sum, file) => sum + file.size, 0);
  const after = outputs.reduce((sum, file) => sum + file.size, 0) + others.reduce((sum, file) => sum + file.size, 0);
  const overLimit = freeBytes !== null && after > freeBytes;
  const outputType = images[0] ? outputMimeType(images[0].type, options.format) : options.format;
  const singleResult = single ? results.get(single) : undefined;
  const cropped = Boolean(natural && options.crop && !isFullCrop(options.crop, natural.width, natural.height));
  const canFocus = mode === 'replace' && Boolean(single) && Boolean(onSaveFocal);
  const focalChanged = JSON.stringify(focalDraft) !== JSON.stringify(focal);
  // Only the focal point moved: save it, and leave the file — and its URL — alone.
  const fileTouched =
    cropped ||
    options.format !== DEFAULT_IMAGE_OPTIONS.format ||
    options.quality !== DEFAULT_IMAGE_OPTIONS.quality ||
    options.maxWidth !== DEFAULT_IMAGE_OPTIONS.maxWidth;
  const focusOnly = canFocus && focalChanged && !fileTouched;
  const focalForFile =
    focalDraft && natural && (focalChanged || cropped)
      ? focalAfterCrop(focalDraft, cropped ? options.crop : null, natural)
      : focalChanged
        ? null
        : undefined;

  return (
    <Modal
      title={mode === 'replace' ? 'Edit image' : images.length === 1 ? 'Prepare image' : `Prepare ${images.length} images`}
      description={
        mode === 'replace'
          ? 'Crop, convert or compress — the new file replaces this one and entries keep working. Or just set its focus point.'
          : 'Smaller files load faster on your website and use less storage. Nothing is uploaded until you confirm.'
      }
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn('text-xs tabular-nums', overLimit ? 'font-medium text-exception' : 'text-muted-foreground')}>
            {freeBytes === null
              ? 'No storage limit'
              : overLimit
                ? `${formatBytes(after - freeBytes)} more than the space left`
                : `${formatBytes(freeBytes - after)} free afterwards`}
          </p>
          <div className="flex gap-2">
            {mode === 'upload' && (
              <Button variant="ghost" disabled={isPending} onClick={() => onConfirm(files)}>
                Upload originals
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {focusOnly ? (
              <Button className="min-w-32" disabled={isPending} onClick={() => onSaveFocal!(focalDraft)}>
                {isPending ? 'Saving…' : 'Save focus point'}
              </Button>
            ) : (
              <Button
                className="min-w-32"
                disabled={busy || isPending || overLimit}
                onClick={() => onConfirm([...outputs, ...others], focalForFile)}
              >
                {isPending
                  ? mode === 'replace'
                    ? 'Replacing…'
                    : 'Uploading…'
                  : busy
                    ? 'Preparing…'
                    : mode === 'replace'
                      ? 'Replace file'
                      : `Upload ${files.length === 1 ? 'image' : `${files.length} files`}`}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ── The stage ── */}
        <div className="flex min-w-0 flex-col gap-3">
          {canFocus && (
            <SegmentedControl<'edit' | 'focus'>
              ariaLabel="Tool"
              className="self-start"
              value={tool}
              onChange={setTool}
              options={[
                { value: 'edit', label: 'Crop', icon: Crop },
                { value: 'focus', label: 'Focus point', icon: Target },
              ]}
            />
          )}
          {single && tool === 'focus' ? (
            <>
              <div className="flex min-h-72 items-center justify-center rounded-lg bg-band/60 p-4">
                <button
                  type="button"
                  className="relative block cursor-crosshair"
                  aria-label="Set the focus point — click where the subject is"
                  onClick={(event) =>
                    setFocalDraft(focalFromClick(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                  <img
                    src={previews.get(single)}
                    alt={single.name}
                    draggable={false}
                    className="block max-h-[min(56vh,32rem)] w-auto max-w-full"
                  />
                  {focalDraft && <FocalMarker focal={focalDraft} />}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target size={13} aria-hidden="true" />
                <span className="flex-1">
                  {focalDraft
                    ? `Focus ${Math.round(focalDraft.x * 100)}% · ${Math.round(focalDraft.y * 100)}% — crops on your website keep this spot in frame.`
                    : 'Click the subject. Crops on your website — a square card, a wide banner — keep it in frame.'}
                </span>
                {focalDraft && (
                  <Button variant="ghost" size="xs" className="gap-1" onClick={() => setFocalDraft(null)}>
                    <RotateCcw size={12} aria-hidden="true" /> Clear
                  </Button>
                )}
              </div>
            </>
          ) : single ? (
            <>
              <div className="flex min-h-72 items-center justify-center rounded-lg bg-band/60 p-4">
                <CropFrame
                  src={previews.get(single)!}
                  alt={single.name}
                  natural={natural}
                  crop={liveCrop}
                  ratio={ratio}
                  enabled={aspect !== 'none'}
                  onLoad={setNatural}
                  onChange={setLiveCrop}
                  onCommit={(crop) => setOptions((current) => ({ ...current, crop }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn(LABEL, 'mr-1 inline-flex items-center gap-1.5')}>
                  <Crop size={13} aria-hidden="true" /> Crop
                </span>
                {[{ value: 'none', label: 'None' }, ...CROP_ASPECTS].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={aspect === option.value}
                    disabled={!natural}
                    onClick={() => chooseAspect(option.value)}
                    className={cn(
                      'h-7 rounded-md border px-2.5 text-xs font-medium tabular-nums transition-colors disabled:opacity-45',
                      aspect === option.value
                        ? 'border-primary bg-primary/8 text-foreground'
                        : 'border-rule/60 text-muted-foreground hover:border-rule hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                {cropped && (
                  <Button variant="ghost" size="xs" className="ml-auto gap-1" onClick={() => chooseAspect('none')}>
                    <RotateCcw size={12} aria-hidden="true" /> Reset
                  </Button>
                )}
              </div>
            </>
          ) : (
            <ul className="max-h-[min(56vh,32rem)] divide-y divide-rule/50 overflow-auto rounded-lg border border-rule/60">
              {images.map((file) => {
                const result = results.get(file);
                return (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 px-3 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                    <img src={previews.get(file)} alt="" className="size-12 shrink-0 rounded-md bg-band object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {result?.status === 'done' ? result.image.file.name : file.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {result?.status === 'done'
                          ? result.image.converted
                            ? `${result.image.originalWidth}×${result.image.originalHeight} → ${result.image.width}×${result.image.height}`
                            : 'Already as small as it gets — kept as it is'
                          : result?.status === 'failed'
                            ? result.message
                            : 'Preparing…'}
                      </span>
                    </span>
                    <SizeDelta before={file.size} after={result?.status === 'done' ? result.image.file.size : null} />
                  </li>
                );
              })}
              {others.map((file) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-band font-mono text-[0.625rem] uppercase text-muted-foreground">
                    {file.name.split('.').pop()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{file.name}</span>
                    <span className="block text-xs text-muted-foreground">Uploaded as it is</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
          {images.length > 1 && (
            <p className="text-xs text-muted-foreground">Cropping works on one image at a time — upload it on its own to crop.</p>
          )}
        </div>

        {/* ── Settings ── */}
        <div className="flex flex-col gap-6">
          <fieldset className="space-y-2">
            <legend className={LABEL}>Format</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {formats.map((format) => (
                <Tooltip
                  side="top"
                  key={format.value}
                  label={format.hint}
                  // The tooltip's wrapper is the grid item: it fills the cell, and spans when left alone on the last row.
                  className={cn('flex', format.value === 'original' && formats.length % 2 === 1 && 'col-span-2')}
                >
                  <button
                    type="button"
                    aria-pressed={options.format === format.value}
                    onClick={() => setOptions({ ...options, format: format.value })}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      options.format === format.value ? 'border-primary bg-primary/6' : 'border-rule/60 hover:border-rule hover:bg-band/40',
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">{format.label}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted-foreground">{format.short}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            {hasQuality(outputType) ? (
              <Slider
                label="Quality"
                min={0.4}
                max={1}
                step={0.01}
                value={options.quality}
                formatValue={(value) => `${Math.round(value * 100)}%`}
                onValueChange={(quality) => setOptions({ ...options, quality })}
              />
            ) : (
              <p className="rounded-md bg-band/50 px-3 py-2 text-xs text-muted-foreground">
                PNG is lossless — only cropping or resizing makes it smaller.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className={LABEL}>Maximum width</p>
            <Select
              ariaLabel="Maximum width"
              className="w-full"
              value={options.maxWidth ? String(options.maxWidth) : ''}
              onValueChange={(value) => setOptions({ ...options, maxWidth: value ? Number(value) : null })}
              options={[...MAX_WIDTH_OPTIONS]}
            />
          </div>

          {/* The answer to "was it worth it": what it was, what it will be. */}
          <div className="mt-auto rounded-lg border border-rule/60 p-4">
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Original</dt>
              <dd className="text-right tabular-nums text-muted-foreground">
                {formatBytes(before)}
                {single && natural && (
                  <span className="ml-2 text-xs">
                    {natural.width}×{natural.height}
                  </span>
                )}
              </dd>
              <dt className="font-medium text-foreground">Result</dt>
              <dd className="text-right tabular-nums font-semibold text-foreground">
                {busy ? (
                  <span className="font-normal text-muted-foreground">Preparing…</span>
                ) : (
                  <>
                    {formatBytes(after)}
                    {singleResult?.status === 'done' && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {singleResult.image.width}×{singleResult.image.height}
                      </span>
                    )}
                  </>
                )}
              </dd>
            </dl>
            {!busy && after !== before && (
              <p
                className={cn(
                  'mt-3 border-t border-rule/50 pt-3 text-right text-xl font-semibold tabular-nums',
                  after < before ? 'text-momentum' : 'text-measured',
                )}
              >
                {sizeChange(before, after)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{after < before ? 'smaller' : 'larger'}</span>
              </p>
            )}
            {singleResult?.status === 'failed' && <p className="mt-3 text-xs text-exception">{singleResult.message}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SizeDelta({ before, after }: { before: number; after: number | null }) {
  return (
    <span className="shrink-0 text-right text-xs tabular-nums">
      <span className="block text-muted-foreground">{formatBytes(before)}</span>
      {after !== null && after !== before && (
        <span className={cn('block font-medium', after < before ? 'text-momentum' : 'text-measured')}>
          {formatBytes(after)} · {sizeChange(before, after)}
        </span>
      )}
    </span>
  );
}

/** The focus point's crosshair, drawn over an image at its position. */
export function FocalMarker({ focal }: { focal: { x: number; y: number } }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgb(0_0_0/0.5)]"
      style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
    >
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
    </span>
  );
}
