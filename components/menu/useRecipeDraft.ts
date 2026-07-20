'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { NUTRITION_FIELDS, type NutritionFacts, type StockItem, getStockItems } from '@/lib/api/inventory.service';
import type { RecipeLine, RecipeLineInput } from '@/lib/api/recipes.service';
import { toast } from '@/stores/toastStore';

export const DEFAULT_COL = '';

// Grams/ml per recipe unit, so 'kg'/'l' quantities can be scaled against
// per-100g/ml nutrition. Unknown/count units use ×1.
const GRAMS_PER_UNIT: Record<string, number> = { g: 1, ml: 1, kg: 1000, l: 1000, litre: 1000, litres: 1000 };
export const unitFactor = (unit: string) => GRAMS_PER_UNIT[unit.trim().toLowerCase()] ?? 1;

// How many "basis amounts" a recipe quantity represents:
//  - per_100g / per_100ml → (qty × grams-per-unit) / 100
//  - per_piece            → qty as-is (one recipe unit = one piece)
function nutritionMultiplier(item: StockItem, qty: number): number {
  if (item.nutritionBasis === 'per_piece') return qty;
  return (qty * unitFactor(item.unit)) / 100;
}

export interface RecipeTotals {
  cost: number;
  /** Summed nutrition facts across all lines (kcal + macros in grams). */
  nutrition: NutritionFacts;
  allergens: string[];
  missingCost: number;
  /** Lines whose ingredient has no nutrition data. */
  missingNutrition: number;
}

export const emptyNutrition = (): NutritionFacts => ({});

/** Sum several nutrition objects field by field (absent fields ignored). */
export function mergeNutrition(parts: NutritionFacts[]): NutritionFacts {
  const out: NutritionFacts = {};
  for (const part of parts) {
    for (const { key } of NUTRITION_FIELDS) {
      const v = part[key];
      if (v != null) out[key] = (out[key] ?? 0) + v;
    }
  }
  return out;
}

/**
 * Totals for a set of recipe lines given the selected modifiers: per stock
 * item, a line whose sizeModifierId is in `selected` REPLACES the default
 * (null) line — the same resolution the API applies when recording usage.
 * Nutrition sums every field the ingredient declares, scaled by its basis.
 */
export function computeRecipeTotals(
  lines: { stockItemId: string; sizeModifierId?: string | null; quantity: string }[],
  selected: Set<string>,
  itemMap: Map<string, StockItem>,
): RecipeTotals {
  const perStock = new Map<string, { def?: number; override?: number }>();
  for (const line of lines) {
    const entry = perStock.get(line.stockItemId) ?? {};
    if (line.sizeModifierId == null) entry.def = Number(line.quantity);
    else if (selected.has(line.sizeModifierId)) entry.override = Number(line.quantity);
    perStock.set(line.stockItemId, entry);
  }

  const totals: RecipeTotals = { cost: 0, nutrition: emptyNutrition(), allergens: [], missingCost: 0, missingNutrition: 0 };
  const allergens = new Set<string>();
  for (const [stockItemId, entry] of perStock) {
    const qty = entry.override ?? entry.def;
    const item = itemMap.get(stockItemId);
    if (!qty || !item) continue;
    if (item.costPerUnit == null) totals.missingCost++;
    else totals.cost += qty * Number(item.costPerUnit);

    if (item.nutrition == null || item.nutritionBasis == null) totals.missingNutrition++;
    else {
      const mult = nutritionMultiplier(item, qty);
      for (const { key } of NUTRITION_FIELDS) {
        const v = item.nutrition[key];
        if (v != null) totals.nutrition[key] = (totals.nutrition[key] ?? 0) + v * mult;
      }
    }
    for (const a of item.allergens ?? []) allergens.add(a);
  }
  totals.allergens = [...allergens].sort();
  return totals;
}

export interface SizeColumn {
  id: string;
  label: string;
  /** Price adjustment of the size modifier (decimal string £) — used for per-size margin. */
  priceAdjust?: string;
}

export interface RecipeRow {
  stockItemId: string;
  /** Quantities keyed by column: '' = default, otherwise a size modifier id. */
  qty: Record<string, string>;
}

interface UseRecipeDraftArgs {
  queryKey: (string | undefined)[];
  fetchLines: () => Promise<RecipeLine[]>;
  saveLines: (lines: RecipeLineInput[]) => Promise<unknown>;
  sizes: SizeColumn[];
  /** Sale price (£) — enables margin in the summary. */
  basePrice?: number;
}

/**
 * Shared state/derivations for the size-aware recipe editors (compact grid in
 * the modifier modal + the full-page editor). Rows hold a Default quantity and
 * per-size overrides; the summary computes cost/margin/kcal/allergens per
 * column from the ingredients' stock data.
 */
export function useRecipeDraft({ queryKey, fetchLines, saveLines, sizes, basePrice }: UseRecipeDraftArgs) {
  const qc = useQueryClient();
  const { data: recipe = [], isLoading } = useQuery({ queryKey, queryFn: fetchLines });
  const { data: stockItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });

  // Draft starts null (mirror server); first edit copies server state in — no effects.
  const [draft, setDraft] = useState<RecipeRow[] | null>(null);

  const serverRows: RecipeRow[] = (() => {
    const byStock = new Map<string, RecipeRow>();
    for (const line of recipe) {
      const row = byStock.get(line.stockItemId) ?? { stockItemId: line.stockItemId, qty: {} };
      row.qty[line.sizeModifierId ?? DEFAULT_COL] = String(Number(line.quantity));
      byStock.set(line.stockItemId, row);
    }
    return [...byStock.values()];
  })();
  const rows = draft ?? serverRows;
  const dirty = draft !== null;
  const edit = (next: RecipeRow[]) => setDraft(next);

  const save = useMutation({
    mutationFn: () => {
      const lines: RecipeLineInput[] = [];
      for (const row of rows) {
        if (!row.stockItemId) continue;
        const def = Number(row.qty[DEFAULT_COL]);
        if (def > 0) lines.push({ stockItemId: row.stockItemId, quantity: def });
        for (const size of sizes) {
          const v = Number(row.qty[size.id]);
          if (row.qty[size.id]?.trim() && v > 0) lines.push({ stockItemId: row.stockItemId, sizeModifierId: size.id, quantity: v });
        }
      }
      return saveLines(lines);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setDraft(null);
      toast('success', 'Recipe saved.');
    },
    onError: (err) => toast('error', err.message || 'Failed to save the recipe.'),
  });

  const itemMap = new Map(stockItems.map((s) => [s.id, s]));
  const usedIds = new Set(rows.map((r) => r.stockItemId));

  // Effective quantity for a column (size falls back to default).
  const qtyFor = (row: RecipeRow, col: string): number => {
    const raw = col !== DEFAULT_COL && row.qty[col]?.trim() ? row.qty[col] : row.qty[DEFAULT_COL];
    return Number(raw) || 0;
  };

  const columns: SizeColumn[] = [{ id: DEFAULT_COL, label: sizes.length > 0 ? 'Default' : 'Qty' }, ...sizes];

  // Per-column totals via the shared resolver (default vs size override).
  const draftLines = rows.flatMap((row) =>
    Object.entries(row.qty)
      .filter(([, v]) => v?.trim())
      .map(([col, v]) => ({ stockItemId: row.stockItemId, sizeModifierId: col === DEFAULT_COL ? null : col, quantity: v })),
  );
  const summary = columns.map((col) => {
    const t = computeRecipeTotals(draftLines, col.id === DEFAULT_COL ? new Set<string>() : new Set([col.id]), itemMap);
    const price = basePrice !== undefined ? basePrice + Number(col.priceAdjust ?? 0) : undefined;
    // `cogs`/`kcal`/`missingKcal` kept as aliases so existing consumers work.
    return {
      col,
      cogs: t.cost,
      kcal: t.nutrition.kcal ?? 0,
      nutrition: t.nutrition,
      missingCost: t.missingCost,
      missingKcal: t.missingNutrition,
      missingNutrition: t.missingNutrition,
      allergens: t.allergens,
      price,
    };
  });

  const allAllergens = [...new Set(summary.flatMap((s) => s.allergens))].sort();
  const hasIngredients = rows.some((r) => r.stockItemId);

  return { rows, edit, dirty, isLoading, save, stockItems, itemMap, usedIds, qtyFor, columns, summary, allAllergens, hasIngredients };
}
