'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type DataTableAlign = 'left' | 'center' | 'right';
type DataTableDensity = 'compact' | 'default' | 'comfortable';
type DataTableSortDirection = 'asc' | 'desc' | false;
type DataTableWidth = 'auto' | 'fit' | number | string;
type DataTableVisibility = 'always' | 'sm' | 'md' | 'lg' | 'xl';
type DataTableCellClassName<T> = string | ((context: DataTableCellContext<T>) => string | undefined);

interface DataTableBorders {
  outer?: boolean;
  header?: boolean;
  rows?: boolean;
  columns?: boolean;
  cells?: boolean;
}

interface DataTableHeaderContext<T> {
  column: DataTableColumn<T>;
}

interface DataTableCellContext<T> {
  row: T;
  rowIndex: number;
  column: DataTableColumn<T>;
}

interface DataTableRowContext<T> {
  row: T;
  rowIndex: number;
}

export interface DataTableColumn<T> {
  id: string;
  header?: React.ReactNode | ((context: DataTableHeaderContext<T>) => React.ReactNode);
  cell: (context: DataTableCellContext<T>) => React.ReactNode;
  align?: DataTableAlign;
  width?: DataTableWidth;
  minWidth?: number | string;
  maxWidth?: number | string;
  visibility?: DataTableVisibility;
  wrap?: 'wrap' | 'nowrap' | 'truncate';
  headerClassName?: string;
  cellClassName?: DataTableCellClassName<T>;
  borderLeft?: boolean;
  borderRight?: boolean;
  sortDirection?: DataTableSortDirection;
  onSort?: (nextDirection: Exclude<DataTableSortDirection, false>) => void;
  ariaLabel?: string;
}

interface DataTableSharedProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  caption?: React.ReactNode;
  captionClassName?: string;
  className?: string;
  containerClassName?: string;
  tableClassName?: string;
  density?: DataTableDensity;
  borders?: DataTableBorders;
  striped?: boolean;
  stickyHeader?: boolean;
  tableLayout?: 'auto' | 'fixed';
  minWidth?: number | string;
  maxHeight?: number | string;
  footer?: React.ReactNode;
  footerClassName?: string;
}

interface DataTableDeclarativeProps<T> extends DataTableSharedProps {
  data: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowKey: (row: T, rowIndex: number) => React.Key;
  children?: never;
  isLoading?: boolean;
  loadingRows?: number;
  loadingState?: React.ReactNode;
  isError?: boolean;
  errorState?: React.ReactNode;
  emptyState?: React.ReactNode;
  onRowClick?: (context: DataTableRowContext<T>) => void;
  rowClassName?: string | ((context: DataTableRowContext<T>) => string | undefined);
  rowAriaLabel?: (context: DataTableRowContext<T>) => string;
  renderAfterRow?: (context: DataTableRowContext<T>) => React.ReactNode;
}

interface DataTableCompositionalProps extends DataTableSharedProps {
  children: React.ReactNode;
  data?: never;
  columns?: never;
  getRowKey?: never;
}

export type DataTableProps<T> = DataTableDeclarativeProps<T> | DataTableCompositionalProps;

const densityClasses: Record<DataTableDensity, { header: string; cell: string }> = {
  compact: {
    header: 'px-3 py-2',
    cell: 'px-3 py-2',
  },
  default: {
    header: 'px-3 py-3 md:px-5',
    cell: 'px-3 py-3 md:px-5',
  },
  comfortable: {
    header: 'px-4 py-4 md:px-6',
    cell: 'px-4 py-4 md:px-6',
  },
};

const alignClasses: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const visibilityClasses: Record<DataTableVisibility, string> = {
  always: '',
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const wrapClasses = {
  wrap: 'whitespace-normal',
  nowrap: 'whitespace-nowrap',
  truncate: 'overflow-hidden text-ellipsis whitespace-nowrap',
};

function toCssSize(value: number | string | undefined) {
  return typeof value === 'number' ? `${value}px` : value;
}

function columnStyle<T>(column: DataTableColumn<T>): React.CSSProperties {
  const fit = column.width === 'fit';
  return {
    width: fit ? '1%' : column.width === 'auto' ? undefined : toCssSize(column.width),
    minWidth: toCssSize(column.minWidth),
    maxWidth: toCssSize(column.maxWidth),
  };
}

function borderClasses(borders: DataTableBorders) {
  if (borders.cells) {
    return '[&_th]:border [&_td]:border';
  }

  return cn(
    borders.header !== false && '[&_thead_tr>*]:border-b',
    borders.rows !== false && '[&_tbody_tr:not(:last-child)>*]:border-b',
    borders.columns && '[&_tr>*:not(:last-child)]:border-r',
  );
}

/**
 * True when the event came from a control inside the row (a link, a button, an
 * input) that owns the interaction itself. `row` is the clickable row: it carries
 * `role="button"`, so it has to be excluded or it would match itself and every
 * row click would be ignored.
 */
function isInteractiveTarget(target: EventTarget | null, row?: Element | null) {
  if (!(target instanceof Element)) return false;
  const hit = target.closest('button, a, input, select, textarea, [role="button"], [data-table-stop-row-click]');
  if (!hit || hit === row) return false;
  return row ? row.contains(hit) : true;
}

function DataTable<T>(props: DataTableProps<T>) {
  const isDeclarative = 'columns' in props && Boolean(props.columns);
  const {
    caption,
    captionClassName,
    className,
    containerClassName,
    tableClassName,
    density = 'default',
    borders = {},
    striped = false,
    stickyHeader = true,
    tableLayout = 'auto',
    minWidth,
    maxHeight,
    footer,
    footerClassName,
  } = props;
  const hasOuterBorder = borders.outer ?? isDeclarative;
  const hasScrollContainer = isDeclarative || Boolean(containerClassName) || maxHeight !== undefined;

  const table = (
    <table
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      className={cn(
        'w-full border-collapse text-sm text-foreground',
        tableLayout === 'fixed' ? 'table-fixed' : 'table-auto',
        borderClasses(borders),
        striped && '[&_tbody_tr:nth-child(even)>*]:bg-muted/25',
        !isDeclarative && className,
        tableClassName,
      )}
      style={{ minWidth: toCssSize(minWidth) }}
    >
      {caption && <caption className={cn('sr-only', captionClassName)}>{caption}</caption>}
      {isDeclarative ? (
        <DeclarativeTableContent {...(props as DataTableDeclarativeProps<T>)} density={density} stickyHeader={stickyHeader} />
      ) : (
        (props as DataTableCompositionalProps).children
      )}
    </table>
  );

  return (
    <div
      className={cn(
        'min-w-0 bg-card',
        (hasOuterBorder || isDeclarative) && 'overflow-hidden',
        hasOuterBorder && 'rounded-2xl border border-border',
        isDeclarative && className,
      )}
    >
      {hasScrollContainer ? (
        <div className={cn('overflow-auto', containerClassName)} style={{ maxHeight: toCssSize(maxHeight) }}>
          {table}
        </div>
      ) : (
        table
      )}
      {footer && <div className={cn('border-t border-border bg-muted/20 px-4 py-3', footerClassName)}>{footer}</div>}
    </div>
  );
}

function DeclarativeTableContent<T>({
  columns,
  data,
  getRowKey,
  density,
  stickyHeader,
  isLoading = false,
  loadingRows = 6,
  loadingState,
  isError = false,
  errorState,
  emptyState,
  onRowClick,
  rowClassName,
  rowAriaLabel,
  renderAfterRow,
}: DataTableDeclarativeProps<T> & { density: DataTableDensity; stickyHeader: boolean }) {
  const stateColSpan = Math.max(columns.length, 1);

  return (
    <>
      <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
        <tr className="bg-muted/90">
          {columns.map((column) => {
            const direction = column.sortDirection ?? false;
            const header = typeof column.header === 'function' ? column.header({ column }) : column.header;
            const content = column.onSort ? (
              <button
                type="button"
                className={cn(
                  'inline-flex min-h-7 items-center gap-1 rounded-md outline-none hover:text-foreground',
                  'focus-visible:ring-2 focus-visible:ring-primary/30',
                  column.align === 'right' && 'ml-auto',
                  column.align === 'center' && 'mx-auto',
                )}
                aria-label={column.ariaLabel ?? (typeof header === 'string' ? `Sort by ${header}` : `Sort ${column.id}`)}
                onClick={() => column.onSort?.(direction === 'asc' ? 'desc' : 'asc')}
              >
                {header}
                {direction === 'asc' ? (
                  <ArrowUp size={13} aria-hidden="true" />
                ) : direction === 'desc' ? (
                  <ArrowDown size={13} aria-hidden="true" />
                ) : (
                  <ChevronsUpDown size={13} aria-hidden="true" />
                )}
              </button>
            ) : (
              header
            );

            return (
              <th
                key={column.id}
                scope="col"
                aria-sort={column.onSort ? (direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none') : undefined}
                className={cn(
                  densityClasses[density].header,
                  'bg-muted/90 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
                  alignClasses[column.align ?? 'left'],
                  visibilityClasses[column.visibility ?? 'always'],
                  column.wrap && wrapClasses[column.wrap],
                  column.width === 'fit' && 'whitespace-nowrap',
                  column.borderLeft && 'border-l',
                  column.borderRight && 'border-r',
                  column.headerClassName,
                )}
                style={columnStyle(column)}
              >
                {content}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          loadingState ? (
            <StateRow colSpan={stateColSpan}>{loadingState}</StateRow>
          ) : (
            Array.from({ length: loadingRows }).map((_, rowIndex) => (
              <tr key={`loading-${rowIndex}`} className="animate-pulse">
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.id}
                    className={cn(
                      densityClasses[density].cell,
                      visibilityClasses[column.visibility ?? 'always'],
                      column.width === 'fit' && 'whitespace-nowrap',
                    )}
                    style={columnStyle(column)}
                  >
                    <span className="block h-4 rounded bg-muted" style={{ width: `${44 + ((rowIndex * 17 + columnIndex * 13) % 42)}%` }} />
                  </td>
                ))}
              </tr>
            ))
          )
        ) : isError ? (
          <StateRow colSpan={stateColSpan}>{errorState ?? <DefaultState title="Couldn’t load this table" />}</StateRow>
        ) : data.length === 0 ? (
          <StateRow colSpan={stateColSpan}>{emptyState ?? <DefaultState title="No results" />}</StateRow>
        ) : (
          data.map((row, rowIndex) => {
            const context = { row, rowIndex };
            const rowClasses = typeof rowClassName === 'function' ? rowClassName(context) : rowClassName;
            const isInteractive = Boolean(onRowClick);

            return (
              <React.Fragment key={getRowKey(row, rowIndex)}>
                <tr
                  role={isInteractive ? 'button' : undefined}
                  tabIndex={isInteractive ? 0 : undefined}
                  aria-label={rowAriaLabel?.(context)}
                  onClick={
                    isInteractive
                      ? (event) => {
                          if (!isInteractiveTarget(event.target, event.currentTarget)) onRowClick?.(context);
                        }
                      : undefined
                  }
                  onKeyDown={
                    isInteractive
                      ? (event) => {
                          if ((event.key === 'Enter' || event.key === ' ') && !isInteractiveTarget(event.target, event.currentTarget)) {
                            event.preventDefault();
                            onRowClick?.(context);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'group transition-colors',
                    isInteractive &&
                      'cursor-pointer hover:bg-surface-offset/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
                    rowClasses,
                  )}
                >
                  {columns.map((column) => {
                    const cellContext = { row, rowIndex, column };
                    const cellClasses =
                      typeof column.cellClassName === 'function' ? column.cellClassName(cellContext) : column.cellClassName;

                    return (
                      <td
                        key={column.id}
                        className={cn(
                          densityClasses[density].cell,
                          alignClasses[column.align ?? 'left'],
                          visibilityClasses[column.visibility ?? 'always'],
                          column.wrap && wrapClasses[column.wrap],
                          column.width === 'fit' && 'whitespace-nowrap',
                          column.borderLeft && 'border-l',
                          column.borderRight && 'border-r',
                          cellClasses,
                        )}
                        style={columnStyle(column)}
                      >
                        {column.cell(cellContext)}
                      </td>
                    );
                  })}
                </tr>
                {renderAfterRow?.(context)}
              </React.Fragment>
            );
          })
        )}
      </tbody>
    </>
  );
}

function StateRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        {children}
      </td>
    </tr>
  );
}

function DefaultState({ title }: { title: string }) {
  return <div className="px-6 py-16 text-center text-sm text-muted-foreground">{title}</div>;
}

export { DataTable };
export type {
  DataTableAlign,
  DataTableBorders,
  DataTableCellContext,
  DataTableDensity,
  DataTableRowContext,
  DataTableSortDirection,
  DataTableVisibility,
  DataTableWidth,
};
