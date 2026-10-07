// ---------------------------------------------------------------------------
// The product editor's arithmetic, kept pure so it is tested:
//
// - reading a sheet (CSV, as Excel, Google Sheets or Shopify export it) into
//   the rows POST /catalog/import accepts, matching columns by their names;
// - the size grid: how many variants a set of options makes, and how many of
//   those a product does not have yet.
// ---------------------------------------------------------------------------

export interface CatalogImportRow {
  product: string;
  category?: string;
  description?: string;
  price?: string;
  compareAtPrice?: string;
  sku?: string;
  barcode?: string;
  options?: Record<string, string>;
  stock?: number;
  imageUrl?: string;
}

/** RFC 4180-ish: quoted fields, doubled quotes inside them, commas or semicolons, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  // Excel in much of Europe saves with semicolons.
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

type Field = 'product' | 'category' | 'description' | 'price' | 'compareAtPrice' | 'sku' | 'barcode' | 'stock' | 'imageUrl';

/** The names a column goes by, lower-cased with punctuation removed — ours, and Shopify's export. */
const ALIASES: Record<Field, string[]> = {
  product: ['product', 'productname', 'name', 'title', 'item', 'handle'],
  category: ['category', 'type', 'producttype', 'collection'],
  description: ['description', 'body', 'bodyhtml', 'details'],
  price: ['price', 'variantprice', 'saleprice', 'retailprice'],
  compareAtPrice: ['compareatprice', 'variantcompareatprice', 'wasprice', 'rrp', 'originalprice'],
  sku: ['sku', 'variantsku', 'code', 'productcode'],
  barcode: ['barcode', 'variantbarcode', 'ean', 'upc', 'gtin'],
  stock: ['stock', 'quantity', 'qty', 'inventory', 'variantinventoryqty', 'onhand', 'instock'],
  imageUrl: ['image', 'imageurl', 'imagesrc', 'photo', 'picture'],
};

/** Columns that are an option themselves ("Size", "Colour"). */
const OPTION_COLUMNS: Record<string, string> = {
  size: 'Size',
  colour: 'Colour',
  color: 'Colour',
  fit: 'Fit',
  material: 'Material',
  style: 'Style',
  length: 'Length',
};

const key = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ColumnMap {
  fields: Partial<Record<Field, number>>;
  /** Option name → column; Shopify's paired "Option1 Name/Value" columns come through as name → value columns. */
  options: Array<{ name: string; column: number } | { nameColumn: number; valueColumn: number }>;
  unused: string[];
}

export function mapColumns(headers: readonly string[]): ColumnMap {
  const fields: ColumnMap['fields'] = {};
  const options: ColumnMap['options'] = [];
  const used = new Set<number>();
  headers.forEach((header, column) => {
    const name = key(header);
    const field = (Object.keys(ALIASES) as Field[]).find((candidate) => ALIASES[candidate].includes(name));
    // "Handle" only stands in for the product when there is no proper title column.
    if (field && fields[field] === undefined && !(field === 'product' && name === 'handle')) {
      fields[field] = column;
      used.add(column);
      return;
    }
    if (OPTION_COLUMNS[name]) {
      options.push({ name: OPTION_COLUMNS[name]!, column });
      used.add(column);
    }
  });
  if (fields.product === undefined) {
    const handle = headers.findIndex((header) => key(header) === 'handle');
    if (handle >= 0) {
      fields.product = handle;
      used.add(handle);
    }
  }
  for (let n = 1; n <= 3; n += 1) {
    const nameColumn = headers.findIndex((header) => key(header) === `option${n}name`);
    const valueColumn = headers.findIndex((header) => key(header) === `option${n}value`);
    if (nameColumn >= 0 && valueColumn >= 0) {
      options.push({ nameColumn, valueColumn });
      used.add(nameColumn).add(valueColumn);
    }
  }
  return { fields, options, unused: headers.filter((_, column) => !used.has(column)) };
}

/**
 * A sheet's rows, ready for the import endpoint. Shopify leaves the title and
 * type blank on a product's second and later rows; those carry over from the
 * row above, as Shopify means them to.
 */
export function rowsFromCsv(text: string): { rows: CatalogImportRow[]; map: ColumnMap; error: string | null } {
  const [headers = [], ...lines] = parseCsv(text);
  const map = mapColumns(headers);
  if (map.fields.product === undefined) return { rows: [], map, error: 'No product name column — call one "Product", "Name" or "Title".' };
  if (map.fields.price === undefined) return { rows: [], map, error: 'No price column — call one "Price".' };
  const cell = (line: string[], column: number | undefined) => (column === undefined ? '' : (line[column] ?? '').trim());
  const rows: CatalogImportRow[] = [];
  let carry = { product: '', category: '', description: '' };
  for (const line of lines) {
    const product = cell(line, map.fields.product) || carry.product;
    if (!product) continue;
    const sameProduct = product === carry.product;
    const category = cell(line, map.fields.category) || (sameProduct ? carry.category : '');
    const description = cell(line, map.fields.description) || (sameProduct ? carry.description : '');
    carry = { product, category, description };
    const options: Record<string, string> = {};
    for (const option of map.options) {
      if ('column' in option) {
        const value = cell(line, option.column);
        if (value) options[option.name] = value;
      } else {
        const name = cell(line, option.nameColumn);
        const value = cell(line, option.valueColumn);
        // Shopify writes "Title / Default Title" for a product with no options.
        if (name && value && !(name === 'Title' && value === 'Default Title')) options[name] = value;
      }
    }
    const stockText = cell(line, map.fields.stock);
    const stock = stockText === '' ? undefined : Number(stockText.replace(/[^\d.-]/g, ''));
    rows.push({
      product,
      ...(category ? { category } : {}),
      ...(description
        ? {
            description: description
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim(),
          }
        : {}),
      ...(cell(line, map.fields.price) ? { price: cell(line, map.fields.price) } : {}),
      ...(cell(line, map.fields.compareAtPrice) ? { compareAtPrice: cell(line, map.fields.compareAtPrice) } : {}),
      ...(cell(line, map.fields.sku) ? { sku: cell(line, map.fields.sku) } : {}),
      ...(cell(line, map.fields.barcode) ? { barcode: cell(line, map.fields.barcode) } : {}),
      ...(Object.keys(options).length > 0 ? { options } : {}),
      ...(stock !== undefined && Number.isFinite(stock) ? { stock: Math.max(0, Math.floor(stock)) } : {}),
      ...(cell(line, map.fields.imageUrl) ? { imageUrl: cell(line, map.fields.imageUrl) } : {}),
    });
  }
  return { rows, map, error: rows.length === 0 ? 'The sheet has no product rows.' : null };
}

// ─── The size grid ───────────────────────────────────────────────────────────

export interface GridOption {
  name: string;
  values: string[];
}

/** Ready-made option sets, one tap each. */
export const OPTION_PRESETS: ReadonlyArray<{ label: string; option: GridOption }> = [
  { label: 'S–XL', option: { name: 'Size', values: ['S', 'M', 'L', 'XL'] } },
  { label: 'XS–XXL', option: { name: 'Size', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] } },
  { label: 'Colours', option: { name: 'Colour', values: ['Black', 'White'] } },
];

/** How many variants these options make, counting only options with a name and at least one value. */
export function gridSize(options: readonly GridOption[]): number {
  const usable = options.filter((option) => option.name.trim() && option.values.some((value) => value.trim()));
  return usable.length === 0
    ? 0
    : usable.reduce(
        (product, option) => product * new Set(option.values.map((value) => value.trim().toLowerCase()).filter(Boolean)).size,
        1,
      );
}

/** Of those, how many the product lacks — matching existing variants by their option values, any case, any order. */
export function missingCombinations(options: readonly GridOption[], existing: ReadonlyArray<Record<string, string>>): number {
  const usable = options.filter((option) => option.name.trim() && option.values.some((value) => value.trim()));
  if (usable.length === 0) return 0;
  const signature = (entry: Record<string, string>) =>
    Object.entries(entry)
      .map(([name, value]) => `${name.trim().toLowerCase()}=${value.trim().toLowerCase()}`)
      .sort()
      .join('|');
  const have = new Set(existing.map(signature));
  let combos: Array<Record<string, string>> = [{}];
  for (const option of usable) {
    // One per value, whatever its case — "Black" and "black" are the same colour.
    const values = [
      ...new Map(
        option.values
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => [value.toLowerCase(), value]),
      ).values(),
    ];
    combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [option.name.trim()]: value })));
  }
  return combos.filter((combo) => !have.has(signature(combo))).length;
}
