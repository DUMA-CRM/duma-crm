'use client';

import jsQR from 'jsqr';
import { Loader2, RefreshCw, SwitchCamera, VideoOff } from '@/components/icons';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

interface QrScannerProps {
  /** Called with the decoded text. Re-reads of the same code are throttled so a
   *  QR held in front of the camera doesn't fire repeatedly. */
  onScan: (value: string) => void;
  /** Pauses decoding (e.g. while a customer lookup is in flight). */
  paused?: boolean;
}

/**
 * Live camera QR scanner. Uses the rear ("environment") camera and decodes
 * frames with jsQR — pure JS, so it also works where the native
 * BarcodeDetector API doesn't exist (iPads). Requires a secure context
 * (HTTPS or localhost) for camera access.
 */
export function QrScanner({ onScan, paused = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which camera to use — the flip button toggles it and restarts the stream.
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  // Bumped by Try again: re-runs the camera effect after a denied or missing camera.
  const [attempt, setAttempt] = useState(0);

  // Refs so the long-lived decode loop reads fresh values without restarting
  // the camera on every render.
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    pausedRef.current = paused;
    onScanRef.current = onScan;
  }, [paused, onScan]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let lastDecodeAt = 0;
    let lastValue = '';
    let lastValueAt = 0;

    function loop(t: number) {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!video || !ctx || pausedRef.current) return;
      // ~6 decodes/sec is plenty and keeps the tablet cool.
      if (t - lastDecodeAt < 160 || video.readyState < 2 || video.videoWidth === 0) return;
      lastDecodeAt = t;

      // Downscale the frame — jsQR is much faster on small images and loyalty
      // codes are large in the viewfinder.
      const scale = Math.min(1, 480 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (!code?.data) return;

      // Same code within 3s = still the same scan, not a new one.
      const now = Date.now();
      if (code.data === lastValue && now - lastValueAt < 3000) return;
      lastValue = code.data;
      lastValueAt = now;
      onScanRef.current(code.data);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        const blocked = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        setError(
          blocked
            ? 'Camera access was blocked. Allow camera access for this site and try again.'
            : 'No usable camera was found on this device.',
        );
        return;
      }
      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
      if (cancelled) return;
      setStarting(false);
      raf = requestAnimationFrame(loop);
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing, attempt]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
      {/* The front camera preview is mirrored (like a selfie) — CSS only, the
          decoded frames stay unmirrored so the QR still reads. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn('absolute inset-0 h-full w-full object-cover', facing === 'user' && '-scale-x-100')}
      />
      {/* Viewfinder: a dimmed surround and four corner brackets around a clear square. */}
      {!error && !starting && (
        <div aria-hidden="true" className="absolute inset-0 m-auto aspect-square w-3/5 rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.4)]">
          {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((corner) => (
            <span key={corner} className={cn('absolute size-10 border-white', corner)} />
          ))}
        </div>
      )}
      {!error && (
        <button
          type="button"
          onClick={() => {
            setStarting(true);
            setError(null);
            setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
          }}
          aria-label="Switch camera"
          className="absolute bottom-3 right-3 flex size-12 items-center justify-center rounded-full bg-black/55 text-white/90 transition-colors active:bg-black/75"
        >
          <SwitchCamera size={22} />
        </button>
      )}
      {starting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/85" role="status">
          <Loader2 size={24} className="animate-spin" aria-hidden="true" />
          <p className="text-sm">Starting the camera…</p>
        </div>
      )}
      {error && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/90">
          <VideoOff size={26} aria-hidden="true" />
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStarting(true);
              setAttempt((n) => n + 1);
            }}
            className="mt-1 flex h-12 items-center gap-2 rounded-lg bg-white/15 px-5 text-sm font-semibold text-white active:bg-white/25"
          >
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        </div>
      )}
    </div>
  );
}
