'use client';

import { Plus, Trash2 } from 'lucide-react';

import { inputClass, selectClass } from '@/components/menu/shared';
import { DEFAULT_COL, type SizeColumn, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { RecipeLine, RecipeLineInput } from '@/lib/api/recipes.service';
import { cn } from '@/lib/utils/cn';

export type { SizeColumn } from '@/components/menu/useRecipeDraft';

interface RecipeGridProps {
  queryKey: (string | undefined)[];
  fetchLines: () => Promise<RecipeLine[]>;
  saveLines: (lines: RecipeLineInput[]) => Promise<unknown>;
  /** Size modifiers rendered as extra quantity columns (empty cell = same as default). */
  sizes: SizeColumn[];
  /** Sale price (£) — enables the margin row. Omit for modifier recipes (they only add cost). */
  basePrice?: number;
  emptyHint: string;
}

/**
 * Compact size-aware recipe editor (used in the modifier modal): one row per
 * ingredient, a Default quantity column plus one per size modifier (blank =
 * inherits the default), and a per-column cost/kcal/allergen summary.
 */
export function RecipeGrid({ queryKey, fetchLines, saveLines, sizes, basePrice, emptyHint }: RecipeGridProps) {
  const { rows, edit, dirty, isLoading, save, stockItems, itemMap, usedIds, columns, summary, allAllergens, hasIngredients } =
    useRecipeDraft({ queryKey, fetchLines, saveLines, sizes, basePrice });

  if (isLoading) return <div className="h-16 rounded-lg bg-muted animate-pulse" />;

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-xs text-muted-foreground">{emptyHint}</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="text-left pb-1.5 font-bold">Ingredient</th>
                {columns.map((c) => (
                  <th key={c.id} className="text-right pb-1.5 px-1 font-bold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const item = itemMap.get(row.stockItemId);
                return (
                  <tr key={`${row.stockItemId}-${i}`}>
                    <td className="py-1 pr-1 min-w-40">
                      <select
                        value={row.stockItemId}
                        onChange={(e) => edit(rows.map((r, j) => (j === i ? { ...r, stockItemId: e.target.value } : r)))}
                        className={cn(selectClass, 'min-w-0')}
                      >
                        <option value="">Select ingredient…</option>
                        {stockItems
                          .filter((s) => s.id === row.stockItemId || !usedIds.has(s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.unit})
                            </option>
                          ))}
                      </select>
                    </td>
                    {columns.map((c) => (
                      <td key={c.id} className="py-1 px-1">
                        <input
                          value={row.qty[c.id] ?? ''}
                          onChange={(e) => edit(rows.map((r, j) => (j === i ? { ...r, qty: { ...r.qty, [c.id]: e.target.value } } : r)))}
                          onKeyDown={(e) => {
                            // Don't let Enter submit a surrounding form (would close the modal).
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          inputMode="decimal"
                          placeholder={c.id === DEFAULT_COL ? '0' : row.qty[DEFAULT_COL] || '—'}
                          aria-label={`${item?.name ?? 'Ingredient'} ${c.label} quantity`}
                          className={cn(
                            inputClass,
                            'w-16 md:w-20 text-right tabular-nums',
                            c.id !== DEFAULT_COL && !row.qty[c.id]?.trim() && 'text-muted-foreground',
                          )}
                        />
                      </td>
                    ))}
                    <td className="py-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => edit(rows.filter((_, j) => j !== i))}
                        aria-label="Remove ingredient"
                        className="text-muted-foreground/60 hover:text-destructive"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {sizes.length > 0 && rows.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Blank size cells use the Default amount — fill one only when the size differs.</p>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => edit([...rows, { stockItemId: '', qty: {} }])} className="gap-1.5">
        <Plus size={14} />
        Add ingredient
      </Button>

      {/* Per-column cost / nutrition summary */}
      {hasIngredients && (
        <div className="border-t border-border pt-3 space-y-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <th className="text-left font-bold" />
                {summary.map(({ col }) => (
                  <th key={col.id} className="text-right px-1 font-bold whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr>
                <td className="py-0.5 text-muted-foreground">Cost</td>
                {summary.map((s) => (
                  <td key={s.col.id} className="py-0.5 px-1 text-right font-semibold text-foreground">
                    £{s.cogs.toFixed(2)}
                    {s.missingCost > 0 && <span className="text-warning">*</span>}
                  </td>
                ))}
              </tr>
              {basePrice !== undefined && (
                <tr>
                  <td className="py-0.5 text-muted-foreground">Margin</td>
                  {summary.map((s) => {
                    const margin = (s.price ?? 0) - s.cogs;
                    const pct = s.price ? (margin / s.price) * 100 : 0;
                    return (
                      <td
                        key={s.col.id}
                        className={cn('py-0.5 px-1 text-right font-semibold', margin >= 0 ? 'text-success' : 'text-destructive')}
                      >
                        £{margin.toFixed(2)} <span className="text-muted-foreground font-normal">({pct.toFixed(0)}%)</span>
                      </td>
                    );
                  })}
                </tr>
              )}
              <tr>
                <td className="py-0.5 text-muted-foreground">Energy</td>
                {summary.map((s) => (
                  <td key={s.col.id} className="py-0.5 px-1 text-right text-foreground">
                    {Math.round(s.kcal)} kcal
                    {s.missingKcal > 0 && <span className="text-warning">*</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {(summary[0].missingCost > 0 || summary[0].missingKcal > 0) && (
            <p className="text-[11px] text-warning">* some ingredients are missing cost or nutrition data (set them on the stock item).</p>
          )}
          {allAllergens.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-1">Allergens</span>
              {allAllergens.map((a) => (
                <Badge key={a} variant="warning" className="capitalize">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {dirty && (
        <Button type="button" size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
          {save.isPending ? 'Saving…' : 'Save Recipe'}
        </Button>
      )}
    </div>
  );
}
