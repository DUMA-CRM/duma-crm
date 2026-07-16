'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

// Route-level error boundary — a render/runtime throw in any page lands here
// instead of white-screening the app.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle size={28} className="text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          An unexpected error occurred while rendering this page. Your data is safe — try again.
        </p>
        {error.digest && <p className="text-[11px] font-mono text-muted-foreground/60 mt-2">Ref: {error.digest}</p>}
      </div>
      <button
        onClick={reset}
        className="h-9 px-4 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
      >
        <RotateCcw size={15} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
