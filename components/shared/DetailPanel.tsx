import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// A detail drawer's facts, drawn the audit inspector's way: a small heading,
// then a bordered list of label/value rows. Shared by the audit inspector, the
// shift drawer and the my-HR day drawer so all three read as one.
// ---------------------------------------------------------------------------

/** The heading over one group of facts. */
export function DetailSectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-heading">{children}</h3>;
}

/** The bordered list the rows sit in. */
export function DetailPanel({ children }: { children: React.ReactNode }) {
  return <dl className="overflow-hidden rounded-lg border border-border bg-field">{children}</dl>;
}

/** One fact: a muted label column, the value beside it. */
export function DetailPanelRow({
  label,
  children,
  mono = false,
  stack = false,
}: {
  label: string;
  children: React.ReactNode;
  /** An ID or a path: monospaced, and allowed to break anywhere. */
  mono?: boolean;
  /** Put the label above the value on phones (with a narrower label column) — for a drawer that is full-width there. */
  stack?: boolean;
}) {
  return (
    <div
      className={cn(
        'border-b border-border px-3.5 py-2.5 last:border-b-0',
        stack ? 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3' : 'flex items-baseline gap-3',
      )}
    >
      <dt className={cn('shrink-0 text-xs text-muted-foreground', stack ? 'w-20' : 'w-24')}>{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground',
          mono && 'font-mono text-xs break-all',
        )}
      >
        {children}
      </dd>
    </div>
  );
}
