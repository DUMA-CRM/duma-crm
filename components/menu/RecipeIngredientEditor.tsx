'use client';

import { Plus, Trash2 } from '@/components/icons';
import { IngredientCombobox } from '@/components/menu/IngredientCombobox';
import { inputClass } from '@/components/menu/shared';
import { DEFAULT_COL, type RecipeRow, type SizeColumn } from '@/components/menu/useRecipeDraft';
import { Bone } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import type { StockItem } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';

/**
 * The ingredient rows, shared by the menu-item recipe and the modifier recipe.
 *
 * There used to be two editors for this one job: roomy labelled rows on menu
 * items, and a dense spreadsheet on modifiers that scrolled sideways inside a
 * half-width panel as soon as a second size existed. The dense one lost the
 * quantity's column header off the top of the viewport while you typed in it.
 *
 * One row per ingredient, each quantity labelled beside its own field, so the
 * row stays readable however many sizes the tenant has and whatever width the
 * panel gets.
 */
export function RecipeIngredientEditor({
  rows,
  onChange,
  columns,
  stockItems,
  itemMap,
  usedIds,
  sizes,
  emptyHint,
}: {
  rows: RecipeRow[];
  onChange: (rows: RecipeRow[]) => void;
  columns: SizeColumn[];
  stockItems: StockItem[];
  itemMap: Map<string, StockItem>;
  usedIds: Set<string>;
  sizes: SizeColumn[];
  emptyHint: React.ReactNode;
}) {
  const formatMoney = useFormatMoney();
  const patchRow = (index: number, changes: Partial<RecipeRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  const lineCostOf = (row: RecipeRow) => {
    const item = itemMap.get(row.stockItemId);
    return item?.costPerUnit != null ? (Number(row.qty[DEFAULT_COL]) || 0) * Number(item.costPerUnit) : null;
  };
  // Each line's share of the base cost — the costing tools' "% of cost", so the
  // ingredient worth trimming stands out.
  const total = rows.reduce((sum, row) => sum + (lineCostOf(row) ?? 0), 0);

  return (
    // A container, not the viewport, decides the layout: the same editor sits
    // full width on the recipe tab and in a narrow drawer for a modifier.
    <div className="@container space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule/70 px-4 py-5 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Column heads once, when the row is one line; narrower, each field carries its own label. */}
          <div
            className="hidden items-center gap-3 border-b border-border bg-band/40 px-3.5 py-2 text-label uppercase text-muted-foreground @2xl:flex"
            aria-hidden="true"
          >
            <span className="min-w-0 flex-1">Ingredient</span>
            {columns.map((column) => (
              <span key={column.id} className="w-20 shrink-0 text-right">
                {column.label}
              </span>
            ))}
            <span className="w-28 shrink-0 text-right">Cost</span>
            <span className="w-9 shrink-0" />
          </div>
          <ul>
            {rows.map((row, i) => {
              const item = itemMap.get(row.stockItemId);
              const lineCost = lineCostOf(row);
              const share = lineCost != null && total > 0 ? (lineCost / total) * 100 : null;

              return (
                <li
                  key={`${row.stockItemId}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border px-3.5 py-3 last:border-b-0 @2xl:flex-nowrap"
                >
                  <IngredientCombobox
                    value={row.stockItemId}
                    onChange={(value) => patchRow(i, { stockItemId: value })}
                    options={stockItems}
                    disabledIds={usedIds}
                    className="order-1 min-w-0 flex-1 basis-48"
                  />
                  {/* Narrow: quantities wrap onto their own line under the picker. */}
                  <div className="order-4 flex w-full flex-wrap items-end gap-x-3 gap-y-2.5 @2xl:order-2 @2xl:w-auto @2xl:flex-nowrap">
                    {columns.map((column) => (
                      <label key={column.id} className="block">
                        <span className="mb-1 block text-label uppercase text-muted-foreground @2xl:sr-only">{column.label}</span>
                        {/* The unit is said once, in the ingredient picker ("Beans (g)"). */}
                        <input
                          value={row.qty[column.id] ?? ''}
                          onChange={(e) => patchRow(i, { qty: { ...row.qty, [column.id]: e.target.value } })}
                          // Enter must not submit a form this editor is nested in.
                          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                          inputMode="decimal"
                          // A blank size field inherits the default, so show what it
                          // would inherit rather than a meaningless zero.
                          placeholder={column.id === DEFAULT_COL ? '0' : row.qty[DEFAULT_COL] || '—'}
                          aria-label={`${item?.name ?? 'Ingredient'} ${column.label} quantity${item?.unit ? ` in ${item.unit}` : ''}`}
                          className={cn(
                            inputClass,
                            'w-20 text-right tabular-nums',
                            column.id !== DEFAULT_COL && !row.qty[column.id]?.trim() && 'text-muted-foreground',
                          )}
                        />
                      </label>
                    ))}
                  </div>
                  {/* Per-line cost sits with the line it belongs to, so a wrong
                      quantity is caught here rather than in a distant total. */}
                  <span className="order-2 w-28 shrink-0 text-right @2xl:order-3">
                    {!row.stockItemId ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : lineCost == null ? (
                      <span className="rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">No cost</span>
                    ) : (
                      <>
                        <span className="block text-sm font-semibold tabular-nums text-foreground">{formatMoney(lineCost, 2)}</span>
                        {share != null && rows.length > 1 && (
                          <span className="mt-1 flex items-center justify-end gap-1.5" title={`${share.toFixed(0)}% of the cost`}>
                            <span className="h-1 w-12 overflow-hidden rounded-full bg-band" aria-hidden="true">
                              <span className="block h-full rounded-full bg-primary/60" style={{ width: `${share}%` }} />
                            </span>
                            <span className="w-8 text-right text-micro tabular-nums text-muted-foreground">{share.toFixed(0)}%</span>
                          </span>
                        )}
                      </>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label={`Remove ${item?.name ?? 'ingredient'}`}
                    className="order-3 size-9 shrink-0 text-muted-foreground hover:text-exception @2xl:order-4"
                  >
                    <Trash2 size={15} />
                  </Button>
                </li>
              );
            })}
          </ul>
          {total > 0 && (
            <div className="flex items-center gap-3 border-t border-border bg-band/30 px-3.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 font-semibold text-foreground">
                Total{columns.length > 1 ? ` · ${columns[0]?.label ?? 'Default'}` : ''}
              </span>
              <span className="w-28 shrink-0 text-right font-semibold tabular-nums text-heading">{formatMoney(total, 2)}</span>
              <span className="w-9 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      )}

      {sizes.length > 0 && rows.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">Leave a size blank to use the {columns[0]?.label ?? 'Default'} amount.</p>
      )}

      <button
        type="button"
        onClick={() => onChange([...rows, { stockItemId: '', qty: {} }])}
        className="flex h-11 w-full items-center gap-2 rounded-lg border border-dashed border-edge px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Plus size={16} aria-hidden="true" />
        Add ingredient
      </button>
    </div>
  );
}

/** The ingredient rows loading: the same card of rows (picker, cost, quantity fields) and the add button. */
export function RecipeIngredientSkeleton({ rows = 2, label = 'Loading the ingredients' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="border-b border-border px-3.5 py-3 last:border-b-0">
            <div className="flex items-center gap-2">
              <Bone className="h-9 min-w-0 flex-1" />
              <Bone className="h-4 w-16 shrink-0" />
              <Bone className="size-9 shrink-0" />
            </div>
            <div className="mt-2.5 flex gap-4">
              <Bone className="h-9 w-24" />
            </div>
          </div>
        ))}
      </div>
      <Bone className="h-10 w-full rounded-lg" />
    </div>
  );
}
