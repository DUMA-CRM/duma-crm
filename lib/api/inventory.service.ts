import { apiFetch } from './client';

// ── Stock Items ───────────────────────────────────────────────────────────────

/** UK FSA's 14 regulated allergens, stored as lowercase slugs. */
export const FSA_ALLERGENS = [
  'celery',
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
] as const;
export type Allergen = (typeof FSA_ALLERGENS)[number];

/** What nutrition facts are declared per. kg/l stock quantities convert to g/ml. */
export type NutritionBasis = 'per_100g' | 'per_100ml' | 'per_piece';
export type InventoryCategory = 'FOOD' | 'BEVERAGE' | 'SUPPLY' | 'MERCH';

/** UK food-label rows. kcal in kcal; everything else grams, per the item's nutritionBasis amount. All optional. */
export interface NutritionFacts {
  kcal?: number;
  fat?: number;
  saturates?: number;
  carbs?: number;
  sugars?: number;
  fibre?: number;
  protein?: number;
  salt?: number;
}

export const NUTRITION_FIELDS: { key: keyof NutritionFacts; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Energy', unit: 'kcal' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'saturates', label: 'Saturates', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'sugars', label: 'Sugars', unit: 'g' },
  { key: 'fibre', label: 'Fibre', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'salt', label: 'Salt', unit: 'g' },
];

export interface StockItem {
  id: string;
  tenantId: string;
  name: string;
  unit: string;
  category: InventoryCategory;
  isPerishable: boolean;
  defaultShelfLifeDays?: number | null;
  defaultContainerQuantity?: string | null;
  defaultReorderLevel?: string | null;
  defaultReorderQuantity?: string | null;
  isActive: boolean;
  /** Last known cost per unit (GBP, decimal string) — set by goods receipts. Null until first known. */
  costPerUnit?: string | null;
  /** What the nutrition facts are declared per. Null = no nutrition set. */
  nutritionBasis?: NutritionBasis | null;
  /** Nutrition facts per the basis amount. Null = unknown. */
  nutrition?: NutritionFacts | null;
  /** FSA allergen slugs this ingredient contains. */
  allergens?: string[] | null;
  createdAt: string;
}

export interface StockItemPayload {
  tenantId: string;
  name: string;
  unit: string;
  category?: InventoryCategory;
  isPerishable?: boolean;
  defaultShelfLifeDays?: number | null;
  defaultContainerQuantity?: number | null;
  defaultReorderLevel?: number | null;
  defaultReorderQuantity?: number | null;
  isActive?: boolean;
  nutritionBasis?: NutritionBasis | null;
  nutrition?: NutritionFacts | null;
  allergens?: Allergen[] | null;
}

export const getStockItems = () => apiFetch<StockItem[]>('/stock-items');
export const getStockItem = (id: string) => apiFetch<StockItem>(`/stock-items/${id}`);

export const createStockItem = (data: StockItemPayload) =>
  apiFetch<StockItem>('/stock-items', { method: 'POST', body: JSON.stringify(data) });

export const updateStockItem = (id: string, data: Partial<Omit<StockItemPayload, 'tenantId'>>) =>
  apiFetch<StockItem>(`/stock-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteStockItem = (id: string) => apiFetch<void>(`/stock-items/${id}`, { method: 'DELETE' });

export interface StockMovement {
  id: string;
  stockItemId: string;
  locationId?: string;
  stockUnitId?: string | null;
  stockUnit?: { id: string; label: string } | null;
  type: string;
  /** Signed change for this movement (negative for outgoing), matching the loss log's `quantity`. */
  quantity: number;
  quantityBefore?: number;
  quantityAfter?: number;
  stockUnitQuantityBefore?: number | null;
  stockUnitQuantityAfter?: number | null;
  unitOfMeasure?: string | null;
  reason?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  orderId?: string | null;
  notes?: string;
  createdAt: string;
}

export interface StockMovementsResponse {
  data: StockMovement[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const getStockItemMovements = (id: string, params?: { page?: number; limit?: number }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<StockMovementsResponse>(`/stock-items/${id}/movements${qs ? `?${qs}` : ''}`);
};

// ── Location Stock ────────────────────────────────────────────────────────────

export interface LocationStock {
  id: string;
  locationId: string;
  stockItemId: string;
  quantity: string;
  lowThreshold: string;
  reorderQuantity?: string | null;
  isAvailable: boolean;
  stockItem?: StockItem;
}

export interface LocationStockPayload {
  locationId: string;
  stockItemId: string;
  lowThreshold: string;
  reorderQuantity?: string;
  isAvailable?: boolean;
}

export const getLocationStock = (locationId: string) => apiFetch<LocationStock[]>(`/location-stock/location/${locationId}`);

export const addLocationStock = (data: LocationStockPayload) =>
  apiFetch<LocationStock>('/location-stock', { method: 'POST', body: JSON.stringify(data) });

export const updateLocationStock = (id: string, data: { lowThreshold?: string; reorderQuantity?: string | null; isAvailable?: boolean }) =>
  apiFetch<LocationStock>(`/location-stock/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const removeLocationStock = (id: string) => apiFetch<void>(`/location-stock/${id}`, { method: 'DELETE' });

// ── Low Stock Alerts ──────────────────────────────────────────────────────────

export interface LowStockAlert {
  id: string;
  locationId: string;
  stockItemId: string;
  quantity: string;
  lowThreshold: string;
  isAvailable: boolean;
  stockItem?: StockItem;
  location?: { id: string; name: string };
}

export const getLowStockAlerts = (locationId?: string) => {
  const qs = locationId ? `?${new URLSearchParams({ locationId })}` : '';
  return apiFetch<LowStockAlert[]>(`/location-stock/alerts${qs}`);
};

// ── Inventory Forecast ────────────────────────────────────────────────────────

export interface InventoryForecast {
  locationStockId: string;
  locationId?: string;
  locationName?: string;
  location?: { id: string; name: string };
  stockItemName: string;
  unit: string;
  currentQuantity: string;
  avgDailyConsumption: number;
  daysOfStockRemaining: number;
  predictedStockoutDate: string | null;
  recommendedReorderQuantity: number;
  isLow: boolean;
  isCritical: boolean;
}

export const getInventoryForecast = (locationId?: string, lookbackDays = 30) => {
  const params = new URLSearchParams({ lookbackDays: String(lookbackDays) });
  if (locationId) params.set('locationId', locationId);
  return apiFetch<InventoryForecast[]>(`/analytics/inventory-forecast?${params}`);
};

// ── Physical stock units and canonical ledger ────────────────────────────────

export type StockUnitStatus = 'AVAILABLE' | 'IN_USE' | 'EMPTY' | 'EXPIRED' | 'DISCARDED';

export interface InventoryOverviewRow {
  locationStockId: string;
  locationId: string;
  stockItemId: string;
  name: string;
  unit: string;
  category: InventoryCategory;
  isPerishable: boolean;
  totalOnHand: string;
  activeUnitCount: number;
  earliestExpiryDate: string | null;
  reorderLevel: string;
  reorderQuantity: string | null;
  needsReorder: boolean;
}

export interface StockUnit {
  id: string;
  stockItemId: string;
  locationId: string;
  label: string;
  barcode?: string | null;
  lotNumber?: string | null;
  notes?: string | null;
  initialQuantity: string;
  remainingQuantity: string;
  unitOfMeasure: string;
  status: StockUnitStatus;
  expiryDate?: string | null;
  expirySource: 'SUPPLIER' | 'MANUAL' | 'DEFAULT_SHELF_LIFE' | 'NOT_APPLICABLE';
  openedAt?: string | null;
  discardedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  stockItem?: StockItem;
  location?: { id: string; name: string };
  createdByUser?: { id: string; name: string } | null;
}

export const getInventoryOverview = (locationId: string) =>
  apiFetch<InventoryOverviewRow[]>(`/inventory/overview?${new URLSearchParams({ locationId })}`);

export const getStockUnits = (params: { locationId?: string; stockItemId?: string; status?: StockUnitStatus; expiringWithinDays?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.locationId) query.set('locationId', params.locationId);
  if (params.stockItemId) query.set('stockItemId', params.stockItemId);
  if (params.status) query.set('status', params.status);
  if (params.expiringWithinDays !== undefined) query.set('expiringWithinDays', String(params.expiringWithinDays));
  const qs = query.toString();
  return apiFetch<StockUnit[]>(`/stock-units${qs ? `?${qs}` : ''}`);
};

export const getStockUnit = (id: string) => apiFetch<StockUnit>(`/stock-units/${id}`);
export const getStockUnitLedger = (id: string) => apiFetch<StockMovement[]>(`/stock-units/${id}/ledger`);

export const receiveStockUnits = (data: {
  locationId: string;
  stockItemId: string;
  units: Array<{ initialQuantity: number; expiryDate?: string | null; lotNumber?: string; label?: string; barcode?: string }>;
  notes?: string;
}) => apiFetch<StockUnit[]>('/stock-units', { method: 'POST', body: JSON.stringify(data) });

export const adjustStockUnit = (id: string, data: { quantity: number; reason?: string; notes?: string }) =>
  apiFetch<StockUnit>(`/stock-units/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) });

export const wasteStockUnit = (id: string, data: { quantity: number; reason: 'EXPIRED' | 'SPILL' | 'DAMAGED' | 'QUALITY' | 'OTHER'; notes?: string }) =>
  apiFetch<StockUnit>(`/stock-units/${id}/waste`, { method: 'POST', body: JSON.stringify(data) });

export const discardStockUnit = (id: string, data: { reason: 'EXPIRED' | 'SPILL' | 'DAMAGED' | 'QUALITY' | 'OTHER'; notes?: string }) =>
  apiFetch<StockUnit>(`/stock-units/${id}/discard`, { method: 'POST', body: JSON.stringify(data) });
