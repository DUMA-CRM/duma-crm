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
  /** On hand per location; null when the variant does not track stock. */
  stock?: Array<{ locationId: string; quantity: number }> | null;
}

/** A product photo: from Media (`assetId`) or hosted elsewhere; tied to one option value or shown for all. */
export interface CatalogImage {
  id: string;
  assetId: string | null;
  optionValueId: string | null;
  url: string | null;
  altText: string | null;
  focalPoint: { x: number; y: number } | null;
  sortOrder: number;
  /** The Media file through the API's own delivery route — what the CRM shows, via the proxy. */
  apiUrl: string | null;
  /** The Media file behind it; null for an image linked from elsewhere. */
  file: { title: string | null; fileName: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null } | null;
}

/** A product's name and description in one language other than the default. */
export interface CatalogItemTranslation {
  id: string;
  menuItemId: string;
  locale: string;
  name: string | null;
  description: string | null;
}

/** An option's name ("Size" → "Розмір") or one value's label, in one language. */
export interface CatalogOptionTranslation {
  id: string;
  optionId: string | null;
  optionValueId: string | null;
  locale: string;
  label: string;
}

/** A price in a currency other than the workspace's: the product's (`variantId` null) or one size's. */
export interface CatalogPrice {
  id: string;
  menuItemId: string;
  variantId: string | null;
  currency: string;
  price: string;
  compareAtPrice: string | null;
}

export interface ItemCatalog {
  item: MenuItem;
  options: CatalogOption[];
  variants: CatalogVariant[];
  images: CatalogImage[];
  translations: { item: CatalogItemTranslation[]; options: CatalogOptionTranslation[] };
  prices: CatalogPrice[];
}

/** One language's text for a product; a blank string removes that piece. */
export interface CatalogTranslationPayload {
  name?: string;
  description?: string;
  /** Option id → its name in this language. */
  options?: Record<string, string>;
  /** Option value id → its label in this language. */
  values?: Record<string, string>;
}

/** Prices in one currency; `null` removes one, a size without its own uses the product's. */
export interface CatalogPricesPayload {
  price?: string | null;
  compareAtPrice?: string | null;
  variants?: Record<string, { price: string | null; compareAtPrice?: string | null }>;
}

export interface CatalogImportReport {
  dryRun: boolean;
  products: Array<{
    name: string;
    action: 'create' | 'update';
    variantsCreated: number;
    variantsUpdated: number;
    stockSet: number;
    problems: string[];
  }>;
  totals: {
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    stockSet: number;
    problems: number;
  };
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
