'use client';

import { Plus, Trash2 } from '@/components/icons';
import { IngredientCombobox } from '@/components/menu/IngredientCombobox';
import { inputClass } from '@/components/menu/shared';
import { DEFAULT_COL, type RecipeRow, type SizeColumn } from '@/components/menu/useRecipeDraft';
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
    <div className="space-y-2.5">
      {rows.length === 0 && (
        <div className="rounded-sm border border-dashed border-rule px-4 py-6 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">{emptyHint}</p>
        </div>
      )}

      {rows.map((row, i) => {
        const item = itemMap.get(row.stockItemId);
        const lineCost = item?.costPerUnit != null ? (Number(row.qty[DEFAULT_COL]) || 0) * Number(item.costPerUnit) : null;

        return (
          <div key={`${row.stockItemId}-${i}`} className="rounded-sm border border-rule bg-band/50 p-3">
            <div className="flex items-center gap-2">
              <IngredientCombobox
                value={row.stockItemId}
                onChange={(value) => patchRow(i, { stockItemId: value })}
                options={stockItems}
                disabledIds={usedIds}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
                aria-label={`Remove ${item?.name ?? 'ingredient'}`}
                className="size-9 shrink-0 text-muted-foreground/60 hover:text-destructive"
              >
                <Trash2 size={16} />
              </Button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-end gap-x-4 gap-y-2.5">
              {columns.map((column) => (
                <div key={column.id}>
                  <label className="mb-1 block text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                    {column.label}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={row.qty[column.id] ?? ''}
                      onChange={(e) => patchRow(i, { qty: { ...row.qty, [column.id]: e.target.value } })}
                      // Enter must not submit a form this editor is nested in.
                      onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                      inputMode="decimal"
                      // A blank size field inherits the default, so show what it
                      // would inherit rather than a meaningless zero.
                      placeholder={column.id === DEFAULT_COL ? '0' : row.qty[DEFAULT_COL] || '—'}
                      aria-label={`${item?.name ?? 'Ingredient'} ${column.label} quantity`}
                      className={cn(
                        inputClass,
                        'w-20 text-right tabular-nums',
                        column.id !== DEFAULT_COL && !row.qty[column.id]?.trim() && 'text-muted-foreground',
                      )}
                    />
                    <span className="w-8 text-xs text-muted-foreground">{item?.unit ?? ''}</span>
                  </div>
                </div>
              ))}

              {/* Per-line cost sits with the line it belongs to, so a wrong
                  quantity is caught here rather than in a distant total. */}
              <p className="ml-auto self-end text-right text-sm font-semibold tabular-nums text-foreground">
                {lineCost == null ? (
                  <span className="text-label font-medium text-warning">No cost recorded</span>
                ) : (
                  formatMoney(lineCost, 2)
                )}
              </p>
            </div>
          </div>
        );
      })}

      {sizes.length > 0 && rows.length > 0 && (
        <p className="text-label text-muted-foreground">Leave a size blank to use the Default amount.</p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, { stockItemId: '', qty: {} }])}
        className="h-10 w-full gap-2 border-dashed"
      >
        <Plus size={16} />
        Add ingredient
      </Button>
    </div>
  );
}
