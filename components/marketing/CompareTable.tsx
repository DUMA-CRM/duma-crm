import { COMPARE_LABEL, CompareLegend, CompareMark, type CompareVerdict } from '@/components/marketing/CompareMark';

import { cn } from '@/lib/utils/cn';

export type CompareCell = { mark: CompareVerdict; note?: string };
export type CompareColumn = {
  key: string;
  label: string;
  /** A mark above the label: the mascot, a category icon. */
  icon?: React.ReactNode;
  /** A quiet line under the label, such as the price. */
  sub?: React.ReactNode;
  /** The column the table argues for: a brand-green outline from the header to the last row. */
  highlight?: boolean;
};
export type CompareRow = {
  label: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  cells: Record<string, CompareCell>;
};
export type CompareGroup = { title?: string; rows: readonly CompareRow[] };

// Secondary greys in the table: icons and the notes under marks outside the highlighted column.
const QUIET = 'text-[#A8A29E]';
const HIGHLIGHT = 'border-x-2 border-x-primary/60 border-t-primary/10 bg-[var(--mkt-marker)]/25';

/**
 * The marketing comparison table: one row per job, a light mark per column
 * with an optional note, one highlighted column, an optional footer row
 * ("Best for", or the sign-up buttons) and the legend. Used by the home page
 * (DUMA against the alternatives) and /pricing (Free against Business).
 */
export function CompareTable({
  caption,
  columns,
  groups,
  footer,
  labelWidth = '34%',
  minWidth = '44rem',
}: {
  caption: string;
  columns: readonly CompareColumn[];
  groups: readonly CompareGroup[];
  /** The last row: a label on the left, and anything per column (text, a button). */
  footer?: { label?: string; cells: Record<string, React.ReactNode> };
  labelWidth?: string;
  minWidth?: string;
}) {
  const lastGroup = groups.length - 1;
  const columnWidth = `calc((100% - ${labelWidth}) / ${columns.length})`;

  return (
    <>
      <div className="overflow-x-auto" data-reveal="">
        <table className="w-full border-separate border-spacing-0 text-[0.9375rem]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="p-3 text-left font-normal" style={{ width: labelWidth }}>
                <span className="sr-only">Feature</span>
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: columnWidth }}
                  className={cn(
                    'px-3 pt-7 pb-4 font-semibold',
                    column.highlight && 'rounded-t-lg border-x-2 border-t-2 border-primary/60 bg-[var(--mkt-marker)]/25',
                  )}
                >
                  <span className="flex flex-col items-center gap-1.5">
                    {column.icon && <span className={cn(!column.highlight && QUIET)}>{column.icon}</span>}
                    {column.label}
                    {column.sub && <span className="font-mono text-sm font-normal text-[var(--mkt-ink-2)] tabular-nums">{column.sub}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((group, groupIndex) => (
            <tbody key={group.title ?? groupIndex}>
              {group.title && (
                <tr>
                  {/* A section label over its rows: small spaced capitals, room above, no rule of its own. */}
                  <th scope="colgroup" className="px-4 pt-12 pb-3 text-left text-xs font-semibold tracking-[0.08em] text-[var(--mkt-heading)] uppercase">
                    {group.title}
                  </th>
                  {columns.map((column) => (
                    <td key={column.key} className={cn(column.highlight && 'border-x-2 border-x-primary/60 bg-[var(--mkt-marker)]/25')} />
                  ))}
                </tr>
              )}
              {group.rows.map((row, rowIndex) => {
                const closes = !footer && groupIndex === lastGroup && rowIndex === group.rows.length - 1;
                return (
                  <tr key={row.label}>
                    <th scope="row" className="border-t border-[var(--mkt-line)] px-4 py-5 text-left text-[1.0625rem] font-normal text-[var(--mkt-ink-2)]">
                      <span className="flex items-center gap-3">
                        {row.icon && <row.icon className={cn('size-[1.125rem] shrink-0', QUIET)} aria-hidden="true" />}
                        {row.label}
                      </span>
                    </th>
                    {columns.map((column) => (
                      <Cell key={column.key} cell={row.cells[column.key]} highlight={column.highlight} closes={closes} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
          {footer && (
            <tbody>
              <tr>
                <th scope="row" className="border-t border-[var(--mkt-line)] px-4 py-6 text-left text-[1.0625rem] font-semibold">
                  {footer.label}
                </th>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'border-t border-[var(--mkt-line)] px-4 pt-6 pb-8 text-center text-sm',
                      column.highlight ? cn(HIGHLIGHT, 'rounded-b-lg border-b-2 border-b-primary/60 font-medium') : QUIET,
                    )}
                  >
                    {footer.cells[column.key]}
                  </td>
                ))}
              </tr>
            </tbody>
          )}
        </table>
      </div>
      <CompareLegend className="mt-6" />
    </>
  );
}

function Cell({ cell, highlight, closes }: { cell?: CompareCell; highlight?: boolean; closes: boolean }) {
  return (
    <td
      className={cn(
        'border-t border-[var(--mkt-line)] px-3 py-4 text-center',
        highlight && HIGHLIGHT,
        highlight && closes && 'rounded-b-lg border-b-2 border-b-primary/60',
      )}
    >
      {cell && (
        <span className="flex flex-col items-center gap-1.5">
          <CompareMark mark={cell.mark} />
          <span className="sr-only">{COMPARE_LABEL[cell.mark]}</span>
          {cell.note && <span className={cn('text-[13px]', highlight ? 'text-primary' : QUIET)}>{cell.note}</span>}
        </span>
      )}
    </td>
  );
}
