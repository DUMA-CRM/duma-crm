import assert from 'node:assert/strict';
import test from 'node:test';

const { gridSize, mapColumns, missingCombinations, parseCsv, rowsFromCsv } = await import('../lib/utils/catalog-import.ts');

test('CSV: quotes, doubled quotes, line breaks inside quotes, CRLF and semicolons', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\n'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
  ]);
  assert.deepEqual(parseCsv('a;b\n1;2'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
  assert.deepEqual(parseCsv('a\n"line 1\nline 2"'), [['a'], ['line 1\nline 2']]);
  assert.deepEqual(parseCsv('﻿a,b\n\n1,2\n'), [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('columns are matched by the names people use', () => {
  const map = mapColumns(['Product', 'Category', 'Size', 'Color', 'Price', 'Qty', 'Image URL', 'Notes']);
  assert.equal(map.fields.product, 0);
  assert.equal(map.fields.stock, 5);
  assert.equal(map.fields.imageUrl, 6);
  assert.deepEqual(map.options, [
    { name: 'Size', column: 2 },
    { name: 'Colour', column: 3 },
  ]);
  assert.deepEqual(map.unused, ['Notes']);
});

test('our own sheet becomes import rows', () => {
  const { rows, error } = rowsFromCsv(
    'Product,Category,Colour,Size,Price,SKU,Stock\nOversized Hoodie,Hoodies,Black,M,45.00,HD-BLK-M,12\nOversized Hoodie,Hoodies,Black,L,45.00,,4\n',
  );
  assert.equal(error, null);
  assert.deepEqual(rows[0], {
    product: 'Oversized Hoodie',
    category: 'Hoodies',
    price: '45.00',
    sku: 'HD-BLK-M',
    options: { Colour: 'Black', Size: 'M' },
    stock: 12,
  });
  assert.equal(rows[1]!.sku, undefined);
});

test('a Shopify export carries the title down and reads its option pairs', () => {
  const csv = [
    'Handle,Title,Body (HTML),Type,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Price,Variant Inventory Qty,Image Src',
    'logo-tee,Logo Tee,<p>Soft <b>cotton</b></p>,T-shirts,Size,S,Colour,White,TEE-S-W,20.00,5,https://cdn.shopify.com/tee.jpg',
    'logo-tee,,,,,M,,White,TEE-M-W,20.00,3,',
    'gift-card,Gift Card,,,Title,Default Title,,,,25.00,,',
  ].join('\n');
  const { rows } = rowsFromCsv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.product, 'Logo Tee');
  assert.equal(rows[0]!.description, 'Soft cotton');
  assert.equal(rows[0]!.category, 'T-shirts');
  assert.deepEqual(rows[0]!.options, { Size: 'S', Colour: 'White' });
  assert.equal(rows[0]!.imageUrl, 'https://cdn.shopify.com/tee.jpg');
  // Shopify leaves the second row's title and names blank.
  assert.equal(rows[1]!.product, 'Logo Tee');
  assert.equal(rows[1]!.category, 'T-shirts');
  assert.deepEqual(rows[1]!.options, undefined, 'blank option names carry no option');
  assert.equal(rows[2]!.options, undefined, '"Default Title" is no option');
});

test('a sheet without names or prices says what is missing', () => {
  assert.match(rowsFromCsv('Colour,Price\nBlack,10').error!, /product name/);
  assert.match(rowsFromCsv('Name,Colour\nTee,Black').error!, /price/);
});

test('the grid counts sizes, and the ones a product lacks', () => {
  const options = [
    { name: 'Size', values: ['S', 'M', 'L'] },
    { name: 'Colour', values: ['Black', 'black', 'White'] },
  ];
  assert.equal(gridSize(options), 6);
  assert.equal(gridSize([{ name: 'Size', values: [] }]), 0);
  assert.equal(
    missingCombinations(options, [
      { Size: 's', Colour: 'BLACK' },
      { colour: 'White', size: 'M' },
    ]),
    4,
  );
});
