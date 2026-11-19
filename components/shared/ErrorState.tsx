'use client';

import { RefreshCw } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Sticker } from '@/components/shared/Sticker';
import { Button } from '@/components/ui/button';

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
  icon: Icon,
  title = 'This couldn’t be loaded',
  description = 'Check your connection, then try again.',
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  /** What failed to load, as a glyph at the cat's shoulder — the cat says *that* it failed, the glyph says *what*. */
  icon?: IconComponent;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
      <div className="relative mb-3">
        <Sticker name="error" size={96} />
        {Icon && <Icon size={20} className="absolute top-0 left-0 text-exception" aria-hidden="true" />}
      </div>
      <p className="text-sm font-semibold text-heading">{title}</p>
      {description && <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
