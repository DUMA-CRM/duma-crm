'use client';

import { AlertTriangle } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/* The sibling of `EmptyState`, and the difference between them matters.
   An empty list is a normal reading — a quiet glyph and a plain statement.
   A *failed* list is not: nothing here is known, and the one thing the reader
   can do about it is ask again.

   This exists because "a query defaulting to `[]` makes a failure look like
   'no data'" is how a dead feature went unnoticed for two months. Every list
   that can fail should reach for this rather than falling through to its
   empty state. */
export function ErrorState({
  icon: Icon = AlertTriangle,
  title = 'This couldn’t be loaded',
  description = 'Check your connection, then try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  icon?: IconComponent;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-exception/8 text-exception">
        <Icon size={22} aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-sm border border-rule px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-band focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
