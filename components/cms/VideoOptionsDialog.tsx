'use client';

import { useEffect, useMemo, useState } from 'react';

import { Switch } from '@/components/settings/controls';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  DEFAULT_VIDEO_OPTIONS,
  MAX_ASSET_BYTES,
  VIDEO_QUALITIES,
  VIDEO_SIZE_OPTIONS,
  type VideoOptions,
  isConvertibleVideo,
  isStorableVideo,
  sizeChange,
} from '@/lib/utils/media-storage';

import { type EncodedVideo, VideoEncodeCanceled, encodeVideo } from './videoEncode';

type Result =
  | { status: 'waiting' }
  | { status: 'working'; progress: number }
  | { status: 'done'; video: EncodedVideo }
  | { status: 'failed'; message: string };

const LABEL = 'text-label uppercase text-muted-foreground';

/**
 * Compress videos before they are stored — the video twin of
 * ImageOptionsDialog. Encoding starts as soon as the dialog opens and starts
 * again when a setting changes; one video gets a player to compare the result
 * with the original. Files that are not videos pass through untouched.
 *
 * `replace` is the drawer's "Compress video" — one existing video, replaced
 * under the same asset id.
 */
export function VideoOptionsDialog({
  files,
  mode,
  freeBytes,
  isPending,
  onConfirm,
  onClose,
}: {
  files: File[];
  mode: 'upload' | 'replace';
  /** Space left where uploads go; null when there is no limit. */
  freeBytes: number | null;
  isPending: boolean;
  onConfirm: (files: File[]) => void;
  onClose: () => void;
}) {
  const videos = useMemo(() => files.filter((file) => isConvertibleVideo(file.type)), [files]);
  const others = useMemo(() => files.filter((file) => !isConvertibleVideo(file.type)), [files]);
  const single = videos.length === 1 ? videos[0]! : null;

  const [options, setOptions] = useState<VideoOptions>(DEFAULT_VIDEO_OPTIONS);
  const [results, setResults] = useState<Map<File, Result>>(new Map());
  const [showing, setShowing] = useState<'result' | 'original'>('result');

  // Encode one file at a time; a settings change aborts the run and starts over.
  useEffect(() => {
    const controller = new AbortController();
    const set = (file: File, result: Result) => {
      if (!controller.signal.aborted) setResults((current) => new Map(current).set(file, result));
    };
    const timer = setTimeout(async () => {
      setResults(new Map(videos.map((file) => [file, { status: 'waiting' } as Result])));
      for (const file of videos) {
        set(file, { status: 'working', progress: 0 });
        try {
          const video = await encodeVideo(file, options, {
            signal: controller.signal,
            onProgress: (progress) => set(file, { status: 'working', progress }),
          });
          set(file, { status: 'done', video });
        } catch (error) {
          if (error instanceof VideoEncodeCanceled) return;
          set(file, { status: 'failed', message: error instanceof Error ? error.message : 'Could not compress' });
        }
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [videos, options]);

  // One object URL per video shown in the player, released when it changes.
  const singleResult = single ? results.get(single) : undefined;
  const playing = single && showing === 'result' && singleResult?.status === 'done' ? singleResult.video.file : single;
  const playerSrc = useMemo(() => (playing ? URL.createObjectURL(playing) : null), [playing]);
  useEffect(() => () => void (playerSrc && URL.revokeObjectURL(playerSrc)), [playerSrc]);
  // Which source the browser refused to play (Firefox cannot play an iPhone's HEVC, for one).
  const [unplayable, setUnplayable] = useState<string | null>(null);

  const outputs = videos.map((file) => {
    const result = results.get(file);
    return result?.status === 'done' ? result.video.file : file;
  });
  const busy = videos.some((file) => results.get(file)?.status !== 'done' && results.get(file)?.status !== 'failed');
  // A video the API cannot take as it is (a .mov) and could not be converted blocks the upload.
  const unusable = videos.filter((file) => results.get(file)?.status === 'failed' && !isStorableVideo(file.type));
  const tooLarge = outputs.filter((file) => file.size > MAX_ASSET_BYTES);
  const before = files.reduce((sum, file) => sum + file.size, 0);
  const after = outputs.reduce((sum, file) => sum + file.size, 0) + others.reduce((sum, file) => sum + file.size, 0);
  const overLimit = freeBytes !== null && after > freeBytes;
  // Replacing a video with itself would only churn its URL.
  const unchanged = mode === 'replace' && outputs.every((file, index) => file === videos[index]);
  const blocked = busy || isPending || overLimit || unchanged || unusable.length > 0 || tooLarge.length > 0;
  // What the sound takes up, from the finished videos — the reason to remove it.
  const done = videos.flatMap((file) => {
    const result = results.get(file);
    return result?.status === 'done' ? [result.video] : [];
  });
  const soundBytes = done.reduce((sum, video) => sum + (video.soundBytes ?? 0), 0);
  const silent = done.length === videos.length && done.every((video) => video.soundBytes === null);
  const progress =
    videos.length === 0
      ? 1
      : videos.reduce((sum, file) => {
          const result = results.get(file);
          return sum + (result?.status === 'working' ? result.progress : result?.status === 'done' || result?.status === 'failed' ? 1 : 0);
        }, 0) / videos.length;

  return (
    <Modal
      title={mode === 'replace' ? 'Compress video' : videos.length === 1 ? 'Prepare video' : `Prepare ${videos.length} videos`}
      description={
        mode === 'replace'
          ? 'The compressed file replaces this one and entries keep working.'
          : 'Compressed to MP4 in your browser — smaller files start playing sooner and use less storage. Nothing is uploaded until you confirm.'
      }
      size="2xl"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={cn(
              'text-xs tabular-nums',
              overLimit || tooLarge.length > 0 || unusable.length > 0 ? 'font-medium text-exception' : 'text-muted-foreground',
            )}
          >
            {unusable.length > 0
              ? `${unusable.map((file) => file.name).join(', ')} can only be stored as MP4 or WebM`
              : !busy && tooLarge.length > 0
                ? `${tooLarge.map((file) => file.name).join(', ')} is still over ${formatBytes(MAX_ASSET_BYTES)} — try a smaller size or quality`
                : freeBytes === null
                  ? 'No storage limit'
                  : overLimit
                    ? `${formatBytes(after - freeBytes)} more than the space left`
                    : `${formatBytes(freeBytes - after)} free afterwards`}
          </p>
          <div className="flex gap-2">
            {mode === 'upload' && videos.every((file) => isStorableVideo(file.type)) && (
              <Button variant="ghost" disabled={isPending} onClick={() => onConfirm(files)}>
                Upload originals
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button className="min-w-32" disabled={blocked} onClick={() => onConfirm([...outputs, ...others])}>
              {isPending
                ? mode === 'replace'
                  ? 'Replacing…'
                  : 'Uploading…'
                : busy
                  ? `Compressing… ${Math.round(progress * 100)}%`
                  : mode === 'replace'
                    ? 'Replace file'
                    : `Upload ${files.length === 1 ? 'video' : `${files.length} files`}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_19rem]">
        {/* ── The stage ── */}
        <div className="flex min-w-0 flex-col gap-3">
          {single ? (
            <>
              <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg bg-black">
                {playerSrc && unplayable === playerSrc ? (
                  <p className="max-w-sm px-6 text-center text-sm text-white/70">
                    This browser cannot play {playing === single ? 'the original' : 'this video'} — it can still be compressed and uploaded.
                  </p>
                ) : (
                  playerSrc && (
                    <video
                      key={playerSrc}
                      src={playerSrc}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => setUnplayable(playerSrc)}
                      className="block max-h-[min(56vh,32rem)] w-auto max-w-full"
                    />
                  )
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl<'result' | 'original'>
                  ariaLabel="Play"
                  value={showing}
                  onChange={setShowing}
                  options={[
                    { value: 'result', label: 'Result' },
                    { value: 'original', label: 'Original' },
                  ]}
                />
                <span className="text-xs text-muted-foreground">
                  {singleResult?.status === 'done'
                    ? singleResult.video.converted
                      ? 'Compare the two before uploading.'
                      : options.quality === 'original'
                        ? 'Nothing to change — the original is kept as it is.'
                        : 'Already well compressed — compressing again would not make it smaller, so the original is kept.'
                    : singleResult?.status === 'failed'
                      ? singleResult.message
                      : 'The result plays here once it is ready.'}
                </span>
              </div>
              <Progress result={singleResult} />
            </>
          ) : (
            <ul className="max-h-[min(56vh,32rem)] divide-y divide-rule/50 overflow-auto rounded-lg border border-rule/60">
              {videos.map((file) => {
                const result = results.get(file);
                return (
                  <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex flex-col gap-2 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {result?.status === 'done' ? result.video.file.name : file.name}
                        </span>
                        <span
                          className={cn('block truncate text-xs', result?.status === 'failed' ? 'text-exception' : 'text-muted-foreground')}
                        >
                          {result?.status === 'done'
                            ? result.video.converted
                              ? `${result.video.originalWidth}×${result.video.originalHeight} → ${result.video.width}×${result.video.height}`
                              : options.quality === 'original'
                                ? 'Nothing to change — kept as it is'
                                : 'Already as small as it gets — kept as it is'
                            : result?.status === 'failed'
                              ? result.message
                              : result?.status === 'working'
                                ? `Compressing… ${Math.round(result.progress * 100)}%`
                                : 'Waiting…'}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums">
                        <span className="block text-muted-foreground">{formatBytes(file.size)}</span>
                        {result?.status === 'done' && result.video.file.size !== file.size && (
                          <span className={cn('block font-medium', result.video.file.size < file.size ? 'text-momentum' : 'text-measured')}>
                            {formatBytes(result.video.file.size)} · {sizeChange(file.size, result.video.file.size)}
                          </span>
                        )}
                      </span>
                    </div>
                    {result?.status === 'working' && <Progress result={result} />}
                  </li>
                );
              })}
              {others.map((file) => (
                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{file.name}</span>
                    <span className="block text-xs text-muted-foreground">Uploaded as it is</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Keep this window open while it works — a long video takes a while.</p>
        </div>

        {/* ── Settings ── */}
        <div className="flex flex-col gap-6">
          <fieldset className="space-y-2">
            <legend className={LABEL}>Quality</legend>
            <div className="grid gap-1.5">
              {VIDEO_QUALITIES.map((quality) => (
                <Tooltip side="left" key={quality.value} label={quality.hint} className="flex">
                  <button
                    type="button"
                    aria-pressed={options.quality === quality.value}
                    onClick={() => setOptions({ ...options, quality: quality.value })}
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      options.quality === quality.value
                        ? 'border-primary bg-primary/6'
                        : 'border-rule/60 hover:border-rule hover:bg-band/40',
                    )}
                  >
                    <span className="block text-sm font-semibold text-foreground">{quality.label}</span>
                    <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted-foreground">{quality.hint}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <p className={LABEL}>Maximum size</p>
            <Select
              ariaLabel="Maximum size"
              className="w-full"
              // Original keeps the picture, size included.
              disabled={options.quality === 'original'}
              value={options.maxShortSide ? String(options.maxShortSide) : ''}
              onValueChange={(value) => setOptions({ ...options, maxShortSide: value ? Number(value) : null })}
              options={[...VIDEO_SIZE_OPTIONS]}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Remove sound</p>
              <p className="mt-0.5 text-[0.6875rem] leading-4 text-muted-foreground">
                {silent
                  ? 'This video has no sound.'
                  : soundBytes > 0
                    ? `The sound takes about ${formatBytes(soundBytes)}. Fine for backgrounds and loops that play muted.`
                    : 'For backgrounds and loops that play muted.'}
              </p>
            </div>
            <Switch
              label="Remove sound"
              checked={options.removeSound && !silent}
              disabled={silent}
              onChange={(removeSound) => setOptions({ ...options, removeSound })}
            />
          </div>

          <div className="mt-auto rounded-lg border border-rule/60 p-4">
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Original</dt>
              <dd className="text-right tabular-nums text-muted-foreground">
                {formatBytes(before)}
                {singleResult?.status === 'done' && (
                  <span className="ml-2 text-xs">
                    {singleResult.video.originalWidth}×{singleResult.video.originalHeight}
                  </span>
                )}
              </dd>
              <dt className="font-medium text-foreground">Result</dt>
              <dd className="text-right tabular-nums font-semibold text-foreground">
                {busy ? (
                  <span className="font-normal text-muted-foreground">Compressing…</span>
                ) : (
                  <>
                    {formatBytes(after)}
                    {singleResult?.status === 'done' && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {singleResult.video.width}×{singleResult.video.height}
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
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Progress({ result }: { result: Result | undefined }) {
  if (result?.status !== 'working') return null;
  const percent = Math.round(result.progress * 100);
  return (
    <div
      role="progressbar"
      aria-label="Compressing"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 overflow-hidden rounded-full bg-band"
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}
