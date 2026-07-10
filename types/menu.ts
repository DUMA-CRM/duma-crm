export type MenuCategory = 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: MenuCategory;
  // Brand-wide price (decimal string, e.g. "3.20"). There is no per-location pricing.
  price: string;
  isAvailable: boolean;
  imageUrl?: string;
  createdAt: string;
}

export interface MenuItemPayload {
  tenantId: string;
  name: string;
  category: MenuCategory;
  price: string;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string;
}

// Reusable modifier (e.g. "Oat Milk" +0.50, "Large" +0.60). Flat — no groups.
// Attach to menu items via /menu-item-modifiers.
export interface Modifier {
  id: string;
  tenantId: string;
  name: string;
  priceAdjust?: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface ModifierPayload {
  tenantId: string;
  name: string;
  priceAdjust?: string;
  isAvailable?: boolean;
}
