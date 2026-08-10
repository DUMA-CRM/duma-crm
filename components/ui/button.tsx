import { type VariantProps, cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/* Magnetic service-board controls. Variant names remain stable for callers. */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,translate,box-shadow] duration-150 outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-exception aria-invalid:text-exception [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The lit key: solid graphite with a field-coloured legend.
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        // The unlit key: field fill behind a hairline. The workhorse.
        outline: 'border-rule bg-field text-foreground hover:bg-band aria-expanded:bg-band',
        secondary: 'bg-band text-foreground hover:bg-band/70 aria-expanded:bg-band',
        ghost: 'text-foreground hover:bg-band aria-expanded:bg-band',
        // Destruction reads as an exception annotation, not a red slab.
        destructive: 'border-exception/45 bg-field text-exception hover:border-exception hover:bg-exception/6',
        // A link points at a reference, so it takes the reference role.
        link: 'text-reference underline decoration-1 underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        xs: "h-7 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        // No intermediate 13px / 15px steps: they duplicated legacy notations
        // and sat a pixel from the steps either side, which is drift, not a ramp.
        sm: "h-8 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
        touch: 'h-11 gap-2 px-4 text-base',
        icon: 'size-9',
        'icon-xs': "size-6 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-9',
        'icon-touch': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
