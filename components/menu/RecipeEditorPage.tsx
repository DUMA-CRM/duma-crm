'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { ChefHat, Flame, Loader2, Pencil, TriangleAlert } from '@/components/icons';
import { useState } from 'react';

import { ModifierRecipeEditor } from '@/components/menu/ModifierRecipeEditor';
import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { DEFAULT_COL, type SizeColumn, computeRecipeTotals, mergeNutrition, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';

import { NUTRITION_FIELDS, type NutritionFacts } from '@/lib/api/inventory.service';
import { getMenuItemModifiers } from '@/lib/api/menu.service';
import { getMenuItemRecipe, getModifierRecipe, setMenuItemRecipe } from '@/lib/api/recipes.service';
import { useVatContext } from '@/lib/hooks/useVatContext';
import { computeCosting } from '@/lib/menu/costing';
import { cn } from '@/lib/utils/cn';
import { isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import type { AttachedModifier } from '@/types/menu';

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
export function RecipeSummaryChips({ menuItemId, price, vatRate }: { menuItemId: string; price: string; vatRate?: string | null }) {
  const { rows, summary, allAllergens, isLoading, hasIngredients } = useRecipeDraft({
    queryKey: ['menu-item-recipe', menuItemId],
    fetchLines: () => getMenuItemRecipe(menuItemId),
    saveLines: () => Promise.resolve(),
    sizes: [],
    basePrice: Number(price) || 0,
    vatRate,
  });

  if (isLoading) return <div className="h-6 w-2/3 rounded bg-muted animate-pulse" />;
  if (!hasIngredients) return <p className="text-xs text-muted-foreground">No ingredients linked yet.</p>;

  const s = summary[0];
  const margin = s.costing?.margin ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <Badge variant="muted">{rows.filter((r) => r.stockItemId).length} ingredients</Badge>
      <Badge variant="muted">cost £{s.cogs.toFixed(2)}</Badge>
      <Badge variant={margin >= 0 ? 'success' : 'destructive'}>margin £{margin.toFixed(2)}</Badge>
      {/* Only worth the space when VAT actually changes the number. */}
      {(s.costing?.vat ?? 0) > 0 && <Badge variant="muted">after £{s.costing?.vat.toFixed(2)} VAT</Badge>}
      <Badge variant="muted">{Math.round(s.kcal)} kcal</Badge>
      {allAllergens.length > 0 && <Badge variant="warning">{allAllergens.length} allergens</Badge>}
    </div>
  );
}

interface RecipeEditorProps {
  menuItemId: string;
  /** Sale price of the menu item (decimal string). */
  price: string;
  /** Per-item VAT override; falls back to the tenant default. */
  vatRate?: string | null;
}

/**
 * Recipe editor body: per-ingredient rows with a quantity per size, and a
 * summary sidebar showing cost, margin, energy and allergens for every size.
 *
 * Deliberately renders no EditorShell. It is a tab inside the menu item detail
 * now, not a page of its own — the shell lives in the menu layout, and two
 * mounted at once would both try to claim the app top bar. Being a tab also
 * removes what used to be a fourth level of nesting to get here.
 */
export function RecipeEditor({ menuItemId, price, vatRate }: RecipeEditorProps) {
  const { ctx: vat } = useVatContext();
  // Size columns = this item's attached modifiers in the "Size" category.
  const { data: attached = [] } = useQuery({
    queryKey: ['menu-item-modifiers', menuItemId],
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  // isSizeModifier reads the real column when the API provides it and only
  // falls back to the old category === 'size' string match otherwise.
  const sizes: SizeColumn[] = attached
    .filter(isSizeModifier)
    .map((m) => ({ id: m.id, label: modifierLabel(m), priceAdjust: m.priceAdjust }));
  const { rows, edit, dirty, isLoading, save, stockItems, itemMap, usedIds, columns, summary, allAllergens, hasIngredients } =
    useRecipeDraft({
      queryKey: ['menu-item-recipe', menuItemId],
      fetchLines: () => getMenuItemRecipe(menuItemId),
      saveLines: (lines) => setMenuItemRecipe(menuItemId, lines),
      sizes,
      basePrice: Number(price) || 0,
      vatRate,
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
    const category = modifierCategory(m);
    let next: string[];
    if (selectedSet.has(m.id)) {
      next = selected.filter((id) => id !== m.id);
    } else if (category) {
      // Categorised modifiers (incl. Size) are single-select — replace siblings.
      const siblings = new Set(attached.filter((x) => modifierCategory(x) === category).map((x) => x.id));
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
  // Modifier price adjustments are part of the taxable amount, exactly as the
  // till treats them, so VAT comes off the combined price rather than the base.
  const comboCosting = computeCosting({ price: combo.price, cogs: combo.cost, itemVatRate: vatRate, ctx: vat });

  // Modifier being edited in the overlay (read-only page + jump link).
  const [editTarget, setEditTarget] = useState<AttachedModifier | null>(null);

  // Grouped chips for the combo preview (categorised first, like the POS).
  const comboGroups = (() => {
    const groups = new Map<string, AttachedModifier[]>();
    for (const m of attached) {
      const cat = modifierCategory(m) ?? 'Extras';
      groups.set(cat, [...(groups.get(cat) ?? []), m]);
    }
    return [...groups.entries()];
  })();

  return (
    <div className="flex flex-col">
      {/* Sticky because the ingredient list is long and unsaved work must never
          scroll out of sight — this tab has no shell-level discard guard. */}
      <div className="sticky top-0 z-20 -mx-3 mb-4 flex items-center justify-between gap-3 border-b border-rule bg-card px-3 py-2.5 md:-mx-6 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <ChefHat size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <p className="truncate text-sm font-semibold text-foreground">Recipe &amp; cost</p>
          {dirty && !save.isPending && <span className="shrink-0 text-label font-semibold text-warning">Unsaved changes</span>}
        </div>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="h-9 shrink-0 gap-2 px-5">
          {save.isPending && <Loader2 size={15} className="animate-spin" />}
          {save.isPending ? 'Saving…' : dirty ? 'Save recipe' : 'Saved'}
        </Button>
      </div>

      <>
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* ── Ingredients ── */}
            <section className="space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Ingredients</h2>
                {sizes.length > 0 && <p className="text-label text-muted-foreground">Blank size fields inherit the Default amount.</p>}
              </div>

              <RecipeIngredientEditor
                rows={rows}
                onChange={edit}
                columns={columns}
                stockItems={stockItems}
                itemMap={itemMap}
                usedIds={usedIds}
                sizes={sizes}
                emptyHint="Add the ingredients every variant of this item uses — beans, a cup, a lid. Milk and syrups belong on their modifiers instead, so they only cost what was actually chosen."
              />

              {/* ── Modifier add-ons (read-only + jump link) ── */}
              {attached.length > 0 && (
                <div className="pt-4">
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Modifier Add-ons</h2>
                  <div className="bg-card border border-rule rounded-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <DataTable className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted text-micro font-semibold text-muted-foreground uppercase tracking-micro">
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
                            const category = modifierCategory(m);
                            const label = modifierLabel(m);
                            const lines = modRecipeMap.get(m.id) ?? [];
                            return (
                              <tr key={m.id} className="border-t border-rule">
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-foreground">{label}</p>
                                  <p className="text-label text-muted-foreground">
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
                      </DataTable>
                    </div>
                    <p className="px-4 py-2.5 border-t border-rule text-label text-muted-foreground">
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
                <div className="bg-card border border-primary/30 rounded-sm p-4">
                  <h2 className="text-micro font-semibold text-primary uppercase tracking-micro mb-3">Try a combination</h2>
                  <div className="space-y-2.5">
                    {comboGroups.map(([category, mods]) => (
                      <div key={category}>
                        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro mb-1">{category}</p>
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
                                  'px-2.5 h-9 rounded-sm border text-xs font-medium transition-colors',
                                  on
                                    ? 'border-primary bg-band text-primary'
                                    : 'border-rule text-muted-foreground hover:text-foreground',
                                )}
                              >
                                {modifierLabel(m)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-rule space-y-1.5 text-sm tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-bold text-primary">£{comboCosting.grossCharged.toFixed(2)}</span>
                    </div>
                    {/* Only shown when VAT applies — an unregistered tenant
                        should not see a line that is always zero. */}
                    {comboCosting.vat > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VAT ({comboCosting.vatRate}%)</span>
                          <span className="text-muted-foreground">−£{comboCosting.vat.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">You keep</span>
                          <span className="font-semibold text-foreground">£{comboCosting.netRevenue.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ingredient cost</span>
                      <span className="font-semibold text-foreground">
                        −£{comboCosting.cogs.toFixed(2)}
                        {combo.missing > 0 && <span className="text-warning">*</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Margin</span>
                      <span className={cn('font-semibold', comboCosting.margin >= 0 ? 'text-success' : 'text-destructive')}>
                        £{comboCosting.margin.toFixed(2)} ({comboCosting.marginPct.toFixed(0)}%)
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
                  <div className="mt-2 pt-2 border-t border-rule">
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
                      className="mt-2.5 text-label font-medium text-primary hover:underline"
                    >
                      Reset to defaults
                    </button>
                  )}
                </div>
              )}

              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Base recipe per size</h2>

              {!hasIngredients ? (
                <div className="bg-card border border-rule rounded-sm p-4">
                  <p className="text-xs text-muted-foreground">Cost, margin and nutrition appear here once ingredients are added.</p>
                </div>
              ) : (
                summary.map((s) => {
                  const c = s.costing;
                  return (
                    <div key={s.col.id} className="bg-card border border-rule rounded-sm p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-foreground">{s.col.label}</p>
                        <p className="text-sm font-bold text-primary tabular-nums">£{(c?.grossCharged ?? s.price ?? 0).toFixed(2)}</p>
                      </div>
                      <div className="space-y-1.5 text-sm tabular-nums">
                        {(c?.vat ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">VAT ({c?.vatRate}%)</span>
                            <span className="text-muted-foreground">−£{c?.vat.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ingredient cost</span>
                          <span className="font-semibold text-foreground">
                            −£{s.cogs.toFixed(2)}
                            {s.missingCost > 0 && <span className="text-warning">*</span>}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin</span>
                          <span className={cn('font-semibold', (c?.margin ?? 0) >= 0 ? 'text-success' : 'text-destructive')}>
                            £{(c?.margin ?? 0).toFixed(2)} ({(c?.marginPct ?? 0).toFixed(0)}%)
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
                      <div className="mt-2 pt-2 border-t border-rule">
                        <MacroList nutrition={s.nutrition} missing={s.missingNutrition > 0} />
                      </div>
                    </div>
                  );
                })
              )}

              {allAllergens.length > 0 && (
                <div className="bg-card border border-rule rounded-sm p-4">
                  <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro mb-2">Allergens</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allAllergens.map((a) => (
                      <Badge key={a} variant="warning" className="capitalize">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-label text-muted-foreground">From base ingredients only — modifiers add their own.</p>
                </div>
              )}

              {missingData && (
                <div className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning/6 p-3.5">
                  <TriangleAlert size={15} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-warning">
                    Some ingredients are missing cost or nutrition data (*) — set them on the stock item in Inventory.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}

        {/* Modifier recipe editor overlay — same grid as the Modifiers tab. */}
        {editTarget && (
          <Modal title={`${modifierLabel(editTarget)} — Recipe`} onClose={() => setEditTarget(null)} className="max-w-xl">
            <ModifierRecipeEditor modifierId={editTarget.id} sizes={sizes.filter((s) => s.id !== editTarget.id)} />
          </Modal>
        )}
      </>
    </div>
  );
}
