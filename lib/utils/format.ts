// Central formatting helpers. Locale/currency live here so a future locale
// switch touches one file instead of every component.

/** Pounds and pence, e.g. "£4.20". */
export const fmtGbpExact = (n: number) => `£${n.toFixed(2)}`;

/** "1 table", "3 tables" — `many` defaults to `one` plus "s". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
