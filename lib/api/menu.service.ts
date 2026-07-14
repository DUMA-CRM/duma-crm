import { AttachedModifier, MenuItem, MenuItemPayload, Modifier, ModifierPayload } from '@/types/menu';

import { apiFetch } from './client';

// ── Menu Items ────────────────────────────────────────────────────────────────
// A menu item has one brand-wide `price`. There is no per-location pricing.

export const getMenuItems = () => apiFetch<MenuItem[]>('/menu-items');

export const createMenuItem = (data: MenuItemPayload) => apiFetch<MenuItem>('/menu-items', { method: 'POST', body: JSON.stringify(data) });

export const updateMenuItem = (id: string, data: Partial<Omit<MenuItemPayload, 'tenantId'>>) =>
  apiFetch<MenuItem>(`/menu-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteMenuItem = (id: string) => apiFetch<void>(`/menu-items/${id}`, { method: 'DELETE' });

// ── Modifiers ─────────────────────────────────────────────────────────────────
// Reusable, flat modifiers (name + priceAdjust). No groups, no per-location pricing.

export const getModifiers = () => apiFetch<Modifier[]>('/modifiers');

export const createModifier = (data: ModifierPayload) => apiFetch<Modifier>('/modifiers', { method: 'POST', body: JSON.stringify(data) });

export const updateModifier = (id: string, data: Partial<Omit<ModifierPayload, 'tenantId'>>) =>
  apiFetch<Modifier>(`/modifiers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteModifier = (id: string) => apiFetch<void>(`/modifiers/${id}`, { method: 'DELETE' });

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
