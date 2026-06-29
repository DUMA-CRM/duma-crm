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

export const receiveLocationStock = (id: string, quantity: number) =>
  apiFetch<{ locationStock: LocationStock; warehouseQuantity: string }>(`/location-stock/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });

// ── Tenant Stock ─────────────────────────────────────────────────────────────

export interface TenantStock {
  id: string;
  tenantId: string;
  stockItemId: string;
  quantity: string;
  lowThreshold: string;
  stockItem?: StockItem;
}

export interface TenantStockDetail extends TenantStock {
  locations?: LocationStock[];
}

export const getTenantStock = () => apiFetch<TenantStock[]>('/tenant-stock');

export const getTenantStockItem = (stockItemId: string) => apiFetch<TenantStockDetail>(`/tenant-stock/${stockItemId}`);

export const addTenantStock = (data: { stockItemId: string; quantity: string; lowThreshold?: string }) =>
  apiFetch<TenantStock>('/tenant-stock', { method: 'POST', body: JSON.stringify(data) });

export const updateTenantStock = (id: string, data: { quantity?: string; lowThreshold?: string }) =>
  apiFetch<TenantStock>(`/tenant-stock/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const removeTenantStock = (id: string) => apiFetch<void>(`/tenant-stock/${id}`, { method: 'DELETE' });

export const adjustTenantStock = (id: string, delta: number) =>
  apiFetch<{ previousQuantity: string; delta: number; newQuantity: string }>(`/tenant-stock/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });

// ── Location Transfer ─────────────────────────────────────────────────────────

export const transferLocationStock = (locationStockId: string, toLocationId: string, quantity: number) =>
  apiFetch<{ from: LocationStock; to: LocationStock; quantity: number }>(`/location-stock/${locationStockId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ toLocationId, quantity }),
  });

// ── Menu Item Stock Links ─────────────────────────────────────────────────────

export interface MenuItemStockLink {
  id: string;
  menuItemId: string;
  stockItemId: string;
  quantity: string;
  stockItem?: StockItem;
}

export const getMenuItemStock = (menuItemId: string) => apiFetch<MenuItemStockLink[]>(`/menu-item-stock/${menuItemId}`);

export const linkMenuItemStock = (data: { menuItemId: string; stockItemId: string; quantity: string }) =>
  apiFetch<MenuItemStockLink>('/menu-item-stock', { method: 'POST', body: JSON.stringify(data) });

export const updateMenuItemStock = (id: string, quantity: string) =>
  apiFetch<MenuItemStockLink>(`/menu-item-stock/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });

export const removeMenuItemStock = (id: string) => apiFetch<void>(`/menu-item-stock/${id}`, { method: 'DELETE' });

// ── Modifier Stock Links ──────────────────────────────────────────────────────

export interface ModifierStockLink {
  id: string;
  modifierId: string;
  stockItemId: string;
  quantity: string;
  stockItem?: StockItem;
}

export const getModifierStock = (modifierId: string) => apiFetch<ModifierStockLink[]>(`/modifier-stock/${modifierId}`);

export const linkModifierStock = (data: { modifierId: string; stockItemId: string; quantity: string }) =>
  apiFetch<ModifierStockLink>('/modifier-stock', { method: 'POST', body: JSON.stringify(data) });

export const updateModifierStock = (id: string, quantity: string) =>
  apiFetch<ModifierStockLink>(`/modifier-stock/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });

export const removeModifierStock = (id: string) => apiFetch<void>(`/modifier-stock/${id}`, { method: 'DELETE' });

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

// ── Transfers ─────────────────────────────────────────────────────────────────

export interface TransferRecord {
  id: string;
  stockItemId: string;
  locationId: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  orderId: string | null;
  userId: string;
  notes: string | null;
  relatedLocationId: string | null;
  createdAt: string;
  stockItem?: { id: string; name: string; unit: string };
  location?: { id: string; name: string };
  relatedLocation?: { id: string; name: string } | null;
}

export const getTransfers = (params?: {
  tenantId?: string;
  locationId?: string;
  stockItemId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.tenantId) query.set('tenantId', params.tenantId);
  if (params?.locationId) query.set('locationId', params.locationId);
  if (params?.stockItemId) query.set('stockItemId', params.stockItemId);
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<TransferRecord[]>(`/transfers${qs ? `?${qs}` : ''}`);
};

export const getInventoryForecast = (locationId?: string, lookbackDays = 30) => {
  const params = new URLSearchParams({ lookbackDays: String(lookbackDays) });
  if (locationId) params.set('locationId', locationId);
  return apiFetch<InventoryForecast[]>(`/analytics/inventory-forecast?${params}`);
};
