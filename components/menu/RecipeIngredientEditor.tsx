'use client';

import { Plus, Trash2 } from '@/components/icons';
import { IngredientCombobox } from '@/components/menu/IngredientCombobox';
import { inputClass } from '@/components/menu/shared';
import { DEFAULT_COL, type RecipeRow, type SizeColumn } from '@/components/menu/useRecipeDraft';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import type { StockItem } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';

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
  const patchRow = (index: number, changes: Partial<RecipeRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule/70 px-4 py-5 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          {rows.map((row, i) => {
            const item = itemMap.get(row.stockItemId);
            const lineCost = item?.costPerUnit != null ? (Number(row.qty[DEFAULT_COL]) || 0) * Number(item.costPerUnit) : null;

            return (
              <li key={`${row.stockItemId}-${i}`} className="border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                <div className="flex items-center gap-2">
                  <IngredientCombobox
                    value={row.stockItemId}
                    onChange={(value) => patchRow(i, { stockItemId: value })}
                    options={stockItems}
                    disabledIds={usedIds}
                    className="min-w-0 flex-1"
                  />
                  {/* Per-line cost sits with the line it belongs to, so a wrong
                      quantity is caught here rather than in a distant total. */}
                  <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                    {!row.stockItemId ? (
                      <span className="text-xs font-normal text-muted-foreground">—</span>
                    ) : lineCost == null ? (
                      <span className="rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">No cost</span>
                    ) : (
                      formatMoney(lineCost, 2)
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label={`Remove ${item?.name ?? 'ingredient'}`}
                    className="size-9 shrink-0 text-muted-foreground hover:text-exception"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>

                <div className="mt-2.5 flex flex-wrap items-end gap-x-4 gap-y-2.5">
                  {columns.map((column) => (
                    <div key={column.id}>
                      <label className="mb-1 block text-label uppercase text-muted-foreground">{column.label}</label>
                      {/* The unit is said once, in the ingredient picker above ("Beans (g)"). */}
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
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sizes.length > 0 && rows.length > 0 && (
        <p className="px-1 text-xs text-muted-foreground">Leave a size blank to use the {columns[0]?.label ?? 'Default'} amount.</p>
      )}

      <button
        type="button"
        onClick={() => onChange([...rows, { stockItemId: '', qty: {} }])}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rule/70 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
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
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="border-b border-rule/45 px-3.5 py-3 last:border-b-0">
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
