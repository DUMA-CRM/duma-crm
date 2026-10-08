/**
 * The currencies a workspace can trade in, and how a price looks in each.
 * Prices are stored as decimal strings; only the display changes. The list is
 * the choice in Settings → Trading & tax; the API takes any ISO 4217 code.
 */
export const CURRENCIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'GBP', name: 'Pound sterling' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US dollar' },
  { code: 'UAH', name: 'Ukrainian hryvnia' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'HUF', name: 'Hungarian forint' },
  { code: 'RON', name: 'Romanian leu' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'JPY', name: 'Japanese yen' },
];

/** "₴" for UAH, "£" for GBP, "zł" for PLN — the local sign people read; the code when there is none. */
export function currencySymbol(code: string, locale = 'en-GB'): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((entry) => entry.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** "UAH — Ukrainian hryvnia (₴)", for a picker. */
export const currencyLabel = (code: string) => {
  const known = CURRENCIES.find((entry) => entry.code === code);
  const symbol = currencySymbol(code);
  return `${code} — ${known?.name ?? code}${symbol !== code ? ` (${symbol})` : ''}`;
};

/** A price in a currency, to `digits` places (whole units for lists, two for a price). */
export function formatCurrency(value: number | string | null | undefined, code: string, digits = 2, locale = 'en-GB'): string {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${amount.toFixed(digits)} ${code}`;
  }
}
