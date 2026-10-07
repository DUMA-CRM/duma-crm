'use client';

import '@ncdai/react-wheel-picker/style.css';

import * as WheelPickerPrimitive from '@ncdai/react-wheel-picker';

import { cn } from '@/lib/utils/cn';

// The shadcn registry wrapper for @ncdai/react-wheel-picker, on this app's
// tokens rather than zinc: the selection band is the `band` surface, focus is
// the amber `measured` marker every other control uses.

export type WheelPickerOption<T extends WheelPickerPrimitive.WheelPickerValue = string> = WheelPickerPrimitive.WheelPickerOption<T>;
export type WheelPickerClassNames = WheelPickerPrimitive.WheelPickerClassNames;

function WheelPickerWrapper({ className, ...props }: React.ComponentProps<typeof WheelPickerPrimitive.WheelPickerWrapper>) {
  return (
    <WheelPickerPrimitive.WheelPickerWrapper
      className={cn(
        'w-56 rounded-lg border border-rule/70 bg-control px-1 shadow-xs',
        '*:data-rwp:first:*:data-rwp-highlight-wrapper:rounded-s-md',
        '*:data-rwp:last:*:data-rwp-highlight-wrapper:rounded-e-md',
        className,
      )}
      {...props}
    />
  );
}

function WheelPicker<T extends WheelPickerPrimitive.WheelPickerValue = string>({ classNames, ...props }: WheelPickerPrimitive.WheelPickerProps<T>) {
  return (
    <WheelPickerPrimitive.WheelPicker
      classNames={{
        optionItem: 'tabular-nums text-muted-foreground/70 data-disabled:opacity-40',
        highlightWrapper: 'bg-band tabular-nums text-foreground data-rwp-focused:ring-2 data-rwp-focused:ring-measured data-rwp-focused:ring-inset',
        ...classNames,
      }}
      {...props}
    />
  );
}

export { WheelPicker, WheelPickerWrapper };
