export type CompareVerdict = 'yes' | 'part' | 'no';

export const COMPARE_LABEL: Record<CompareVerdict, string> = { yes: 'Included', part: 'Partly', no: 'Not available' };

/**
 * One mark per verdict in a comparison table: a filled 22px disc with a bold
 * glyph, so all three read at the same weight. Used by the home page's table
 * and every /compare page.
 */
export function CompareMark({ mark }: { mark: CompareVerdict }) {
  const disc = { yes: 'fill-primary', part: 'fill-stock/15', no: 'fill-[var(--mkt-line)]' }[mark];
  const glyph = { yes: 'stroke-primary-foreground', part: 'stroke-stock', no: 'stroke-[var(--mkt-ink-3)]' }[mark];
  return (
    <svg viewBox="0 0 22 22" className="size-[22px] shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r="11" className={disc} />
      <path
        d={mark === 'yes' ? 'M6.5 11.3l3 3 6-6.3' : mark === 'part' ? 'M7 11h8' : 'M7.8 7.8l6.4 6.4M14.2 7.8l-6.4 6.4'}
        className={glyph}
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The key under a comparison table. */
export function CompareLegend({ className }: { className?: string }) {
  return (
    <p className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[var(--mkt-ink-2)] ${className ?? ''}`}>
      <span className="flex items-center gap-1.5">
        <CompareMark mark="yes" /> Included
      </span>
      <span className="flex items-center gap-1.5">
        <CompareMark mark="part" /> Partly, or it depends
      </span>
      <span className="flex items-center gap-1.5">
        <CompareMark mark="no" /> Not available
      </span>
    </p>
  );
}
