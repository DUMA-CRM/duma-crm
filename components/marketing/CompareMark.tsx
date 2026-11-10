export type CompareVerdict = 'yes' | 'part' | 'no';

export const COMPARE_LABEL: Record<CompareVerdict, string> = { yes: 'Included', part: 'Partly', no: 'Not available' };

/**
 * One mark per verdict in a comparison table, drawn light: a hairline circle
 * with a check for yes, a paler circle with a dash for partly, and a soft grey
 * disc with a cross for no. Used by the home page's table and every /compare page.
 */
export function CompareMark({ mark }: { mark: CompareVerdict }) {
  return (
    <svg viewBox="0 0 22 22" className="size-[22px] shrink-0" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {mark === 'yes' && (
        <>
          <circle cx="11" cy="11" r="10" className="stroke-primary" strokeWidth="1.5" />
          <path d="M7 11.3l2.8 2.8 5.2-5.6" className="stroke-primary" strokeWidth="1.6" />
        </>
      )}
      {mark === 'part' && (
        <>
          <circle cx="11" cy="11" r="10" className="stroke-primary/40" strokeWidth="1.5" />
          <path d="M7.5 11h7" className="stroke-primary/40" strokeWidth="1.6" />
        </>
      )}
      {mark === 'no' && (
        <>
          <circle cx="11" cy="11" r="11" className="fill-[color-mix(in_oklab,var(--ink)_12%,transparent)]" />
          <path d="M8.2 8.2l5.6 5.6M13.8 8.2l-5.6 5.6" className="stroke-[var(--mkt-card,#fff)]" strokeWidth="1.8" />
        </>
      )}
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
