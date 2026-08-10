'use client';

import Link from 'next/link';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { AlertTriangle, Clock, CloudOff, Lock, LogIn, RefreshCw, RotateCcw, Search, Server, Timer, WifiOff } from '@/components/icons';
import { describeError, type ErrorKind } from '@/lib/utils/error-message';

// Route-level error boundary — a render/runtime throw in any page lands here
// instead of white-screening the app.
//
// The screen tries to name the cause rather than shrug at it. It can only do
// that for errors thrown on the client: production strips the message off
// server throws and leaves a digest hash instead, so those fall back to the
// generic wording and lean on the reference (see lib/utils/error-message.ts).

const KIND_ICONS: Record<ErrorKind, typeof AlertTriangle> = {
  offline: WifiOff,
  update: RefreshCw,
  network: CloudOff,
  timeout: Clock,
  session: LogIn,
  permission: Lock,
  missing: Search,
  busy: Timer,
  server: Server,
  unknown: AlertTriangle,
};

// Only a genuine fault deserves the alarm colour; an expired session or a
// stale tab is routine and reads better in the neutral tier.
const FAULT_KINDS: ErrorKind[] = ['server', 'unknown', 'network', 'timeout'];

// `navigator.onLine` read the way React wants a browser value read: no state
// in an effect, a server snapshot that can't desync hydration, and a live
// update if the connection comes back while this screen is open.
const subscribeToConnection = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  const description = describeError(error, { online });
  const Icon = KIND_ICONS[description.kind];
  const isFault = FAULT_KINDS.includes(description.kind);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isFault ? 'bg-destructive/6' : 'bg-muted'}`}>
        <Icon size={28} className={isFault ? 'text-destructive' : 'text-muted-foreground'} aria-hidden="true" />
      </div>

      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-foreground outline-none">
          {description.title}
        </h1>
        <p className="mt-1 max-w-[60ch] text-base leading-6 text-muted-foreground">{description.body}</p>
        {error.digest && description.showReference && (
          <p className="text-label font-mono text-muted-foreground/60 mt-2 select-all">Ref: {error.digest}</p>
        )}
      </div>

      {description.action === 'sign-in' ? (
        <Link
          href="/sign-in"
          className="h-11 px-4 bg-primary hover:bg-primary-hover text-primary-foreground text-base sm:text-sm font-semibold rounded-sm flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogIn size={15} aria-hidden="true" />
          {description.actionLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={description.action === 'reload' ? () => window.location.reload() : unstable_retry}
          className="h-11 px-4 bg-primary hover:bg-primary-hover text-primary-foreground text-base sm:text-sm font-semibold rounded-sm flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RotateCcw size={15} aria-hidden="true" />
          {description.actionLabel}
        </button>
      )}
    </div>
  );
}
