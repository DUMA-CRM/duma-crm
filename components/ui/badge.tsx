import { type VariantProps, cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils/cn';

/* ════════════════════════════════════════════════════════════════
   A badge is the marketing site's tag: role text on a faint wash of its own
   colour, no hairline, 4px corners. The wash stays at 8–10% — the earlier
   tinted chips failed dark mode at heavier tints (measured 4.11:1, exception
   3.47:1), because a light role colour washed over a dark surface closes the
   contrast gap. `primary` and `outline` keep a hairline: they are neutral.

   Every variant name is preserved; `amber` remains an alias of `warning`.
   ════════════════════════════════════════════════════════════════ */
const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 text-label font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-exception aria-invalid:text-exception [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        // Solid keys, for counts and neutral tags.
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-band text-foreground',
        muted: 'bg-band text-muted-foreground',
        // Role tags — the same washes as `TONE_TINT`, so a badge and a pill agree.
        primary: 'border-border text-foreground',
        success: 'bg-momentum/8 text-momentum',
        warning: 'bg-measured/10 text-measured',
        amber: 'bg-measured/10 text-measured',
        destructive: 'bg-exception/8 text-exception',
        // Periwinkle, for states that are neither good nor bad — booked leave,
        // scheduled work.
        reference: 'bg-reference/8 text-reference',
        outline: 'border-border text-foreground',
        ghost: 'text-muted-foreground hover:bg-band',
        link: 'text-reference underline decoration-1 underline-offset-4',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
