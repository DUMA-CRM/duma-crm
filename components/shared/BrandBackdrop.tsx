/**
 * The public-surface ground: the plot-field grid at its major step, faded out
 * from the centre so it reads as texture rather than chrome, with a soft brand
 * glow behind whatever sits in the middle. Shared by the landing page and the
 * (auth) frame so the front door and the sign-in screen are one place.
 *
 * Place inside a `relative isolate` container; it draws at -z-10.
 */
export function BrandBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 mask-[radial-gradient(ellipse_at_center,black_10%,transparent_70%)]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--grid-major) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-major) 1px, transparent 1px)',
          backgroundSize: 'var(--grid-major-step) var(--grid-major-step)',
          backgroundPosition: 'center center',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-144 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />
    </>
  );
}
