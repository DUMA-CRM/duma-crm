// Shared helpers for purchasing components.

/** Decimal-string quantity without trailing zeros, e.g. "12.5" / "3". */
export const fmtQty = (raw: string) => String(Number.parseFloat(raw || '0'));
