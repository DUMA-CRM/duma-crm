'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export function LoadingToast() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const active = fetching + mutating > 0;

  if (!active) return null;

  return (
    // Anchored bottom-left so it never overlaps the Toast stack (bottom-right).
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-card border border-border rounded-xl shadow-lg">
      {/* Pulse dots */}
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{mutating > 0 ? 'Saving…' : 'Loading…'}</span>
    </div>
  );
}
