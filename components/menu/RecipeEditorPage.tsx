'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Check, ChefHat, Flame, Pencil, Plus, RotateCcw, Scale, SlidersHorizontal, TriangleAlert } from '@/components/icons';
import { ModifierRecipeDrawer } from '@/components/menu/ModifierRecipeEditor';
import { RecipeIngredientEditor } from '@/components/menu/RecipeIngredientEditor';
import { Figure } from '@/components/menu/RecipeTotals';
import { AllergenChip } from '@/components/menu/shared';
import { DEFAULT_COL, type SizeColumn, computeRecipeTotals, mergeNutrition, useRecipeDraft } from '@/components/menu/useRecipeDraft';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { LoadingState } from '@/components/shared/Skeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { useVatContext } from '@/lib/hooks/useVatContext';
import { computeCosting } from '@/lib/menu/costing';
import { getMenuItemModifierGroups, getMenuItemModifiers } from '@/lib/modules/catalog/client';
import { NUTRITION_FIELDS, type NutritionFacts } from '@/lib/modules/inventory/client';
import { getMenuItemRecipe, getModifierRecipe, setMenuItemRecipe } from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type ComboRule, FALLBACK_RULE, ruleLabel, satisfied, toggleOption } from '@/lib/utils/combo';
import { isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import type { AttachedModifier } from '@/types/menu';

/** Compact macro list (skips kcal — shown separately — and absent fields). */
function MacroList({ nutrition, missing }: { nutrition: NutritionFacts; missing?: boolean }) {
  const rows = NUTRITION_FIELDS.filter((f) => f.key !== 'kcal' && nutrition[f.key] != null);
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-rule/45 pt-1.5 text-xs tabular-nums">
      {rows.map((f) => (
        <div key={f.key} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{f.label}</span>
          <span className="text-foreground">
            {(nutrition[f.key] ?? 0).toFixed(1)} {f.unit}
            {missing && <span className="text-measured">*</span>}
          </span>
        </div>
      ))}
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
  const formatMoney = useFormatMoney();
  const { ctx: vat } = useVatContext();
  // Size columns = this item's attached modifiers in the "Size" category.
  const { data: attached = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId),
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  // isSizeModifier reads the real column when the API provides it and only
  // falls back to the old category === 'size' string match otherwise.
  const sizes: SizeColumn[] = attached
    .filter(isSizeModifier)
    .map((m) => ({ id: m.id, label: modifierLabel(m), priceAdjust: m.priceAdjust }));
  // A size pre-selected at the till makes the size-less amount an inherited
  // base rather than something sold — see `defaultIsSize`.
  const defaultSize = attached.find((m) => isSizeModifier(m) && m.isDefault);
  const [justSaved, flashSaved] = useDoneBeat();
  const { rows, edit, dirty, isLoading, save, stockItems, itemMap, usedIds, columns, summary, allAllergens, hasIngredients } =
    useRecipeDraft({
      defaultIsSize: Boolean(defaultSize),
      queryKey: moduleQueryKeys.inventory.key('menu-item-recipe', menuItemId),
      fetchLines: () => getMenuItemRecipe(menuItemId),
      saveLines: (lines) => setMenuItemRecipe(menuItemId, lines),
      sizes,
      basePrice: Number(price) || 0,
      vatRate,
    });

  const missingData = summary.some((s) => s.missingCost > 0 || s.missingKcal > 0);
  const shownSummary = summary;
  // The columns something is actually sold at — the add-on figures skip the inherited base.
  const soldColumns = defaultSize && columns.length > 1 ? columns.filter((c) => c.id !== DEFAULT_COL) : columns;

  // Every attached modifier's recipe — powers the add-on table and the combo
  // preview. Cache keys match the modifier editor, so edits reflect instantly.
  const modifierRecipeQueries = useQueries({
    queries: attached.map((m) => ({
      queryKey: moduleQueryKeys.inventory.key('modifier-recipe', m.id),
      queryFn: () => getModifierRecipe(m.id),
    })),
  });
  const modRecipeMap = new Map(attached.map((m, i) => [m.id, modifierRecipeQueries[i]?.data ?? []]));

  // ── Combination preview state (defaults pre-selected, like the POS) ──────────
  const [comboSel, setComboSel] = useState<string[] | null>(null);
  const selected = comboSel ?? attached.filter((m) => m.isDefault).map((m) => m.id);
  const selectedSet = new Set(selected);
  // The item's group rules (required/optional, choose one/many) — the same
  // query the Details tab edits — so the preview behaves as the till will.
  const { data: groupRules = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', menuItemId),
    queryFn: () => getMenuItemModifierGroups(menuItemId),
  });
  const ruleFor = (m: AttachedModifier): ComboRule => {
    const rule = m.groupId ? groupRules.find((entry) => entry.id === m.groupId) : undefined;
    if (rule) return { minSelections: rule.minSelections, maxSelections: rule.maxSelections };
    // No group rule: categorised options behave as "choose one", loose extras as "choose any".
    return modifierCategory(m) ? FALLBACK_RULE : { minSelections: 0, maxSelections: null };
  };
  const groupIdsOf = (m: AttachedModifier) => {
    const category = modifierCategory(m) ?? 'Extras';
    return attached.filter((x) => (modifierCategory(x) ?? 'Extras') === category).map((x) => x.id);
  };
  const toggleCombo = (m: AttachedModifier) => setComboSel(toggleOption(selected, m.id, groupIdsOf(m), ruleFor(m)));

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

  const money = (n: number) => formatMoney(n, 2);

  return (
    <div className="flex flex-col">
      {/* Sticky because the ingredient list is long and unsaved work must never
          scroll out of sight — this tab has no shell-level discard guard. */}
      <div className="sticky top-0 z-20 -mx-3 -mt-4 mb-5 flex items-center justify-between gap-3 border-b border-rule/60 bg-background/95 px-3 py-2.5 backdrop-blur md:-mx-6 md:-mt-6 md:px-6 lg:-mt-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary" aria-hidden="true">
            <ChefHat size={16} />
          </span>
          {/* The tab already says "Recipe & cost" and the button says Saved/Saving —
              the bar only speaks up when there is unsaved work. */}
          {dirty && !save.isPending && <p className="truncate text-sm font-semibold text-measured">Unsaved changes</p>}
        </div>
        <ActionButton
          onClick={() => save.mutate(undefined, { onSuccess: flashSaved })}
          disabled={!dirty}
          pending={save.isPending}
          done={justSaved}
          className="h-9 min-w-32 shrink-0 px-5"
        >
          {dirty ? 'Save recipe' : 'Saved'}
        </ActionButton>
      </div>

      {isLoading ? (
        <LoadingState label="Loading the recipe" />
      ) : (
        <SettingsTabBody
          stickyAside
          narrowAside
          aside={
            <>
              {/* Combination preview — build a drink the way the till sells it. */}
              {attached.length > 0 && (
                <SettingsSection
                  title="Try a combination"
                  description="Build one the way the till sells it — defaults are pre-selected."
                  actions={
                    comboSel !== null ? (
                      <Button variant="ghost" size="sm" onClick={() => setComboSel(null)}>
                        <RotateCcw aria-hidden="true" /> Reset
                      </Button>
                    ) : undefined
                  }
                >
                  <div className="space-y-3">
                    {comboGroups.map(([category, mods]) => {
                      const rule = ruleFor(mods[0]!);
                      const ids = mods.map((m) => m.id);
                      const unmet = !satisfied(selected, ids, rule);
                      return (
                        <div key={category}>
                          <p className="mb-1.5 flex items-center gap-2 text-label uppercase text-muted-foreground">
                            {category}
                            <span className={cn('normal-case', unmet ? 'font-semibold text-exception' : 'text-muted-foreground/80')}>
                              {unmet ? `Choose ${rule.minSelections === 1 ? 'one' : rule.minSelections}` : ruleLabel(rule)}
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {mods.map((m) => {
                              const on = selectedSet.has(m.id);
                              const adjust = Number(m.priceAdjust) || 0;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => toggleCombo(m)}
                                  aria-pressed={on}
                                  className={cn(
                                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors',
                                    on
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-rule/60 bg-background/60 text-foreground hover:bg-band/40',
                                  )}
                                >
                                  {on && <Check size={12} aria-hidden="true" />}
                                  {modifierLabel(m)}
                                  {adjust !== 0 && (
                                    <span className={cn('tabular-nums', on ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                                      {adjust > 0 ? '+' : '−'}
                                      {money(Math.abs(adjust))}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <ComboResult
                    name={
                      attached
                        .filter((m) => selectedSet.has(m.id))
                        .map(modifierLabel)
                        .join(' · ') || 'No options'
                    }
                    costing={comboCosting}
                    kcal={combo.nutrition.kcal ?? 0}
                    nutrition={combo.nutrition}
                    allergens={combo.allergens}
                    incomplete={combo.missing > 0}
                    money={money}
                  />
                </SettingsSection>
              )}

              <motion.section variants={SECTION_RISE} aria-labelledby="base-recipe" className="space-y-3">
                <div>
                  <h2 id="base-recipe" className="text-base font-semibold tracking-title text-foreground">
                    Base recipe per size
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Without any modifiers.
                    {defaultSize &&
                      ` ${modifierLabel(defaultSize)} is the default size, so the size-less amount isn’t shown — it’s never sold on its own.`}
                  </p>
                </div>
                {!hasIngredients ? (
                  <p className="rounded-lg border border-dashed border-rule/70 px-4 py-3 text-sm text-muted-foreground">
                    Cost, margin and nutrition appear here once ingredients are added.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shownSummary.map((s) => {
                      const c = s.costing;
                      return (
                        <div key={s.col.id} className="rounded-lg border border-rule/60 bg-card px-3.5 py-3">
                          <div className="mb-2 flex items-baseline justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">{s.col.label}</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground">{money(c?.grossCharged ?? s.price ?? 0)}</p>
                          </div>
                          <dl className="space-y-1.5 text-sm tabular-nums">
                            {(c?.vat ?? 0) > 0 && <Figure label={`VAT (${c?.vatRate}%)`} value={`−${money(c?.vat ?? 0)}`} />}
                            <Figure label="Ingredient cost" value={`−${money(s.cogs)}`} incomplete={s.missingCost > 0} />
                            <Figure
                              label="Margin"
                              value={
                                <>
                                  {money(c?.margin ?? 0)}{' '}
                                  <span className="font-normal text-muted-foreground">({(c?.marginPct ?? 0).toFixed(0)}%)</span>
                                </>
                              }
                              strong
                              tone={(c?.margin ?? 0) >= 0 ? 'good' : 'bad'}
                            />
                            <Figure
                              label={
                                <>
                                  <Flame size={13} aria-hidden="true" /> Energy
                                </>
                              }
                              value={`${Math.round(s.nutrition.kcal ?? 0)} kcal`}
                              incomplete={s.missingNutrition > 0}
                            />
                            <MacroList nutrition={s.nutrition} missing={s.missingNutrition > 0} />
                          </dl>
                        </div>
                      );
                    })}
                    {allAllergens.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-label uppercase text-muted-foreground">Allergens</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allAllergens.map((a) => (
                            <AllergenChip key={a} allergen={a} />
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">From base ingredients only — modifiers add their own.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.section>

              {missingData && (
                <p className="flex items-start gap-2 rounded-lg bg-measured/10 px-3.5 py-3 text-xs leading-relaxed text-measured">
                  <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                  Some ingredients are missing cost or nutrition (*) — set them on the stock item in Inventory.
                </p>
              )}
            </>
          }
        >
          <SettingsSection
            title="Ingredients"
            description="What every size of this item uses — beans, a cup, a lid. Milk and syrups belong on their modifiers, so they only cost what was chosen."
          >
            <RecipeIngredientEditor
              rows={rows}
              onChange={edit}
              columns={columns}
              stockItems={stockItems}
              itemMap={itemMap}
              usedIds={usedIds}
              sizes={sizes}
              emptyHint="No ingredients yet. Add the first — for a flat white, 18 g of beans, a cup and a lid."
            />
          </SettingsSection>

          {attached.length > 0 && (
            <motion.section variants={SECTION_RISE} aria-labelledby="modifier-addons" className="space-y-4">
              <h2 id="modifier-addons" className="text-base font-semibold tracking-title text-foreground">
                Modifier add-ons
              </h2>
              <div className="space-y-4">
                {comboGroups.map(([category, mods]) => (
                  <div key={category}>
                    <p className="mb-2 text-label uppercase text-muted-foreground">{category}</p>
                    <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                      {mods.map((m) => {
                        const label = modifierLabel(m);
                        const lines = modRecipeMap.get(m.id) ?? [];
                        const adjust = Number(m.priceAdjust) || 0;
                        const size = isSizeModifier(m);
                        return (
                          <li key={m.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
                            <span
                              className={cn(
                                'flex size-9 shrink-0 items-center justify-center rounded-md',
                                size ? 'bg-primary/8 text-primary' : 'bg-reference/8 text-reference',
                              )}
                              aria-hidden="true"
                            >
                              {size ? <Scale size={16} /> : <SlidersHorizontal size={16} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">{label}</span>
                                {m.isDefault && (
                                  <span className="shrink-0 rounded-sm bg-primary/8 px-1.5 py-0.5 text-micro font-semibold text-primary">
                                    Default
                                  </span>
                                )}
                              </span>
                              {lines.length === 0 ? (
                                <span className="block truncate text-xs text-muted-foreground">
                                  No recipe yet — takes no stock off when chosen
                                </span>
                              ) : (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {soldColumns.map((c) => {
                                    const t = computeRecipeTotals(lines, c.id === DEFAULT_COL ? new Set() : new Set([c.id]), itemMap);
                                    return (
                                      <span
                                        key={c.id}
                                        className="rounded-sm bg-band/70 px-1.5 py-0.5 text-micro tabular-nums text-muted-foreground"
                                      >
                                        {soldColumns.length > 1 && <span className="font-semibold text-foreground/80">{c.label} </span>}
                                        <span className="font-semibold text-foreground">{money(t.cost)}</span> ·{' '}
                                        {Math.round(t.nutrition.kcal ?? 0)} kcal
                                        {(t.missingCost > 0 || t.missingNutrition > 0) && <span className="text-measured">*</span>}
                                      </span>
                                    );
                                  })}
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                'w-20 shrink-0 text-right text-sm tabular-nums',
                                adjust ? 'font-semibold text-foreground' : 'text-xs text-muted-foreground',
                              )}
                            >
                              {adjust ? `${adjust > 0 ? '+' : '−'}${money(Math.abs(adjust))}` : 'No charge'}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground"
                              onClick={() => setEditTarget(m)}
                              aria-label={`${lines.length ? 'Edit' : 'Add'} ${label} recipe`}
                            >
                              {lines.length ? <Pencil size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </SettingsTabBody>
      )}

      {editTarget && (
        <ModifierRecipeDrawer
          modifier={{
            id: editTarget.id,
            label: modifierLabel(editTarget),
            group: modifierCategory(editTarget),
            isSize: isSizeModifier(editTarget),
            priceAdjust: editTarget.priceAdjust,
            isDefault: editTarget.isDefault,
          }}
          sizes={sizes.filter((size) => size.id !== editTarget.id)}
          defaultIsSize={Boolean(defaultSize)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

/**
 * What the combination comes to: the price large, two figures a manager
 * checks (margin, energy), and the price split into what goes on
 * ingredients, what goes to VAT and what the café keeps.
 */
function ComboResult({
  name,
  costing,
  kcal,
  nutrition,
  allergens,
  incomplete,
  money,
}: {
  name: string;
  costing: ReturnType<typeof computeCosting>;
  kcal: number;
  nutrition: NutritionFacts;
  allergens: string[];
  incomplete: boolean;
  money: (n: number) => string;
}) {
  const gross = costing.grossCharged || 0;
  const share = (n: number) => (gross > 0 ? Math.max(0, Math.min(100, (n / gross) * 100)) : 0);
  const keep = Math.max(0, costing.margin);
  const good = costing.margin >= 0;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-rule/60 bg-card">
      <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="shrink-0 text-xl font-semibold tabular-nums text-foreground">{money(gross)}</p>
      </div>

      {/* Cost isn't a figure here: the split bar's legend below already says it. */}
      <dl className="grid grid-cols-2 gap-2 px-3.5 pt-3">
        <MiniFigure label="Margin" value={`${costing.marginPct.toFixed(0)}%`} detail={money(costing.margin)} tone={good ? 'good' : 'bad'} />
        <MiniFigure label="Energy" value={`${Math.round(kcal)}`} detail="kcal" incomplete={incomplete} />
      </dl>

      {/* Where the money goes: ingredients, VAT, and what's left. */}
      <div className="px-3.5 pt-3">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-band"
          role="img"
          aria-label={`Of ${money(gross)}: ${money(costing.cogs)} ingredients, ${money(costing.vat)} VAT, ${money(keep)} kept`}
        >
          <span className="h-full bg-exception/70" style={{ width: `${share(costing.cogs)}%` }} />
          {costing.vat > 0 && <span className="h-full bg-muted-foreground/35" style={{ width: `${share(costing.vat)}%` }} />}
          <span className="h-full bg-momentum" style={{ width: `${share(keep)}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-micro text-muted-foreground">
          <Legend swatch="bg-exception/70" label={`Ingredients ${money(costing.cogs)}${incomplete ? '*' : ''}`} />
          {costing.vat > 0 && <Legend swatch="bg-muted-foreground/35" label={`VAT ${money(costing.vat)}`} />}
          {/* What's kept is the Margin figure above — the swatch only names the segment. */}
          <Legend swatch="bg-momentum" label="You keep" />
        </div>
      </div>

      <div className="px-3.5 pt-3 pb-3.5">
        <MacroList nutrition={nutrition} missing={incomplete} />
        {allergens.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Contains</span>
            {allergens.map((a) => (
              <AllergenChip key={a} allergen={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniFigure({
  label,
  value,
  detail,
  tone,
  incomplete,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'good' | 'bad';
  incomplete?: boolean;
}) {
  return (
    <div className="rounded-md bg-band/50 px-2.5 py-2">
      <dt className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-base font-semibold tabular-nums',
          tone === 'good' ? 'text-momentum' : tone === 'bad' ? 'text-exception' : 'text-foreground',
        )}
      >
        {value}
        {incomplete && <span className="text-measured">*</span>}
        {detail && <span className="ml-1 text-xs font-normal text-muted-foreground">{detail}</span>}
      </dd>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1 tabular-nums">
      <span className={cn('size-2 rounded-full', swatch)} aria-hidden="true" />
      {label}
    </span>
  );
}
