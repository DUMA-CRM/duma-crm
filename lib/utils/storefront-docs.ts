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

/** Price the basket before taking payment: the order's own pricing, nothing recorded. */
export const QUOTE_EXAMPLE = {
  items: [{ sku: 'HD-BLK-M', quantity: 1 }],
  fulfilment: { type: 'shipping', fee: '3.95', address: ORDER_EXAMPLE.fulfilment.address },
  promoCode: 'SUMMER10',
  customerEmail: 'sam@example.com',
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
  {
    status: 400,
    code: 'promo_invalid',
    when: 'The order’s `promoCode` can’t be used — the message says why (expired, used, needs a first order…). Nothing was recorded.',
  },
  { status: 409, code: 'total_mismatch', when: 'DUMA’s total differs from `expectedTotal` — prices changed. Nothing was recorded.' },
  { status: 409, code: 'promo_unavailable', when: 'The promo code ran out between the quote and the order. Nothing was recorded.' },
  {
    status: 409,
    code: 'price_unavailable',
    when: 'The order’s `currency` has no price for a line — set it on the product in DUMA. Nothing was recorded.',
  },
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
    '- GET /locales → { data: [{ code, name, isDefault, currency }] } — the languages the shop sells in',
    'Other languages and currencies: add `locale=<code>` to product reads for the text in that language (untranslated text comes back in the default), and `currency=<code>` for prices in another currency (default: the language’s currency, else the shop’s). A product without a price in that currency comes back in the shop’s — always show the `currency` it carries.',
    'A Product has name, slug, description, category, currency, price ("from" — the lowest size), available, options [{ name, values }], images [{ url, altText, srcset, focalPoint, option }], and variants [{ id, sku, name, options: { Size: "M", Colour: "Black" }, price, compareAtPrice, available, stock }].',
    'Money is a decimal string. Show a size as sold out when `available` is false. A photo with `option` belongs to that colour — show it when the colour is picked. Use `srcset` and `focalPoint` (as object-position) on images. Cache the catalogue for 30–60 s.',
    '',
    'Before payment — price the basket, from the server, with the secret key (nothing is recorded):',
    '- POST /orders/quote with JSON:',
    JSON.stringify(QUOTE_EXAMPLE, null, 2),
    '→ { data: { items: [{ name, quantity, unitPrice, subtotal, adjustments }], itemsTotal, deliveryFee, discount, tax, total, currency, promo: { code, valid, summary, discount } | { code, valid: false, reason } | null } }. Charge `total`. A promo code that can’t be used comes back with `valid: false` and its `reason` — show it, and the rest is priced without it. Send `customerEmail` once known: some codes are once per customer or for a first order.',
    '',
    'Checkout — the website takes the payment itself (e.g. Stripe). Only after the payment succeeds, from the server, with the secret key:',
    '- POST /orders with JSON:',
    JSON.stringify(ORDER_EXAMPLE, null, 2),
    'Rules: send products and sizes (`sku` or `variantId`, or `productId` for a product with no sizes), never prices — DUMA prices every line. `externalReference` is the shop’s own order number: sending it again returns the same order (200), so retries are safe. Send `expectedTotal` = what was charged; if DUMA’s total differs it records nothing and answers 409 `total_mismatch` with its total. `fulfilment.type` is shipping, delivery or collection (no address). Charged in another currency? Send `currency` (e.g. "UAH"): every line must have a price in it, or the answer is 409 `price_unavailable`; only percentage discounts apply outside the shop’s own currency.',
    'Promo code: send the same `promoCode` on the order. It is checked again and reserved as the order is recorded: if it ran out since the quote, the answer is 409 `promo_unavailable` and nothing is recorded — refund or contact the customer.',
    'Stock is taken when the order is recorded: if a size ran out, the answer is 409 `out_of_stock` with `items: [{ sku, name, requested, available }]` and nothing is recorded — refund or contact the customer.',
    'Response 201: { data: { id, externalReference, status, paymentStatus: "paid", total, currency, items, … } }.',
    '',
    'Refer a friend (secret key, from the server — when the shop has it on):',
    '- POST /referral-code { email } → { data: { code } } — a signed-in shopper’s own code, issued the first time, for an "invite a friend" page. A friend sends it as `promoCode`. 404 `customer_not_found` until they’ve ordered or signed up; 409 `referrals_unavailable` when it isn’t running.',
    '',
    'Newsletter (secret key, from the server):',
    '- POST /newsletter { email, firstName?, lastName? } → { data: { status: "subscribed", alreadySubscribed } }',
    '- POST /newsletter/unsubscribe { email } → { data: { status: "unsubscribed" } }',
    '',
    'Errors are JSON { error, code }:',
    ...ERRORS.map((entry) => `- ${entry.status} ${entry.code}: ${entry.when}`),
  ].join('\n');
}
