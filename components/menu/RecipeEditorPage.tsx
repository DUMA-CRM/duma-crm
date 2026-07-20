'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Flame, Loader2, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ModifierRecipeEditor } from '@/components/menu/ModifierRecipeEditor';
import { inputClass, selectClass } from '@/components/menu/shared';
import { DEFAULT_COL, type SizeColumn, computeRecipeTotals, mergeNutrition, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { NUTRITION_FIELDS, type NutritionFacts } from '@/lib/api/inventory.service';
import { getMenuItemModifiers } from '@/lib/api/menu.service';
import { getMenuItemRecipe, getModifierRecipe, setMenuItemRecipe } from '@/lib/api/recipes.service';
import type { AttachedModifier } from '@/types/menu';
import { cn } from '@/lib/utils/cn';
import { parseModifierName } from '@/lib/utils/modifiers';

/** Compact macro list (skips kcal — shown separately — and absent fields). */
function MacroList({ nutrition, missing }: { nutrition: NutritionFacts; missing?: boolean }) {
  const rows = NUTRITION_FIELDS.filter((f) => f.key !== 'kcal' && nutrition[f.key] != null);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1 text-sm tabular-nums">
      {rows.map((f) => (
        <div key={f.key} className="flex justify-between">
          <span className="text-muted-foreground">{f.label}</span>
          <span className="text-foreground">
            {(nutrition[f.key] ?? 0).toFixed(1)} {f.unit}
            {missing && <span className="text-warning">*</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Compact read-only summary shown on the Recipe & Cost card in the item modal:
 * ingredient count, default cost/margin/energy and allergen count.
 */
export function RecipeSummaryChips({ menuItemId, price }: { menuItemId: string; price: string }) {
  const { rows, summary, allAllergens, isLoading, hasIngredients } = useRecipeDraft({
    queryKey: ['menu-item-recipe', menuItemId],
    fetchLines: () => getMenuItemRecipe(menuItemId),
    saveLines: () => Promise.resolve(),
    sizes: [],
    basePrice: Number(price) || 0,
  });

  if (isLoading) return <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />;
  if (!hasIngredients) return <p className="text-xs text-muted-foreground">No ingredients linked yet.</p>;

  const s = summary[0];
  const margin = (s.price ?? 0) - s.cogs;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="muted">{rows.filter((r) => r.stockItemId).length} ingredients</Badge>
      <Badge variant="muted">cost £{s.cogs.toFixed(2)}</Badge>
      <Badge variant={margin >= 0 ? 'success' : 'destructive'}>margin £{margin.toFixed(2)}</Badge>
      <Badge variant="muted">{Math.round(s.kcal)} kcal</Badge>
      {allAllergens.length > 0 && <Badge variant="warning">{allAllergens.length} allergens</Badge>}
    </div>
  );
}

interface RecipeEditorPageProps {
  menuItemId: string;
  itemName: string;
  /** Sale price of the menu item (decimal string). */
  price: string;
  onClose: () => void;
}

/**
 * Full-screen recipe editor (checkout-style takeover): roomy per-ingredient
 * cards with a quantity input per size, and a sticky summary sidebar showing
 * cost, margin, energy and allergens for every size. Opens from the menu item
 * modal's Recipe & Cost card.
 */
export function RecipeEditorPage({ menuItemId, itemName, price, onClose }: RecipeEditorPageProps) {
  // Size columns = this item's attached modifiers in the "Size" category.
  const { data: attached = [] } = useQuery({
    queryKey: ['menu-item-modifiers', menuItemId],
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  const sizes: SizeColumn[] = attached
    .filter((m) => parseModifierName(m.name).category?.toLowerCase() === 'size')
    .map((m) => ({ id: m.id, label: parseModifierName(m.name).label, priceAdjust: m.priceAdjust }));
  const { rows, edit, dirty, isLoading, save, stockItems, itemMap, usedIds, columns, summary, allAllergens, hasIngredients } =
    useRecipeDraft({
      queryKey: ['menu-item-recipe', menuItemId],
      fetchLines: () => getMenuItemRecipe(menuItemId),
      saveLines: (lines) => setMenuItemRecipe(menuItemId, lines),
      sizes,
      basePrice: Number(price) || 0,
    });

  const missingData = summary.some((s) => s.missingCost > 0 || s.missingKcal > 0);

  // Every attached modifier's recipe — powers the add-on table and the combo
  // preview. Cache keys match the modifier editor, so edits reflect instantly.
  const modifierRecipeQueries = useQueries({
    queries: attached.map((m) => ({
      queryKey: ['modifier-recipe', m.id],
      queryFn: () => getModifierRecipe(m.id),
    })),
  });
  const modRecipeMap = new Map(attached.map((m, i) => [m.id, modifierRecipeQueries[i]?.data ?? []]));

  // ── Combination preview state (defaults pre-selected, like the POS) ──────────
  const [comboSel, setComboSel] = useState<string[] | null>(null);
  const selected = comboSel ?? attached.filter((m) => m.isDefault).map((m) => m.id);
  const selectedSet = new Set(selected);
  const toggleCombo = (m: AttachedModifier) => {
    const { category } = parseModifierName(m.name);
    let next: string[];
    if (selectedSet.has(m.id)) {
      next = selected.filter((id) => id !== m.id);
    } else if (category) {
      // Categorised modifiers (incl. Size) are single-select — replace siblings.
      const siblings = new Set(
        attached.filter((x) => parseModifierName(x.name).category === category).map((x) => x.id),
      );
      next = [...selected.filter((id) => !siblings.has(id)), m.id];
    } else {
      next = [...selected, m.id];
    }
    setComboSel(next);
  };

  // Combo totals: base recipe resolved against the selected size + each
  // selected modifier's recipe (with its own size overrides).
  const baseLines = rows.flatMap((row) =>
    Object.entries(row.qty)
      .filter(([, v]) => v?.trim())
      .map(([col, v]) => ({ stockItemId: row.stockItemId, sizeModifierId: col === DEFAULT_COL ? null : col, quantity: v })),
  );
  const comboBase = computeRecipeTotals(baseLines, selectedSet, itemMap);
  const comboParts = selected.map((id) => computeRecipeTotals(modRecipeMap.get(id) ?? [], selectedSet, itemMap));
  const comboAll = [comboBase, ...comboParts];
  // Sum every nutrition field across base + selected modifiers.
  const comboNutrition = mergeNutrition(comboAll.map((t) => t.nutrition));
  const combo = {
    cost: comboAll.reduce((s, p) => s + p.cost, 0),
    nutrition: comboNutrition,
    allergens: [...new Set(comboAll.flatMap((p) => p.allergens))].sort(),
    missing: comboAll.reduce((s, p) => s + p.missingCost + p.missingNutrition, 0),
    price: (Number(price) || 0) + selected.reduce((s, id) => s + Number(attached.find((m) => m.id === id)?.priceAdjust ?? 0), 0),
  };
  const comboMargin = combo.price - combo.cost;

  // Modifier being edited in the overlay (read-only page + jump link).
  const [editTarget, setEditTarget] = useState<AttachedModifier | null>(null);

  // Grouped chips for the combo preview (categorised first, like the POS).
  const comboGroups = (() => {
    const groups = new Map<string, AttachedModifier[]>();
    for (const m of attached) {
      const cat = parseModifierName(m.name).category ?? 'Extras';
      groups.set(cat, [...(groups.get(cat) ?? []), m]);
    }
    return [...groups.entries()];
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to item" className="size-11 shrink-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Recipe &amp; Cost</p>
            <h1 className="text-lg font-semibold text-foreground truncate">
              {itemName} <span className="text-muted-foreground font-normal">· £{(Number(price) || 0).toFixed(2)}</span>
            </h1>
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="h-11 px-6 shrink-0 gap-2">
          {save.isPending && <Loader2 size={15} className="animate-spin" />}
          {save.isPending ? 'Saving…' : dirty ? 'Save Recipe' : 'Saved'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto p-4 md:p-8 grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* ── Ingredients ── */}
            <section className="space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Ingredients</h2>
                {sizes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">Blank size fields inherit the Default amount.</p>
                )}
              </div>

              {rows.length === 0 && (
                <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Add the ingredients <span className="font-semibold text-foreground">every variant</span> of this item uses (beans,
                    lid…). Milk and syrups belong on their modifiers — edit a modifier in the Modifiers tab to set what it adds.
                  </p>
                </div>
              )}

              {rows.map((row, i) => {
                const item = itemMap.get(row.stockItemId);
                return (
                  <div key={`${row.stockItemId}-${i}`} className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={row.stockItemId}
                        onChange={(e) => edit(rows.map((r, j) => (j === i ? { ...r, stockItemId: e.target.value } : r)))}
                        className={cn(selectClass, 'flex-1 min-w-0 h-11')}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => edit(rows.filter((_, j) => j !== i))}
                        aria-label="Remove ingredient"
                        className="size-11 text-muted-foreground/60 hover:text-destructive shrink-0"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-3">
                      {columns.map((c) => (
                        <div key={c.id}>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {c.label}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              value={row.qty[c.id] ?? ''}
                              onChange={(e) =>
                                edit(rows.map((r, j) => (j === i ? { ...r, qty: { ...r.qty, [c.id]: e.target.value } } : r)))
                              }
                              inputMode="decimal"
                              placeholder={c.id === DEFAULT_COL ? '0' : row.qty[DEFAULT_COL] || '—'}
                              aria-label={`${item?.name ?? 'Ingredient'} ${c.label} quantity`}
                              className={cn(
                                inputClass,
                                'w-24 h-11 text-right tabular-nums text-base',
                                c.id !== DEFAULT_COL && !row.qty[c.id]?.trim() && 'text-muted-foreground',
                              )}
                            />
                            <span className="text-xs text-muted-foreground w-8">{item?.unit ?? ''}</span>
                          </div>
                        </div>
                      ))}
                      {item?.costPerUnit != null && (
                        <div className="ml-auto self-end text-right">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Cost</p>
                          <p className="text-sm font-semibold text-foreground tabular-nums h-11 flex items-center justify-end">
                            £{((Number(row.qty[DEFAULT_COL]) || 0) * Number(item.costPerUnit)).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={() => edit([...rows, { stockItemId: '', qty: {} }])}
                className="w-full h-12 gap-2 border-dashed"
              >
                <Plus size={16} />
                Add ingredient
              </Button>

              {/* ── Modifier add-ons (read-only + jump link) ── */}
              {attached.length > 0 && (
                <div className="pt-4">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Modifier Add-ons</h2>
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            <th className="px-4 py-2.5 text-left">Modifier</th>
                            <th className="px-3 py-2.5 text-right">+Price</th>
                            {columns.map((c) => (
                              <th key={c.id} className="px-3 py-2.5 text-right whitespace-nowrap">
                                {c.label}
                              </th>
                            ))}
                            <th className="w-12" />
                          </tr>
                        </thead>
                        <tbody>
                          {attached.map((m) => {
                            const { category, label } = parseModifierName(m.name);
                            const lines = modRecipeMap.get(m.id) ?? [];
                            return (
                              <tr key={m.id} className="border-t border-border/50">
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-foreground">{label}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {category ?? 'Extra'}
                                    {m.isDefault && ' · default'}
                                  </p>
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                  {Number(m.priceAdjust) ? `+£${Number(m.priceAdjust).toFixed(2)}` : '—'}
                                </td>
                                {columns.map((c) => {
                                  if (lines.length === 0) {
                                    return (
                                      <td key={c.id} className="px-3 py-2.5 text-right text-muted-foreground">
                                        —
                                      </td>
                                    );
                                  }
                                  const t = computeRecipeTotals(lines, c.id === DEFAULT_COL ? new Set() : new Set([c.id]), itemMap);
                                  return (
                                    <td key={c.id} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                                      <span className="font-semibold text-foreground">£{t.cost.toFixed(2)}</span>
                                      <span className="text-muted-foreground"> · {Math.round(t.nutrition.kcal ?? 0)} kcal</span>
                                      {(t.missingCost > 0 || t.missingNutrition > 0) && <span className="text-warning">*</span>}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-2.5 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditTarget(m)}
                                    aria-label={`Edit ${label} recipe`}
                                    className="text-muted-foreground/60 hover:text-foreground"
                                  >
                                    <Pencil size={14} />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
                      What each modifier adds on top of the base recipe, per size. “—” means no recipe yet — use the pencil to set one.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* ── Summary sidebar ── */}
            <aside className="space-y-4 lg:sticky lg:top-4">
              {/* Combination preview — build a drink like the POS would sell it */}
              {attached.length > 0 && (
                <div className="bg-card border border-primary/30 rounded-2xl p-4">
                  <h2 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Try a combination</h2>
                  <div className="space-y-2.5">
                    {comboGroups.map(([category, mods]) => (
                      <div key={category}>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {mods.map((m) => {
                            const on = selectedSet.has(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleCombo(m)}
                                aria-pressed={on}
                                className={cn(
                                  'px-2.5 h-9 rounded-lg border text-xs font-medium transition-colors',
                                  on
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {parseModifierName(m.name).label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-bold text-primary">£{combo.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingredient cost</span>
                      <span className="font-semibold text-foreground">
                        £{combo.cost.toFixed(2)}
                        {combo.missing > 0 && <span className="text-warning">*</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin</span>
                      <span className={cn('font-semibold', comboMargin >= 0 ? 'text-success' : 'text-destructive')}>
                        £{comboMargin.toFixed(2)} ({combo.price > 0 ? ((comboMargin / combo.price) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Flame size={13} aria-hidden="true" />
                        Energy
                      </span>
                      <span className="text-foreground">{Math.round(combo.nutrition.kcal ?? 0)} kcal</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <MacroList nutrition={combo.nutrition} missing={combo.missing > 0} />
                  </div>
                  {combo.allergens.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {combo.allergens.map((a) => (
                        <Badge key={a} variant="warning" className="capitalize">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {comboSel !== null && (
                    <button
                      type="button"
                      onClick={() => setComboSel(null)}
                      className="mt-2.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      Reset to defaults
                    </button>
                  )}
                </div>
              )}

              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Base recipe per size</h2>

              {!hasIngredients ? (
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-xs text-muted-foreground">Cost, margin and nutrition appear here once ingredients are added.</p>
                </div>
              ) : (
                summary.map((s) => {
                  const margin = (s.price ?? 0) - s.cogs;
                  const pct = s.price ? (margin / s.price) * 100 : 0;
                  return (
                    <div key={s.col.id} className="bg-card border border-border rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-foreground">{s.col.label}</p>
                        <p className="text-sm font-bold text-primary tabular-nums">£{(s.price ?? 0).toFixed(2)}</p>
                      </div>
                      <div className="space-y-1.5 text-sm tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ingredient cost</span>
                          <span className="font-semibold text-foreground">
                            £{s.cogs.toFixed(2)}
                            {s.missingCost > 0 && <span className="text-warning">*</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin</span>
                          <span className={cn('font-semibold', margin >= 0 ? 'text-success' : 'text-destructive')}>
                            £{margin.toFixed(2)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Flame size={13} aria-hidden="true" />
                            Energy
                          </span>
                          <span className="text-foreground">
                            {Math.round(s.nutrition.kcal ?? 0)} kcal
                            {s.missingNutrition > 0 && <span className="text-warning">*</span>}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border/60">
                        <MacroList nutrition={s.nutrition} missing={s.missingNutrition > 0} />
                      </div>
                    </div>
                  );
                })
              )}

              {allAllergens.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Allergens</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allAllergens.map((a) => (
                      <Badge key={a} variant="warning" className="capitalize">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">From base ingredients only — modifiers add their own.</p>
                </div>
              )}

              {missingData && (
                <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3.5">
                  <TriangleAlert size={15} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-warning">
                    Some ingredients are missing cost or nutrition data (*) — set them on the stock item in Inventory.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {/* Modifier recipe editor overlay — same grid as the Modifiers tab.
          Rendered inside this page's stacking context, so it sits on top. */}
      {editTarget && (
        <Modal
          title={`${parseModifierName(editTarget.name).label} — Recipe`}
          onClose={() => setEditTarget(null)}
          className="max-w-xl"
        >
          <ModifierRecipeEditor modifierId={editTarget.id} sizes={sizes.filter((s) => s.id !== editTarget.id)} />
        </Modal>
      )}
    </div>
  );
}
