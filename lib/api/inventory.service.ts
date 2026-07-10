import { apiFetch } from './client';

// ── Stock Items ───────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  tenantId: string;
  name: string;
  unit: string;
  createdAt: string;
}

export interface StockItemPayload {
  tenantId: string;
  name: string;
  unit: string;
}

export const getStockItems = () => apiFetch<StockItem[]>('/stock-items');

export const createStockItem = (data: StockItemPayload) =>
  apiFetch<StockItem>('/stock-items', { method: 'POST', body: JSON.stringify(data) });

export const updateStockItem = (id: string, data: Partial<Pick<StockItemPayload, 'name' | 'unit'>>) =>
  apiFetch<StockItem>(`/stock-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteStockItem = (id: string) => apiFetch<void>(`/stock-items/${id}`, { method: 'DELETE' });

export interface StockMovement {
  id: string;
  stockItemId: string;
  locationId?: string;
  type: string;
  delta: number;
  previousQuantity: string;
  newQuantity: string;
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
  isAvailable: boolean;
  stockItem?: StockItem;
}

export interface LocationStockPayload {
  locationId: string;
  stockItemId: string;
  quantity?: string;
  lowThreshold: string;
  isAvailable?: boolean;
}

export const getLocationStock = (locationId: string) => apiFetch<LocationStock[]>(`/location-stock/location/${locationId}`);

export const addLocationStock = (data: LocationStockPayload) =>
  apiFetch<LocationStock>('/location-stock', { method: 'POST', body: JSON.stringify(data) });

export const updateLocationStock = (id: string, data: { quantity?: string; lowThreshold?: string; isAvailable?: boolean }) =>
  apiFetch<LocationStock>(`/location-stock/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const removeLocationStock = (id: string) => apiFetch<void>(`/location-stock/${id}`, { method: 'DELETE' });

export const adjustLocationStock = (id: string, delta: number) =>
  apiFetch<{ previousQuantity: string; delta: number; newQuantity: string }>(`/location-stock/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });

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
  const qs = locationId ? `?locationId=${locationId}` : '';
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
