// ---------------------------------------------------------------------------
// The storefront API, documented for the person — or the AI assistant —
// building the website. One source for the Developers page's examples and the
// "Copy prompt for AI" brief, so the two cannot disagree.
// ---------------------------------------------------------------------------

export const storeBase = (apiOrigin: string) => `${apiOrigin.replace(/\/$/, '')}/v1/store`;

export const PRODUCT_EXAMPLE = {
  data: {
    id: '3f1c…',
    slug: 'oversized-hoodie',
    name: 'Oversized Hoodie',
    description: 'Heavyweight brushed cotton.',
    category: { id: '9a2e…', name: 'Hoodies', slug: 'hoodies' },
    currency: 'GBP',
    price: '45.00',
    available: true,
    options: [
      { name: 'Colour', values: ['Black', 'White'] },
      { name: 'Size', values: ['S', 'M', 'L'] },
    ],
    images: [
      {
        url: 'https://…/hoodie-black.jpg',
        altText: 'Black hoodie, front',
        srcset: 'https://… 480w, …',
        focalPoint: { x: 0.5, y: 0.4 },
        option: { name: 'Colour', value: 'Black' },
      },
    ],
    variants: [
      {
        id: 'b71d…',
        name: 'Black / M',
        sku: 'HD-BLK-M',
        options: { Colour: 'Black', Size: 'M' },
        price: '45.00',
        compareAtPrice: null,
        available: true,
        stock: 12,
      },
      {
        id: 'c02a…',
        name: 'Black / L',
        sku: 'HD-BLK-L',
        options: { Colour: 'Black', Size: 'L' },
        price: '45.00',
        compareAtPrice: null,
        available: false,
        stock: 0,
      },
    ],
  },
};

export const ORDER_EXAMPLE = {
  externalReference: '#1042',
  customer: { email: 'sam@example.com', firstName: 'Sam', lastName: 'Lee', marketingOptIn: true },
  items: [{ sku: 'HD-BLK-M', quantity: 1 }],
  fulfilment: {
    type: 'shipping',
    method: 'Royal Mail Tracked 48',
    fee: '3.95',
    address: { recipientName: 'Sam Lee', line1: '1 High Street', city: 'Leeds', postcode: 'LS1 1AA', country: 'GB' },
  },
  payment: { provider: 'stripe', reference: 'pi_3Nf…' },
  expectedTotal: '48.95',
};

export const ERRORS: ReadonlyArray<{ status: number; code: string; when: string }> = [
  {
    status: 400,
    code: 'validation_failed',
    when: 'An unknown product or size, a product with sizes sent without one, or a bad discount code — the message says which line.',
  },
  { status: 401, code: 'unauthorized', when: 'Missing, unknown, revoked or expired key.' },
  {
    status: 403,
    code: 'missing_capability',
    when: 'A publishable key used to write, or a key without the scope, or a website the key does not allow.',
  },
  { status: 409, code: 'out_of_stock', when: 'A size ran out. Nothing was recorded; `items` lists each SKU and how many are left.' },
  { status: 409, code: 'total_mismatch', when: 'DUMA’s total differs from `expectedTotal` — prices changed. Nothing was recorded.' },
  { status: 409, code: 'location_not_configured', when: 'The key has no location to sell from. Set one in Settings → Developers.' },
  { status: 429, code: 'rate_limited', when: 'About 600 requests a minute per key. Cache the catalogue.' },
];

/** A brief to paste into Claude, Cursor or Copilot: everything needed to connect a shop, no keys inside. */
export function buildStorefrontPrompt(apiOrigin: string, shopName?: string): string {
  const base = storeBase(apiOrigin);
  return [
    `Connect ${shopName ? `the "${shopName}" online shop` : 'this online shop'} to DUMA, which holds its products, stock, orders, customers and newsletter list.`,
    '',
    'Environment (never hard-code keys):',
    `- DUMA_STORE_URL=${base}`,
    '- DUMA_PUBLISHABLE_KEY=dk_pub_…  (may be used in the browser — reads the catalogue only)',
    '- DUMA_SECRET_KEY=dk_sec_…  (server only — records orders and sign-ups)',
    'Send a key as `Authorization: Bearer <key>`.',
    '',
    'Catalogue (publishable or secret key):',
    '- GET /products?category=<slug>&q=<search>&limit=24&page=1 → { data: Product[], meta: { total, limit, page, pages } }',
    '- GET /products/<slug or id> → { data: Product }',
    '- GET /categories → { data: [{ id, name, slug }] }',
    'A Product has name, slug, description, category, currency, price ("from" — the lowest size), available, options [{ name, values }], images [{ url, altText, srcset, focalPoint, option }], and variants [{ id, sku, name, options: { Size: "M", Colour: "Black" }, price, compareAtPrice, available, stock }].',
    'Money is a decimal string. Show a size as sold out when `available` is false. A photo with `option` belongs to that colour — show it when the colour is picked. Use `srcset` and `focalPoint` (as object-position) on images. Cache the catalogue for 30–60 s.',
    '',
    'Checkout — the website takes the payment itself (e.g. Stripe). Only after the payment succeeds, from the server, with the secret key:',
    '- POST /orders with JSON:',
    JSON.stringify(ORDER_EXAMPLE, null, 2),
    'Rules: send products and sizes (`sku` or `variantId`, or `productId` for a product with no sizes), never prices — DUMA prices every line. `externalReference` is the shop’s own order number: sending it again returns the same order (200), so retries are safe. Send `expectedTotal` = what was charged; if DUMA’s total differs it records nothing and answers 409 `total_mismatch` with its total. `fulfilment.type` is shipping, delivery or collection (no address).',
    'Stock is taken when the order is recorded: if a size ran out, the answer is 409 `out_of_stock` with `items: [{ sku, name, requested, available }]` and nothing is recorded — refund or contact the customer.',
    'Response 201: { data: { id, externalReference, status, paymentStatus: "paid", total, currency, items, … } }.',
    '',
    'Newsletter (secret key, from the server):',
    '- POST /newsletter { email, firstName?, lastName? } → { data: { status: "subscribed", alreadySubscribed } }',
    '- POST /newsletter/unsubscribe { email } → { data: { status: "unsubscribed" } }',
    '',
    'Errors are JSON { error, code }:',
    ...ERRORS.map((entry) => `- ${entry.status} ${entry.code}: ${entry.when}`),
  ].join('\n');
}
