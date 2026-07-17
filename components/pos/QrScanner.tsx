'use client';

import jsQR from 'jsqr';
import { Loader2, SwitchCamera, VideoOff } from 'lucide-react';
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
  }, [facing]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
      {/* The front camera preview is mirrored (like a selfie) — CSS only, the
          decoded frames stay unmirrored so the QR still reads. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn('absolute inset-0 w-full h-full object-cover', facing === 'user' && '-scale-x-100')}
      />
      {/* Viewfinder — dimmed surround with a clear centre square */}
      {!error && !starting && (
        <div className="absolute inset-0 m-auto w-3/5 aspect-square rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
      )}
      {/* Flip between rear and front camera */}
      {!error && (
        <button
          onClick={() => {
            setStarting(true);
            setError(null);
            setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
          }}
          aria-label="Switch camera"
          className="absolute bottom-2.5 right-2.5 size-11 rounded-full bg-black/50 text-white/90 flex items-center justify-center hover:bg-black/70 active:translate-y-px transition-colors"
        >
          <SwitchCamera size={20} />
        </button>
      )}
      {starting && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/90">
          <VideoOff size={22} />
          <p className="text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}
