import { apiFetch } from './client';

// Recipes / bill-of-materials. The effective recipe of a sold item composes:
// the menu item's BASE recipe (ingredients common to every variant) + each
// selected MODIFIER's recipe (Oat Milk → 200ml oat). Any line may carry
// per-size overrides (sizeModifierId) that replace the default quantity when
// that size modifier (e.g. "Size: Large") is selected.

import type { NutritionBasis, NutritionFacts } from './inventory.service';

export interface RecipeStockItem {
  id: string;
  name: string;
  unit: string;
  costPerUnit?: string | null;
  /** What the nutrition facts are declared per. */
  nutritionBasis?: NutritionBasis | null;
  /** Nutrition facts per the basis amount. Null = unknown. */
  nutrition?: NutritionFacts | null;
  /** FSA allergen slugs. */
  allergens?: string[] | null;
}

export interface RecipeLine {
  id: string;
  stockItemId: string;
  /** Null = default quantity; set = override when this size modifier is selected. */
  sizeModifierId?: string | null;
  quantity: string;
  stockItem?: RecipeStockItem;
  sizeModifier?: { id: string; name: string } | null;
}

export interface RecipeLineInput {
  stockItemId: string;
  sizeModifierId?: string | null;
  quantity: number;
}

// ── Menu item (base) recipes ──────────────────────────────────────────────────

export const getMenuItemRecipe = (menuItemId: string) => apiFetch<RecipeLine[]>(`/menu-item-recipes/menu-item/${menuItemId}`);

export const setMenuItemRecipe = (menuItemId: string, lines: RecipeLineInput[]) =>
  apiFetch<RecipeLine[]>(`/menu-item-recipes/menu-item/${menuItemId}`, { method: 'PUT', body: JSON.stringify({ lines }) });

// ── Modifier recipes ──────────────────────────────────────────────────────────

export const getModifierRecipe = (modifierId: string) => apiFetch<RecipeLine[]>(`/modifier-recipes/modifier/${modifierId}`);

export const setModifierRecipe = (modifierId: string, lines: RecipeLineInput[]) =>
  apiFetch<RecipeLine[]>(`/modifier-recipes/modifier/${modifierId}`, { method: 'PUT', body: JSON.stringify({ lines }) });
