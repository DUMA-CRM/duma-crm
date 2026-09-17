export type MenuCategory = string;

export interface MenuCategoryRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  colour?: 'warning' | 'info' | 'primary' | 'success' | 'muted' | 'destructive' | null;
  isActive: boolean;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  categoryId: string;
  // Brand-wide price (decimal string, e.g. "3.20"). There is no per-location pricing.
  price: string;
  // Per-item VAT rate as a percentage string ("20", "0"). Absent = use the
  // tenant's defaultVatRate. Matters because hot food and cold takeaway food
  // are rated differently, and margin is wrong without it.
  vatRate?: string | null;
  isAvailable: boolean;
  imageUrl?: string;
  createdAt: string;
}

export interface MenuItemPayload {
  tenantId: string;
  name: string;
  categoryId: string;
  price: string;
  /** Percentage string, or null to clear the override and use the tenant default. */
  vatRate?: string | null;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string;
}

// Reusable modifier (e.g. "Oat Milk" +0.50, "Large" +0.60). Flat — no groups.
// Attach to menu items via /menu-item-modifiers.
export interface Modifier {
  id: string;
  tenantId: string;
  /** Plain display name; identical to `label`. */
  name: string;
  label: string;
  category: string | null;
  groupId?: string | null;
  isSize: boolean;
  sortOrder?: number;
  priceAdjust?: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface ModifierPayload {
  tenantId: string;
  label: string;
  category?: string | null;
  groupId?: string | null;
  isSize?: boolean;
  priceAdjust?: string;
  isAvailable?: boolean;
}

// A modifier as returned for a specific menu item: the reusable modifier record
// plus the per-item link flag marking it as the pre-selected default variant.
export interface AttachedModifier extends Modifier {
  isDefault: boolean;
}

export interface ModifierGroup {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isSize: boolean;
  sortOrder: number;
  modifierCount: number;
}

export interface MenuItemModifierGroup extends ModifierGroup {
  minSelections: number;
  maxSelections: number | null;
  itemSortOrder: number;
  modifiers: Array<{
    modifierId: string;
    groupId: string | null;
    label: string;
    name: string;
    priceAdjust: string;
    isAvailable: boolean;
    isDefault: boolean;
  }>;
}
