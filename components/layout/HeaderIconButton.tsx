'use client';

import { forwardRef } from 'react';

import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';

/**
 * Every icon in the app's top bar: one size, one corner, one hover fill and a
 * visible focus ring, with the label shown as a tooltip as well as read out.
 */
export const HeaderIconButton = forwardRef<
  HTMLButtonElement,
  { label: string; children: React.ReactNode; active?: boolean } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>
>(function HeaderIconButton({ label, children, active = false, className, ...props }, ref) {
  return (
    <Tooltip label={label} side="bottom">
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          'grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          active && 'bg-band text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
});
