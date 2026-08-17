import { type VariantProps, cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════════
   A badge is a chart annotation.

   On a roast plot a status is a small boxed label with a coloured hairline and
   coloured text, sitting on the field — not a filled pill. That is the world's
   idiom AND the only construction that survives both themes: a light role
   colour washed over a dark surface closes the contrast gap, which is exactly
   how the previous tinted chips failed dark mode (measured 4.11:1,
   exception 3.47:1 against a 4.5 requirement).

   Role text on field / page / band is verified 4.90–8.93:1, and the role
   hairline clears 3:1 as a UI boundary, in both themes.

   Every variant name is preserved; `amber` remains an alias of `warning`.
   ════════════════════════════════════════════════════════════════ */
const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 text-label font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-exception aria-invalid:text-exception [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        // Solid keys, for counts and neutral tags.
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-band text-foreground',
        muted: 'bg-band text-muted-foreground',
        // Boxed annotations — a role hairline with role text on the surface.
        primary: 'border-rule text-foreground',
        success: 'border-momentum/60 bg-momentum/6 text-momentum',
        warning: 'border-measured/60 bg-measured/6 text-measured',
        amber: 'border-measured/60 bg-measured/6 text-measured',
        destructive: 'border-exception/60 bg-exception/6 text-exception',
        // Periwinkle, for states that are neither good nor bad — booked leave,
        // scheduled work. Same construction as the three above, so it clears
        // contrast in both themes.
        reference: 'border-reference/60 bg-reference/6 text-reference',
        outline: 'border-rule text-foreground',
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
