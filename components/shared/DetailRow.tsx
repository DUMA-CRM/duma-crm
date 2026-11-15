import { ChevronDown } from '@/components/icons';
import { ListRow } from '@/components/shared/ListRow';
import { TONE_INK } from '@/components/shared/tone';

import { cn } from '@/lib/utils/cn';

/**
 * A list row that opens its details in place: a `ListRow` whose click unfolds
 * what sits underneath, its state in a word or two on the right, and its own
 * controls (a switch, a ⋯) beside it. One row open at a time — the caller
 * keeps which. Drawn first for API keys and webhooks; shared since the
 * privacy-request queue needed the same row.
 */
export function DetailRow({
  open,
  onToggle,
  value,
  valueTone,
  quiet = false,
  children,
  ...row
}: Omit<React.ComponentProps<typeof ListRow>, 'onClick' | 'href' | 'trailing' | 'as' | 'expanded' | 'chevron' | 'actions'> & {
  open: boolean;
  onToggle: () => void;
  /** The row's state in a word or two — "Used 2 days ago", "Failing". */
  value: string;
  valueTone?: 'warning' | 'exception';
  /** The value is a placeholder or a stopped state — drawn quietly. */
  quiet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-border last:border-b-0">
      <ListRow
        {...row}
        as="div"
        className="border-b-0"
        onClick={onToggle}
        expanded={open}
        chevron={false}
        trailing={
          <>
            <span
              className={cn(
                'max-w-28 truncate text-sm sm:max-w-40',
                valueTone ? cn('font-medium', TONE_INK[valueTone]) : quiet ? 'text-muted-foreground' : 'font-semibold text-foreground',
              )}
            >
              {value}
            </span>
            <ChevronDown
              size={14}
              className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
              aria-hidden="true"
            />
          </>
        }
      />
      {open && <div className="space-y-3 px-3.5 pb-3.5 sm:pl-[3.875rem]">{children}</div>}
    </li>
  );
}

/** An opened row's details: short labels against their values, on the quiet band. */
export function Facts({ rows }: { rows: Array<[string, React.ReactNode] | null | undefined | false | ''> }) {
  return (
    <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md bg-band/60 px-3 py-2.5 text-xs">
      {rows.filter(Boolean).map((row) => {
        const [term, value] = row as [string, React.ReactNode];
        return (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 wrap-break-word text-foreground">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
