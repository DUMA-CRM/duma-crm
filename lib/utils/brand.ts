/**
 * The brand colours a workspace can pick. Each id has a matching `[data-brand]`
 * block in app/globals.css, which holds the actual values — this list is only
 * what the picker offers. Add an entry here, a block there, and the id to the
 * API's WORKSPACE_BRANDS (duma-api src/lib/workspace-settings.ts) together.
 *
 * A workspace setting (`tenants.brand`), read with the staff profile. The copy
 * in uiSettingsStore is a per-device cache so the pre-paint script can colour
 * the first frame before the profile arrives.
 */
export const BRANDS = [
  { id: 'forest', label: 'Forest' },
  { id: 'ocean', label: 'Navy' },
] as const;

export type Brand = (typeof BRANDS)[number]['id'];

export const DEFAULT_BRAND: Brand = 'forest';

export function isBrand(value: unknown): value is Brand {
  return typeof value === 'string' && BRANDS.some((brand) => brand.id === value);
}

/** Anything unrecognised — a removed brand, a hand-edited value — falls back to the default. */
export function parseBrand(value: unknown): Brand {
  return isBrand(value) ? value : DEFAULT_BRAND;
}

/** Where uiSettingsStore persists, read raw by the pre-paint script. */
export const UI_SETTINGS_STORAGE_KEY = 'ui-settings';

/** Where this tab's workspace context persists (stores/workspaceStore.ts). */
export const WORKSPACE_TAB_STORAGE_KEY = 'duma-workspace-tab';

/**
 * Applies the stored brand to <html> before first paint, so a navy workspace
 * does not flash green on every load. It reads zustand's persisted JSON
 * directly because neither store has hydrated yet. Self-contained on purpose:
 * it is stringified into an inline script and cannot import anything.
 *
 * The colour follows this tab's context: DUMA Admin is always the default, a
 * workspace uses its cached colour (keyed as contextPartition does), and a tab
 * with no context yet uses the last colour painted on the device.
 */
export function applyStoredBrand(storageKey: string, brands: readonly string[], fallback: string, contextKey?: string) {
  let brand = fallback;
  let tab = null;
  try {
    tab = contextKey ? JSON.parse(sessionStorage.getItem(contextKey) ?? 'null')?.state : null;
  } catch {
    // No tab context readable — paint as a tab with none.
  }
  try {
    const settings = JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.state;
    const context = tab?.context;
    let stored = settings?.brand;
    if (context?.kind === 'platform') stored = fallback;
    else if (context?.kind === 'workspace')
      stored = settings?.brands?.[`${tab.accountId ?? 'anonymous'}|w:${context.tenantId}`] ?? fallback;
    if (brands.includes(stored)) brand = stored;
  } catch {
    // Storage blocked or corrupt — the default brand is the correct answer.
  }
  document.documentElement.dataset.brand = brand;
}

export const brandPrePaintScript = `(${applyStoredBrand.toString()})(${JSON.stringify(UI_SETTINGS_STORAGE_KEY)},${JSON.stringify(
  BRANDS.map((brand) => brand.id),
)},${JSON.stringify(DEFAULT_BRAND)},${JSON.stringify(WORKSPACE_TAB_STORAGE_KEY)})`;
