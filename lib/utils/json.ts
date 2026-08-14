/**
 * Defensive JSON parsing for values the API hands over as strings.
 *
 * Kept dependency-free so both the API service layer and the pure display
 * modules that unit-test against it can share one implementation rather than
 * growing a second, subtly different one.
 */
export function parseJsonObject(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
