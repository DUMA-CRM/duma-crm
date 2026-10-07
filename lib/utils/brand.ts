/**
 * The brand colours a user can pick. Each id has a matching `[data-brand]`
 * block in app/globals.css, which holds the actual values — this list is only
 * what the picker offers. Add an entry here and a block there together.
 *
 * Per device for now (uiSettingsStore). It will move to the workspace once the
 * API stores it, at which point it becomes a tenant setting, not a preference.
 */
export const BRANDS = [
  { id: 'forest', label: 'Forest', detail: 'The DUMA green.' },
  { id: 'ocean', label: 'Ocean', detail: 'Deep harbour blue.' },
  { id: 'plum', label: 'Plum', detail: 'Rich and warm.' },
  { id: 'espresso', label: 'Espresso', detail: 'Roasted coffee brown.' },
  { id: 'graphite', label: 'Graphite', detail: 'Quiet, cool slate.' },
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

/**
 * Applies the stored brand to <html> before first paint, so a plum workspace
 * does not flash green on every load. It reads zustand's persisted JSON
 * directly because the store has not hydrated yet. Self-contained on purpose:
 * it is stringified into an inline script and cannot import anything.
 */
export function applyStoredBrand(storageKey: string, brands: readonly string[], fallback: string) {
  let brand = fallback;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null')?.state?.brand;
    if (brands.includes(stored)) brand = stored;
  } catch {
    // Storage blocked or corrupt — the default brand is the correct answer.
  }
  document.documentElement.dataset.brand = brand;
}

export const brandPrePaintScript = `(${applyStoredBrand.toString()})(${JSON.stringify(UI_SETTINGS_STORAGE_KEY)},${JSON.stringify(
  BRANDS.map((brand) => brand.id),
)},${JSON.stringify(DEFAULT_BRAND)})`;
