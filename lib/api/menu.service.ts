import {
  AttachedModifier,
  MenuCategoryRecord,
  MenuItem,
  MenuItemModifierGroup,
  MenuItemPayload,
  Modifier,
  ModifierGroup,
  ModifierPayload,
} from '@/types/menu';
import type {
  CatalogDiscount,
  CatalogDiscountPayload,
  CatalogOption,
  CatalogOptionValue,
  CatalogVariant,
  CatalogVariantLocation,
  CatalogVariantPayload,
  ItemCatalog,
} from '@/types/catalog';

import { apiFetch } from './client';

// ── Menu Items ────────────────────────────────────────────────────────────────
// A menu item has one brand-wide `price`. There is no per-location pricing.

export const getMenuItems = async (tenantId?: string) => {
  const rows = await apiFetch<MenuItem[]>('/menu-items');
  // The current API returns every tenant for super admins and the caller's
  // tenant for everyone else. Filter explicitly so the workspace selector has
  // the same meaning for both cases.
  return tenantId ? rows.filter((item) => item.tenantId === tenantId) : rows;
};

export const createMenuItem = (data: MenuItemPayload) => apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(data) });

export const updateMenuItem = (id: string, data: Partial<Omit<MenuItemPayload, 'tenantId'>>) =>
  apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMenuItem = (id: string) => apiFetch<void>(`/menu-items/${id}`, { method: 'DELETE' });

export const getMenuCategories = (tenantId?: string) =>
  apiFetch<MenuCategoryRecord[]>(`/menu-categories${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`);
export const createMenuCategory = (data: { tenantId?: string; name: string; description?: string; imageUrl?: string; colour?: MenuCategoryRecord['colour'] }) =>
  apiFetch<MenuCategoryRecord>('/menu-categories', { method: 'POST', body: JSON.stringify(data) });
export const updateMenuCategory = (id: string, data: Partial<Pick<MenuCategoryRecord, 'name' | 'description' | 'imageUrl' | 'colour' | 'isActive' | 'sortOrder'>>) =>
  apiFetch<MenuCategoryRecord>(`/menu-categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const reorderMenuCategories = (ids: string[]) =>
  apiFetch<{ success: true }>('/menu-categories/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) });

// ── Modifiers ─────────────────────────────────────────────────────────────────
// Reusable, flat modifiers (name + priceAdjust). No groups, no per-location pricing.

export const getModifiers = async (tenantId?: string) => {
  const rows = await apiFetch<Modifier[]>('/modifiers');
  return tenantId ? rows.filter((modifier) => modifier.tenantId === tenantId) : rows;
};

export const createModifier = (data: ModifierPayload) => apiFetch<Modifier>('/modifiers', { method: 'POST', body: JSON.stringify(data) });

export const updateModifier = (id: string, data: Partial<Omit<ModifierPayload, 'tenantId'>>) =>
  apiFetch<Modifier>(`/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteModifier = (id: string) => apiFetch<void>(`/modifiers/${id}`, { method: 'DELETE' });

export const getModifierGroups = (tenantId?: string) =>
  apiFetch<ModifierGroup[]>(`/modifier-groups${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`);
export const createModifierGroup = (data: { tenantId?: string; name: string; isSize?: boolean }) =>
  apiFetch<ModifierGroup>('/modifier-groups', { method: 'POST', body: JSON.stringify(data) });
export const updateModifierGroup = (id: string, data: Partial<Pick<ModifierGroup, 'name' | 'isSize' | 'sortOrder'>>) =>
  apiFetch<ModifierGroup>(`/modifier-groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const getMenuItemModifierGroups = (menuItemId: string) =>
  apiFetch<MenuItemModifierGroup[]>(`/modifier-groups/menu-item/${menuItemId}`);
export const setMenuItemModifierGroupRule = (
  menuItemId: string,
  groupId: string,
  data: { minSelections: number; maxSelections: number | null; sortOrder?: number },
) => apiFetch(`/modifier-groups/menu-item/${menuItemId}/${groupId}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Menu Item ↔ Modifier links ────────────────────────────────────────────────
// Attach reusable modifiers to a menu item so they can be chosen when ordering it.

export const getMenuItemModifiers = (menuItemId: string) => apiFetch<AttachedModifier[]>(`/menu-item-modifiers/menu-item/${menuItemId}`);

export const attachModifier = (menuItemId: string, modifierId: string, isDefault = false) =>
  apiFetch<{ id: string; menuItemId: string; modifierId: string; isDefault: boolean }>('/menu-item-modifiers', {
    method: 'POST',
    body: JSON.stringify({ menuItemId, modifierId, isDefault }),
  });

// Mark (or unmark) an already-attached modifier as the item's default variant.
export const setModifierDefault = (menuItemId: string, modifierId: string, isDefault: boolean) =>
  apiFetch<{ id: string; menuItemId: string; modifierId: string; isDefault: boolean }>('/menu-item-modifiers', {
    method: 'PATCH',
    body: JSON.stringify({ menuItemId, modifierId, isDefault }),
  });

export const detachModifier = (menuItemId: string, modifierId: string) =>
  apiFetch<{ success: boolean }>('/menu-item-modifiers', {
    method: 'DELETE',
    body: JSON.stringify({ menuItemId, modifierId }),
  });

// ── Retail catalog ───────────────────────────────────────────────────────────

const catalogPath = (path: string, tenantId?: string) =>
  `${path}${tenantId ? `${path.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(tenantId)}` : ''}`;

export const getItemCatalog = (menuItemId: string, tenantId?: string) =>
  apiFetch<ItemCatalog>(catalogPath(`/catalog/items/${menuItemId}`, tenantId));

export const lookupCatalogBarcode = (barcode: string, locationId?: string, tenantId?: string) =>
  apiFetch<{ variant: CatalogVariant & { menuItem: MenuItem }; location: CatalogVariantLocation | null }>(
    catalogPath(`/catalog/variants/barcode/${encodeURIComponent(barcode)}${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`, tenantId),
  );

export const createCatalogOption = (data: { menuItemId: string; name: string; sortOrder?: number }, tenantId?: string) =>
  apiFetch<CatalogOption>(catalogPath('/catalog/options', tenantId), { method: 'POST', body: JSON.stringify(data) });

export const updateCatalogOption = (id: string, data: Partial<Pick<CatalogOption, 'name' | 'sortOrder'>>, tenantId?: string) =>
  apiFetch<CatalogOption>(catalogPath(`/catalog/options/${id}`, tenantId), { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCatalogOption = (id: string, tenantId?: string) =>
  apiFetch<{ deleted: true }>(catalogPath(`/catalog/options/${id}`, tenantId), { method: 'DELETE' });

export const createCatalogOptionValue = (optionId: string, data: { label: string; sortOrder?: number }, tenantId?: string) =>
  apiFetch<CatalogOptionValue>(catalogPath(`/catalog/options/${optionId}/values`, tenantId), { method: 'POST', body: JSON.stringify(data) });

export const updateCatalogOptionValue = (id: string, data: Partial<Pick<CatalogOptionValue, 'label' | 'sortOrder'>>, tenantId?: string) =>
  apiFetch<CatalogOptionValue>(catalogPath(`/catalog/option-values/${id}`, tenantId), { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCatalogOptionValue = (id: string, tenantId?: string) =>
  apiFetch<{ deleted: true }>(catalogPath(`/catalog/option-values/${id}`, tenantId), { method: 'DELETE' });

export const createCatalogVariant = (data: CatalogVariantPayload, tenantId?: string) =>
  apiFetch<CatalogVariant>(catalogPath('/catalog/variants', tenantId), { method: 'POST', body: JSON.stringify(data) });

export const updateCatalogVariant = (id: string, data: Partial<Omit<CatalogVariantPayload, 'menuItemId'>>, tenantId?: string) =>
  apiFetch<CatalogVariant>(catalogPath(`/catalog/variants/${id}`, tenantId), { method: 'PATCH', body: JSON.stringify(data) });

export const setCatalogVariantLocation = (
  variantId: string,
  locationId: string,
  data: { price?: string | null; compareAtPrice?: string | null; isAvailable: boolean },
  tenantId?: string,
) => apiFetch<CatalogVariantLocation>(catalogPath(`/catalog/variants/${variantId}/locations/${locationId}`, tenantId), { method: 'PUT', body: JSON.stringify(data) });

export const getCatalogDiscounts = (tenantId?: string) => apiFetch<CatalogDiscount[]>(catalogPath('/catalog/discounts', tenantId));

export const createCatalogDiscount = (data: CatalogDiscountPayload, tenantId?: string) =>
  apiFetch<CatalogDiscount>(catalogPath('/catalog/discounts', tenantId), { method: 'POST', body: JSON.stringify(data) });

export const updateCatalogDiscount = (id: string, data: Partial<CatalogDiscountPayload>, tenantId?: string) =>
  apiFetch<CatalogDiscount>(catalogPath(`/catalog/discounts/${id}`, tenantId), { method: 'PATCH', body: JSON.stringify(data) });
