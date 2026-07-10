'use client';

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  header: string;
  /** Custom cell renderer. Falls back to `row[key]` as a string. */
  render?: (row: T) => React.ReactNode;
  /** Value used for client-side sorting when `render` is custom. Falls back to `row[key]`. */
  getValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
}

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (ids: string[]) => void;
  variant?: 'default' | 'destructive' | 'outline';
}

type SortDir = 'asc' | 'desc';

/**
 * Two modes:
 * - **Client-side** (default): pass all rows in `data`; search/sort/paginate handled internally.
 * - **Server-side**: provide `total` + `onPage` (and optionally `onSearch` / `onSort`) to take over each concern.
 */
export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  // Search
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  // Pagination
  pageSize?: number;
  page?: number;
  total?: number;
  onPage?: (page: number) => void;
  // Sort
  onSort?: (key: string, dir: SortDir) => void;
  // Selection
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  bulkActions?: BulkAction[];
  // Toolbar extras (rendered after search)
  toolbarActions?: React.ReactNode;
  // States
  isLoading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

// ── Internal sub-components ────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onChange, label }: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
      onChange={onChange}
      className={cn(
        'size-4 cursor-pointer rounded border border-border bg-background',
        'accent-primary transition-colors',
        'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
      )}
    />
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={13} className="text-muted-foreground/60 shrink-0" />;
  return dir === 'asc'
    ? <ChevronUp size={13} className="text-primary shrink-0" />
    : <ChevronDown size={13} className="text-primary shrink-0" />;
}

function BulkBar({ count, actions, onClear }: { count: number; actions: BulkAction[]; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/8 border-b border-divider text-sm font-semibold text-primary">
      <span>{count} selected</span>
      <div className="ml-auto flex gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            size="xs"
            variant={a.variant === 'destructive' ? 'destructive' : 'outline'}
            onClick={() => a.onClick([])}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
        <Button size="xs" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}

function TableSkeleton({ rows, cols, selectable }: { rows: number; cols: number; selectable: boolean }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-border animate-pulse">
          {selectable && (
            <td className="px-4 py-3">
              <div className="size-4 rounded bg-muted" />
            </td>
          )}
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded bg-muted" style={{ width: `${55 + ((i + j) % 3) * 15}%` }} />
            </td>
          ))}
          <td className="px-4 py-3">
            <div className="size-7 rounded-lg bg-muted ml-auto" />
          </td>
        </tr>
      ))}
    </>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Show at most 7 page buttons with ellipsis
  const pages = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const result: (number | '…')[] = [1];
    if (page > 3) result.push('…');
    for (let p = Math.max(2, page - 1); p <= Math.min(pageCount - 1, page + 1); p++) result.push(p);
    if (page < pageCount - 2) result.push('…');
    result.push(pageCount);
    return result;
  }, [page, pageCount]);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
      <span>
        Showing{' '}
        <strong className="text-foreground font-semibold tabular-nums">{from}–{to}</strong>
        {' '}of{' '}
        <strong className="text-foreground font-semibold tabular-nums">{total}</strong>
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={13} />
        </Button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="w-7 flex items-center justify-center text-muted-foreground select-none">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => onPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'tabular-nums text-xs font-semibold',
                p === page && 'bg-primary/10 text-primary hover:bg-primary/15',
              )}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={page === pageCount}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  );
}

// ── DataTable ──────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columns,
  data,
  getRowId,
  searchPlaceholder = 'Search…',
  onSearch,
  pageSize = 10,
  page: controlledPage,
  total: controlledTotal,
  onPage,
  onSort,
  selectable = false,
  onSelectionChange,
  bulkActions = [],
  toolbarActions,
  isLoading = false,
  skeletonRows = 5,
  emptyTitle = 'No results found',
  emptyDescription = 'Try adjusting your search or filters.',
  className,
}: DataTableProps<T>) {
  const isServerPaginated = onPage !== undefined;
  const isServerSearched = onSearch !== undefined;
  const isServerSorted = onSort !== undefined;

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [internalPage, setInternalPage] = useState(1);

  const activePage = isServerPaginated ? (controlledPage ?? 1) : internalPage;

  function handleSearch(q: string) {
    setQuery(q);
    setInternalPage(1);
    onSearch?.(q);
  }

  function handleSort(key: string) {
    const next: { key: string; dir: SortDir } =
      sort?.key === key
        ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' };
    setSort(next);
    if (isServerSorted) onSort(next.key, next.dir);
  }

  function handlePage(p: number) {
    if (isServerPaginated) onPage(p);
    else setInternalPage(p);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    onSelectionChange?.([]);
  }

  // Client-side search
  const searched = useMemo(() => {
    if (isServerSearched || !query) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.getValue ? col.getValue(row) : (row as Record<string, unknown>)[col.key];
        return String(val ?? '').toLowerCase().includes(q);
      }),
    );
  }, [data, query, columns, isServerSearched]);

  // Client-side sort
  const sorted = useMemo(() => {
    if (isServerSorted || !sort) return searched;
    const col = columns.find((c) => c.key === sort.key);
    return [...searched].sort((a, b) => {
      const va = col?.getValue ? col.getValue(a) : (a as Record<string, unknown>)[sort.key];
      const vb = col?.getValue ? col.getValue(b) : (b as Record<string, unknown>)[sort.key];
      const sign = sort.dir === 'asc' ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') return sign * (va - vb);
      return sign * String(va ?? '').localeCompare(String(vb ?? ''));
    });
  }, [searched, sort, columns, isServerSorted]);

  // Client-side pagination
  const total = isServerPaginated ? (controlledTotal ?? data.length) : sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(activePage, pageCount);

  const pageRows = useMemo(() => {
    if (isServerPaginated) return sorted; // server already returns the right slice
    return sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [sorted, safePage, pageSize, isServerPaginated]);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)));
  const someOnPageSelected = pageRows.some((r) => selected.has(getRowId(r)));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((r) => next.delete(getRowId(r)));
      else pageRows.forEach((r) => next.add(getRowId(r)));
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }

  const alignClass: Record<string, string> = {
    left: 'text-left',
    right: 'text-right',
    center: 'text-center',
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-surface-2 overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        {toolbarActions}
        <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-muted-foreground tabular-nums">
          {total} rows
        </span>
      </div>

      {/* Bulk action bar */}
      {selectable && selected.size > 0 && bulkActions.length > 0 && (
        <BulkBar count={selected.size} actions={bulkActions} onClear={clearSelection} />
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={!allOnPageSelected && someOnPageSelected}
                    onChange={toggleAllOnPage}
                    label="Select all on page"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    'px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap',
                    alignClass[col.align ?? 'left'],
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors duration-100',
                    sort?.key === col.key && 'text-primary',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                    {col.header}
                    {col.sortable && (
                      <SortIcon active={sort?.key === col.key} dir={sort?.dir ?? 'asc'} />
                    )}
                  </span>
                </th>
              ))}
              {/* Actions column spacer */}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={skeletonRows} cols={columns.length} selectable={selectable} />
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 2 : 1)}
                  className="px-4 py-12 text-center"
                >
                  <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);

                return (
                  <tr
                    key={id}
                    className={cn(
                      'border-b border-border transition-colors duration-100 last:border-0',
                      'hover:bg-muted/30',
                      isSelected && 'bg-primary/5 hover:bg-primary/8',
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-sm text-foreground',
                          alignClass[col.align ?? 'left'],
                          col.align === 'right' && 'tabular-nums',
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}
                    {/* Row actions slot — empty for now, callers can add via columns */}
                    <td className="px-4 py-3 text-right" />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPage={handlePage}
        />
      )}
    </div>
  );
}
