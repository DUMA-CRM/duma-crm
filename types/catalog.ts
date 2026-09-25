import type { MenuItem } from '@/types/menu';

export interface CatalogOptionValue {
  id: string;
  tenantId: string;
  optionId: string;
  label: string;
  sortOrder: number;
}

export interface CatalogOption {
  id: string;
  tenantId: string;
  menuItemId: string;
  name: string;
  sortOrder: number;
  values: CatalogOptionValue[];
}

export interface CatalogVariantLocation {
  id: string;
  variantId: string;
  locationId: string;
  price: string | null;
  compareAtPrice: string | null;
  isAvailable: boolean;
}

export interface CatalogVariant {
  id: string;
  tenantId: string;
  menuItemId: string;
  stockItemId: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  price: string | null;
  compareAtPrice: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  values: Array<{ variantId: string; optionValueId: string; optionValue: CatalogOptionValue }>;
  locations: CatalogVariantLocation[];
  stockItem?: { id: string; name: string; unit: string; isPerishable: boolean } | null;
}

export interface ItemCatalog {
  item: MenuItem;
  options: CatalogOption[];
  variants: CatalogVariant[];
}

export interface CatalogDiscount {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  kind: 'percentage' | 'fixed';
  value: string;
  locationId: string | null;
  menuItemId: string | null;
  variantId: string | null;
  isAutomatic: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface CatalogVariantPayload {
  menuItemId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  stockItemId?: string | null;
  price?: string | null;
  compareAtPrice?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  optionValueIds: string[];
}

export interface CatalogDiscountPayload {
  name: string;
  code?: string | null;
  kind: 'percentage' | 'fixed';
  value: string;
  locationId?: string | null;
  menuItemId?: string | null;
  variantId?: string | null;
  isAutomatic?: boolean;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}
