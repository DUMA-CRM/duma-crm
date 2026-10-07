'use client';

import { ElasticSlider, type ElasticSliderProps } from '@/components/elastic-slider';

import { cn } from '@/lib/utils/cn';

/**
 * The app's slider: the installed ElasticSlider (label and value inside the
 * track, rubber-band drag, keyboard steps) dressed as one of our controls —
 * the 36px height and corner of an `Input`, a brand-tinted fill, and the amber
 * focus marker every field shows for keyboard focus.
 *
 * Use it for a bounded value people judge by feel — a width, a height, a
 * percentage off. Not for money, legal rates or counts people type exactly:
 * those stay inputs.
 */
export function Slider({ className, ...props }: ElasticSliderProps) {
  return (
    <ElasticSlider
      {...props}
      className={cn(
        '[--elastic-slider-radius:var(--radius-md)]',
        '[--elastic-slider-bg:var(--band)]',
        '[--elastic-slider-fill:color-mix(in_oklab,var(--primary)_14%,transparent)]',
        '[--elastic-slider-fill-active:color-mix(in_oklab,var(--primary)_24%,transparent)]',
        '[--elastic-slider-hash:color-mix(in_oklab,var(--muted-foreground)_35%,transparent)]',
        '[&_[data-slot=elastic-slider-track][data-focus-visible=true]]:ring-measured [&_[data-slot=elastic-slider-track][data-focus-visible=true]]:ring-offset-0',
        'w-full',
        className,
      )}
    />
  );
}

export type SliderProps = ElasticSliderProps;
