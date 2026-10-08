/**
 * A product in other languages and currencies — what the "Languages & prices"
 * tab counts and offers. Pure, so it is tested; the API decides what a
 * shopper is actually served (duma-api `src/lib/catalog-i18n.ts`).
 */

interface LocaleLike {
  code: string;
  isDefault: boolean;
  currency: string | null;
}

interface CatalogLike {
  item: { description?: string | null };
  options: ReadonlyArray<{ id: string; values: ReadonlyArray<{ id: string }> }>;
  variants: ReadonlyArray<{ id: string }>;
  translations: {
    item: ReadonlyArray<{ locale: string; name: string | null; description: string | null }>;
    options: ReadonlyArray<{ locale: string; optionId: string | null; optionValueId: string | null; label: string }>;
  };
  prices: ReadonlyArray<{ variantId: string | null; currency: string; price: string }>;
}

/**
 * The currencies this product could be priced in besides the workspace's:
 * every language's currency, then any it already has prices in, then the
 * ones added on the page — once each, in that order.
 */
export function extraCurrencies(
  locales: readonly LocaleLike[],
  base: string,
  priced: ReadonlyArray<{ currency: string }>,
  added: readonly string[] = [],
): string[] {
  const seen = new Set<string>([base]);
  const out: string[] = [];
  for (const code of [...locales.map((locale) => locale.currency), ...priced.map((row) => row.currency), ...added]) {
    const clean = code?.trim().toUpperCase();
    if (clean && /^[A-Z]{3}$/.test(clean) && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  }
  return out;
}

/** How much of a product is written in one language: name, description if it has one, each option and value. */
export function translationProgress(catalog: CatalogLike, locale: string): { done: number; of: number } {
  const text = catalog.translations.item.find((row) => row.locale === locale);
  const labels = catalog.translations.options.filter((row) => row.locale === locale && row.label.trim());
  const hasDescription = Boolean(catalog.item.description?.trim());
  const ids = catalog.options.flatMap((option) => [option.id, ...option.values.map((value) => value.id)]);
  const of = 1 + (hasDescription ? 1 : 0) + ids.length;
  const done =
    (text?.name?.trim() ? 1 : 0) +
    (hasDescription && text?.description?.trim() ? 1 : 0) +
    ids.filter((id) => labels.some((row) => row.optionId === id || row.optionValueId === id)).length;
  return { done, of };
}

/**
 * How many of the product's sizes can be sold in a currency: a size with its
 * own price, or any size once the product has one. No sizes: the product alone.
 */
export function pricedIn(catalog: CatalogLike, currency: string): { priced: number; of: number } {
  const rows = catalog.prices.filter((row) => row.currency === currency);
  const productPriced = rows.some((row) => row.variantId === null);
  if (catalog.variants.length === 0) return { priced: productPriced ? 1 : 0, of: 1 };
  const priced = catalog.variants.filter((variant) => productPriced || rows.some((row) => row.variantId === variant.id)).length;
  return { priced, of: catalog.variants.length };
}

/** The lowest price a shopper would see in a currency — "from ₴1,200" — or null when it can't be sold in it yet. */
export function fromPrice(catalog: CatalogLike, currency: string): string | null {
  const { priced, of } = pricedIn(catalog, currency);
  if (priced < of) return null;
  const rows = catalog.prices.filter((row) => row.currency === currency);
  const product = rows.find((row) => row.variantId === null)?.price;
  const amounts =
    catalog.variants.length === 0
      ? [Number(product)]
      : catalog.variants.map((variant) => Number(rows.find((row) => row.variantId === variant.id)?.price ?? product));
  return Math.min(...amounts).toFixed(2);
}
