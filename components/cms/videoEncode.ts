'use client';

import {
  type VideoOptions,
  isStorableVideo,
  preferConvertedVideo,
  renameForVideo,
  videoBitrate,
  videoTargetSize,
} from '@/lib/utils/media-storage';

// ---------------------------------------------------------------------------
// Compress a video in the browser before it is uploaded, for the same reasons
// images are (UI-ADR-024): the person sees the real size first, and the API
// spends no CPU on it. Mediabunny reads the file, decodes and re-encodes it
// with the browser's own WebCodecs encoder (hardware where there is one) and
// writes an H.264/AAC MP4 — the one video format every browser plays. The
// rules are in lib/utils/media-storage.ts. Loaded on demand: it is only
// needed once someone picks a video.
// ---------------------------------------------------------------------------

export interface EncodedVideo {
  /** What to upload: the compressed file, or the original when compressing only made it worse. */
  file: File;
  converted: boolean;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  /** Seconds. */
  duration: number;
  /** Roughly what the source's sound takes up; null when it has none. */
  soundBytes: number | null;
}

export class VideoEncodeCanceled extends Error {
  constructor() {
    super('Canceled');
  }
}

export async function encodeVideo(
  source: File,
  options: VideoOptions,
  { onProgress, signal }: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
): Promise<EncodedVideo> {
  // Original: the picture is copied as it is, which needs no encoder.
  const untouched = options.quality === 'original';
  if (!untouched && typeof VideoEncoder === 'undefined')
    throw new Error('This browser cannot compress video — upload the original or use Chrome, Edge or Safari');
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeVideo } =
    await import('mediabunny');

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(source) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('No video found in this file');
    const original = { width: await track.getDisplayWidth(), height: await track.getDisplayHeight() };
    const sound = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    const soundBytes = sound ? Math.round(((await sound.computePacketStats()).averageBitrate * duration) / 8) : null;
    const kept: EncodedVideo = {
      file: source,
      converted: false,
      ...original,
      originalWidth: original.width,
      originalHeight: original.height,
      duration,
      soundBytes,
    };
    // Nothing to change: a storable file, its picture kept and its sound too.
    if (untouched && (!sound || !options.removeSound) && isStorableVideo(source.type)) return kept;

    const size = untouched ? original : videoTargetSize(original.width, original.height, options.maxShortSide);
    // Original: no video options, so the picture is copied packet for packet.
    let video = {};
    if (options.quality !== 'original') {
      // An explicit bitrate below the source's, not a named level (see videoBitrate).
      const { averageBitrate } = await track.computePacketStats();
      const bitrate = videoBitrate(options.quality, { bitrate: averageBitrate, ...original }, size);
      const quality = new Quality({ bitrate, bitrateMode: 'variable' });
      if (!(await canEncodeVideo('avc', { ...size, quality }))) {
        throw new Error(`This browser cannot create ${size.width}×${size.height} MP4 video — try a smaller size`);
      }
      video = {
        ...size,
        fit: 'contain',
        codec: 'avc',
        quality,
        forceTranscode: true,
        // Bake a phone's rotation into the frames, so the stored size is the size people see.
        allowTransformationMetadata: false,
      };
    }

    const target = new BufferTarget();
    const conversion = await Conversion.init({
      input,
      output: new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target }),
      tracks: 'primary',
      video,
      // AAC sound — nearly every MP4 and phone video — is copied untouched: no
      // quality loss, and no encoder needed (Firefox has no AAC encoder). Setting
      // a `quality` here would force a re-encode. Anything else is re-encoded to
      // the first codec MP4 holds that this browser can write (AAC, else Opus).
      audio: async (audioTrack) =>
        options.removeSound ? { discard: true } : (await audioTrack.getCodec()) === 'aac' ? { codec: 'aac' } : {},
      showWarnings: false,
    });
    // A dropped audio track would upload a silent video without a word — refuse instead.
    const dropped = conversion.discardedTracks.find((track) => track.reason !== 'discarded_by_user');
    if (!conversion.isValid || dropped) {
      throw new Error(
        dropped?.track.type === 'audio'
          ? 'This browser cannot convert this video’s sound — upload the original or use Chrome, Edge or Safari'
          : 'This browser cannot read this video — upload the original',
      );
    }

    if (onProgress) conversion.onProgress = onProgress;
    const abort = () => void conversion.cancel();
    if (signal?.aborted) throw new VideoEncodeCanceled();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      await conversion.execute();
    } catch (error) {
      if (signal?.aborted) throw new VideoEncodeCanceled();
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
    }

    const candidate = new File([target.buffer!], renameForVideo(source.name), { type: 'video/mp4', lastModified: Date.now() });
    const keep = preferConvertedVideo(
      { size: source.size, type: source.type, width: original.width },
      { size: candidate.size, width: size.width, droppedSound: options.removeSound && sound !== null },
    );
    return keep
      ? { file: candidate, converted: true, ...size, originalWidth: original.width, originalHeight: original.height, duration, soundBytes }
      : kept;
  } finally {
    input.dispose();
  }
}
