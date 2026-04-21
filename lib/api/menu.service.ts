import { apiFetch } from './client';

// ── Menu Items ────────────────────────────────────────────────────────────────

export type MenuCategory = 'coffee' | 'other-hot-drinks' | 'coffee-over-ice' | 'tea' | 'snacks';

export interface MenuItem {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category: MenuCategory;
  basePrice: string;
  isAvailable: boolean;
  imageUrl?: string;
  createdAt: string;
}

export interface MenuItemPayload {
  tenantId: string;
  name: string;
  category: MenuCategory;
  basePrice: string;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string;
}

export const getMenuItems = () => apiFetch<MenuItem[]>('/menu-items');

export const createMenuItem = (data: MenuItemPayload) => apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(data) });

export const updateMenuItem = (id: string, data: Partial<Omit<MenuItemPayload, 'tenantId'>>) =>
  apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMenuItem = (id: string) => apiFetch<void>(`/menu-items/${id}`, { method: 'DELETE' });

// ── Modifier Groups ───────────────────────────────────────────────────────────

export interface ModifierGroup {
  id: string;
  tenantId: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ModifierGroupPayload {
  tenantId: string;
  name: string;
  required?: boolean;
  multiSelect?: boolean;
  sortOrder?: number;
}

export const getModifierGroups = () => apiFetch<ModifierGroup[]>('/modifier-groups');

export const createModifierGroup = (data: ModifierGroupPayload) =>
  apiFetch<ModifierGroup>('/modifier-groups', { method: 'POST', body: JSON.stringify(data) });

export const updateModifierGroup = (id: string, data: Partial<Omit<ModifierGroupPayload, 'tenantId'>>) =>
  apiFetch<ModifierGroup>(`/modifier-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteModifierGroup = (id: string) => apiFetch<void>(`/modifier-groups/${id}`, { method: 'DELETE' });

// ── Modifiers ─────────────────────────────────────────────────────────────────

export type ModifierType = 'size' | 'milk' | 'syrup' | 'extra' | 'remove';

export interface Modifier {
  id: string;
  tenantId: string;
  groupId: string;
  type: ModifierType;
  name: string;
  priceAdjust?: string;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ModifierPayload {
  tenantId: string;
  groupId: string;
  type: ModifierType;
  name: string;
  priceAdjust?: string;
  isDefault?: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
}

export const getModifiersByGroup = (groupId: string) => apiFetch<Modifier[]>(`/modifiers/group/${groupId}`);

export const createModifier = (data: ModifierPayload) => apiFetch<Modifier>('/modifiers', { method: 'POST', body: JSON.stringify(data) });

export const updateModifier = (id: string, data: Partial<Omit<ModifierPayload, 'tenantId' | 'groupId'>>) =>
  apiFetch<Modifier>(`/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteModifier = (id: string) => apiFetch<void>(`/modifiers/${id}`, { method: 'DELETE' });

// ── All modifiers (tenant-scoped) ────────────────────────────────────────────

export const getAllModifiers = () => apiFetch<Modifier[]>('/modifiers');

// ── Menu Item ↔ Modifier Group links ─────────────────────────────────────────

export interface MenuItemModifierGroupLink {
  id: string;
  menuItemId: string;
  modifierGroupId: string;
}

export const getMenuItemModifierGroups = (menuItemId: string) =>
  apiFetch<MenuItemModifierGroupLink[]>(`/menu-item-modifier-groups/menu-item/${menuItemId}`);

export const linkModifierGroup = (menuItemId: string, modifierGroupId: string) =>
  apiFetch<MenuItemModifierGroupLink>('/menu-item-modifier-groups', {
    method: 'POST',
    body: JSON.stringify({ menuItemId, modifierGroupId }),
  });

export const unlinkModifierGroup = (id: string) => apiFetch<void>(`/menu-item-modifier-groups/${id}`, { method: 'DELETE' });

// ── Location Menu Items (price overrides) ─────────────────────────────────────

export interface LocationMenuItem {
  id: string;
  locationId: string;
  menuItemId: string;
  priceOverride?: string;
  isAvailable: boolean;
}

export const getLocationMenuItems = (locationId: string) => apiFetch<LocationMenuItem[]>(`/location-menu-items/location/${locationId}`);

export const addLocationMenuItem = (locationId: string, menuItemId: string, priceOverride?: string) =>
  apiFetch<LocationMenuItem>('/location-menu-items', {
    method: 'POST',
    body: JSON.stringify({ locationId, menuItemId, ...(priceOverride ? { priceOverride } : {}) }),
  });

export const updateLocationMenuItem = (id: string, data: { priceOverride?: string; isAvailable?: boolean }) =>
  apiFetch<LocationMenuItem>(`/location-menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const removeLocationMenuItem = (id: string) => apiFetch<void>(`/location-menu-items/${id}`, { method: 'DELETE' });

// ── Location Modifiers (price overrides per location) ─────────────────────────

export interface LocationModifier {
  id: string;
  locationId: string;
  modifierId: string;
  priceOverride?: string;
  isAvailable: boolean;
}

export const getLocationModifiers = (locationId: string) => apiFetch<LocationModifier[]>(`/location-modifiers/location/${locationId}`);

export const addLocationModifier = (locationId: string, modifierId: string, priceOverride?: string) =>
  apiFetch<LocationModifier>('/location-modifiers', {
    method: 'POST',
    body: JSON.stringify({ locationId, modifierId, ...(priceOverride ? { priceOverride } : {}) }),
  });

export const updateLocationModifier = (id: string, data: { priceOverride?: string; isAvailable?: boolean }) =>
  apiFetch<LocationModifier>(`/location-modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const removeLocationModifier = (id: string) => apiFetch<void>(`/location-modifiers/${id}`, { method: 'DELETE' });
