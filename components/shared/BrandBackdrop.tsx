import { ChalkCurve } from '@/components/marketing/Strokes';

/**
 * The public-surface ground outside the marketing layout: the home hero's two
 * chalk curves, so the front door, sign-in, sign-up's neighbours and the legal
 * pages are one place. The paper colour and the curves' ink come from `.mkt`,
 * so place it inside a `mkt relative isolate` container in a file that imports
 * `app/(marketing)/marketing.css`. Hidden below `md`, as on the home page —
 * on a phone the form is the page.
 */
export function BrandBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
      <ChalkCurve side="left" id="backdrop-left" className="absolute top-0 -left-24 w-[34rem]" />
      <ChalkCurve side="right" id="backdrop-right" className="absolute top-56 -right-40 w-[44rem]" />
    </div>
  );
}
