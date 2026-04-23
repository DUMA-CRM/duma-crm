'use client';

import * as React from 'react';
import { Separator as SeparatorPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeparatorProps extends React.ComponentProps<typeof SeparatorPrimitive.Root> {
  /** Optional text label centered on the separator — useful for "or", "and", section titles */
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function Separator({ className, orientation = 'horizontal', decorative = true, label, ...props }: SeparatorProps) {
  if (label && orientation === 'horizontal') {
    return (
      <div className="flex items-center gap-3 w-full">
        <SeparatorPrimitive.Root
          data-slot="separator"
          decorative={decorative}
          orientation="horizontal"
          className={cn('shrink-0 bg-border h-px flex-1', className)}
          {...props}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        <SeparatorPrimitive.Root
          data-slot="separator"
          decorative={decorative}
          orientation="horizontal"
          className={cn('shrink-0 bg-border h-px flex-1', className)}
          {...props}
        />
      </div>
    );
  }

  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
