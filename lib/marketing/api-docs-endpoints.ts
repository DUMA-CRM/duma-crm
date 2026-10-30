// ---------------------------------------------------------------------------
// The public API reference pages, one per endpoint.
//
// Derived on 2026-10-28 from the duma-api source: src/routes/store.ts,
// src/lib/storefront.ts, src/lib/storefront-order.ts, src/lib/storefront-payment.ts,
// src/lib/catalog-i18n.ts, src/routes/cms-delivery.ts, src/lib/cms-query.ts,
// src/lib/cms-fields.ts, src/routes/cms-manage.ts and src/lib/cms-authoring.ts.
// Nothing checks this file against the API: update it whenever those routes,
// their validators or their response shapes change.
//
// Paths are relative to each API's base (/v1/store, /v1/cms/delivery,
// /v1/cms/manage) and match lib/developers/api-reference.ts `PUBLIC_APIS`.
// ---------------------------------------------------------------------------

export type DocField = { name: string; type: string; required: boolean; description: string; values?: string[]; default?: string };

export type EndpointDoc = {
  api: 'store' | 'content' | 'manage';
  method: 'GET' | 'POST';
  /** Relative to the API base, `{param}` style, exactly as in api-reference.ts. */
  path: string;
  description: string;
  pathParams: DocField[];
  queryParams: DocField[];
  bodyFields: DocField[];
  exampleBody?: unknown;
  exampleResponse: unknown;
  successStatus: number;
  notes?: string[];
};

// ─── Shared shapes ───────────────────────────────────────────────────────────

const STORE_LOCALE_QUERY: DocField[] = [
  {
    name: 'locale',
    type: 'string',
    required: false,
    description: 'A language code from GET /locales. Text comes in that language, falling back along its fallback languages, then the default.',
  },
  {
    name: 'currency',
    type: 'string',
    required: false,
    description: 'A three-letter currency code. Otherwise the language’s currency, otherwise the workspace’s. A product with no price in the requested currency stays in the workspace’s, and its `currency` says which.',
  },
];

const STORE_READ_NOTES = [
  'Scope `catalog:read` — a publishable key (`dk_pub_…`) may call it from the browser.',
  'Responses carry `Cache-Control: private, max-age=30` and `Vary: Authorization, X-Api-Key, Origin`.',
];

const SECRET_ONLY = 'Secret key only (`dk_sec_…`) — call it from your server, never from the browser.';

const EXAMPLE_PRODUCT = {
  id: '8f1c2a4e-3b6d-4c1e-9a7f-2d5b8e0c4a13',
  slug: 'oversized-hoodie',
  name: 'Oversized Hoodie',
  description: 'Heavyweight organic cotton, brushed inside.',
  category: { id: 'c2a7e5d1-9f3b-4a6c-8e1d-5b7f0a2c3e94', name: 'Hoodies', slug: 'hoodies' },
  images: [
    {
      url: 'https://api.duma-business.com/v1/cms/delivery/assets/5e9a1c7b-2d4f-4b8e-a6c3-1f0d9e8b7a62/file/hoodie-black.jpg',
      altText: 'Oversized Hoodie in black',
      width: 2000,
      height: 2500,
      focalPoint: { x: 0.5, y: 0.4 },
      srcset:
        'https://api.duma-business.com/v1/cms/delivery/assets/5e9a1c7b-2d4f-4b8e-a6c3-1f0d9e8b7a62/renditions/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d 640w, https://api.duma-business.com/v1/cms/delivery/assets/5e9a1c7b-2d4f-4b8e-a6c3-1f0d9e8b7a62/file/hoodie-black.jpg 2000w',
      option: { name: 'Colour', value: 'Black' },
    },
  ],
  currency: 'GBP',
  price: '48.00',
  available: true,
  options: [
    { name: 'Size', values: ['S', 'M', 'L'] },
    { name: 'Colour', values: ['Black'] },
  ],
  variants: [
    {
      id: '3d7e9b1a-6c4f-4e2d-b8a5-9f0c1e2d3a4b',
      name: 'M / Black',
      sku: 'HOOD-BLK-M',
      barcode: '5012345678900',
      options: { Size: 'M', Colour: 'Black' },
      price: '48.00',
      compareAtPrice: '60.00',
      available: true,
      stock: 7,
    },
  ],
};

const EXAMPLE_ORDER = {
  id: '6b2d8f4a-1e3c-4a5b-9d7e-0f1a2b3c4d5e',
  externalReference: 'WEB-10482',
  status: 'pending',
  paymentStatus: 'paid',
  payment: { status: 'paid', provider: 'stripe', reference: 'pi_3PqR8sLkdIwHu7ix0abc1234', method: 'card' },
  expiresAt: null,
  totals: { items: '96.00', deliveryFee: '4.95', discount: '0.00', tax: '16.00', total: '100.95' },
  currency: 'GBP',
  total: '100.95',
  tax: '16.00',
  deliveryFee: '4.95',
  fulfilment: {
    type: 'shipping',
    method: 'Royal Mail Tracked 48',
    address: {
      recipientName: 'Amelia Hart',
      phone: '07700 900123',
      line1: '14 Elm Grove',
      line2: null,
      city: 'Bristol',
      region: null,
      postcode: 'BS6 6AH',
      country: 'GB',
    },
  },
  customerId: '9c1e3a5b-7d2f-4b6a-8e0c-1d3f5a7b9c2e',
  items: [
    {
      productId: '8f1c2a4e-3b6d-4c1e-9a7f-2d5b8e0c4a13',
      variantId: '3d7e9b1a-6c4f-4e2d-b8a5-9f0c1e2d3a4b',
      sku: 'HOOD-BLK-M',
      name: 'Oversized Hoodie — M / Black',
      quantity: 2,
      unitPrice: '48.00',
      subtotal: '96.00',
    },
  ],
  createdAt: '2026-10-28T10:42:17.000Z',
};

const ITEM_FIELDS: DocField[] = [
  { name: 'items', type: 'array', required: true, description: 'The basket, 1 to 100 lines. Name each line’s product with `productId`, `variantId` or `sku` — prices always come from DUMA.' },
  { name: 'items[].productId', type: 'string (uuid)', required: false, description: 'The product. A product that comes in sizes also needs `variantId` or `sku`.' },
  { name: 'items[].variantId', type: 'string (uuid)', required: false, description: 'The size. On its own it names its product.' },
  { name: 'items[].sku', type: 'string', required: false, description: 'The size by SKU, instead of `variantId`. Up to 100 characters.' },
  { name: 'items[].quantity', type: 'number', required: true, description: 'A whole number from 1 to 999.' },
  { name: 'items[].discountCode', type: 'string', required: false, description: 'Deprecated: a catalogue discount’s code for this line. Use `promoCode` instead.' },
];

const FULFILMENT_FIELDS: DocField[] = [
  { name: 'fulfilment', type: 'object', required: true, description: 'How the order reaches the shopper.' },
  { name: 'fulfilment.type', type: 'string', required: true, description: 'Shipping and delivery need an `address`; collection does not.', values: ['shipping', 'delivery', 'collection'] },
  { name: 'fulfilment.method', type: 'string', required: false, description: 'Your name for the service, e.g. “Royal Mail Tracked 48”. Up to 100 characters.' },
  { name: 'fulfilment.fee', type: 'string', required: false, description: 'Delivery fee as a decimal string such as "4.95". Shipping and delivery only; collection is always free.', default: '"0"' },
  { name: 'fulfilment.address', type: 'object', required: false, description: 'Required for shipping and delivery.' },
  { name: 'fulfilment.address.recipientName', type: 'string', required: true, description: 'Up to 200 characters.' },
  { name: 'fulfilment.address.phone', type: 'string', required: false, description: 'Up to 30 characters.' },
  { name: 'fulfilment.address.line1', type: 'string', required: true, description: 'Up to 200 characters.' },
  { name: 'fulfilment.address.line2', type: 'string', required: false, description: 'Up to 200 characters.' },
  { name: 'fulfilment.address.city', type: 'string', required: true, description: 'Up to 120 characters.' },
  { name: 'fulfilment.address.region', type: 'string', required: false, description: 'Up to 120 characters.' },
  { name: 'fulfilment.address.postcode', type: 'string', required: true, description: 'Up to 20 characters.' },
  { name: 'fulfilment.address.country', type: 'string', required: true, description: 'A two-letter country code, such as GB. Upper-cased for you.' },
];

const BASKET_EXTRAS: DocField[] = [
  { name: 'currency', type: 'string', required: false, description: 'The three-letter currency the shopper pays in; the workspace’s if omitted. Every line needs a price in it, or the request fails with 409 `price_unavailable`.' },
  { name: 'promoCode', type: 'string', required: false, description: 'A promo code for the whole order (promotions module). Case and spaces do not matter. Up to 60 characters.' },
];

const EXAMPLE_ADDRESS = {
  recipientName: 'Amelia Hart',
  phone: '07700 900123',
  line1: '14 Elm Grove',
  city: 'Bristol',
  postcode: 'BS6 6AH',
  country: 'GB',
};

const CONTENT_READ_NOTES = [
  'Scope `content:read` — a publishable key may call it from the browser.',
  'Responses carry a weak `ETag`; send it back as `If-None-Match` to get `304 Not Modified`. `Cache-Control: private, max-age=30, stale-while-revalidate=120`.',
];

const ENTRY_READ_QUERY: DocField[] = [
  { name: 'locale', type: 'string', required: false, description: 'A configured locale code. Defaults to the workspace’s default locale; an unknown code is a 400.' },
  { name: 'fallback', type: 'boolean', required: false, description: 'When true, an entry missing in `locale` is served in its fallback language, then the default.', values: ['true', 'false'], default: 'true' },
  { name: 'fields', type: 'string', required: false, description: 'Comma-separated field keys to return, e.g. `title,hero`. Unknown or private fields are a 400.' },
  { name: 'include', type: 'number', required: false, description: 'How many levels of media and reference fields to resolve into objects (0–3). Anything unresolvable stays as `{ id }`.', default: '1' },
  { name: 'status', type: 'string', required: false, description: '`draft` reads drafts — only a secret key with `content:preview`.', values: ['published', 'draft'], default: 'published' },
];

const EXAMPLE_ENTRY = {
  id: '4a8c2e6f-1b3d-4f5a-9c7e-2d4f6a8b0c1e',
  type: 'blog-post',
  locale: 'en',
  slug: 'autumn-menu-is-here',
  createdAt: '2026-10-01T09:15:00.000Z',
  updatedAt: '2026-10-20T14:02:11.000Z',
  publishedAt: '2026-10-20T14:05:00.000Z',
  firstPublishedAt: '2026-10-02T08:00:00.000Z',
  fields: {
    title: 'Our autumn menu is here',
    slug: 'autumn-menu-is-here',
    hero: {
      id: '7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f',
      url: 'https://api.duma-business.com/v1/cms/delivery/assets/7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f/file/pumpkin-latte.jpg',
      fileName: 'pumpkin-latte.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 412883,
      width: 1600,
      height: 1067,
      title: 'Pumpkin spice latte',
      altText: 'A pumpkin spice latte on an oak table',
      focalPoint: { x: 0.5, y: 0.45 },
      renditions: [],
      srcset: null,
    },
    // Rich text is delivered as the Markdown the editor wrote — the API does not convert it.
    body: '## Back for autumn\n\nPumpkin spice is back, alongside a new **maple pecan bun**.',
  },
};

const EXAMPLE_CONTENT_TYPE_FIELDS = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'slug', label: 'Slug', type: 'slug', required: true, unique: true, slugSource: 'title' },
  { key: 'hero', label: 'Hero image', type: 'media', mediaGroups: ['image'] },
  { key: 'body', label: 'Body', type: 'richText' },
];

const FIELD_TYPES = ['text', 'longText', 'richText', 'number', 'boolean', 'date', 'dateTime', 'select', 'slug', 'email', 'url', 'color', 'location', 'json', 'media', 'reference', 'group'];

const MANAGE_NOTES = [
  'Secret workspace key only (`dk_sec_…`); legacy `dcms_…` content keys are refused with 401.',
  'Every authenticated request is written to the workspace’s audit log with the key as the actor.',
];

// ─── The endpoints ───────────────────────────────────────────────────────────

export const ENDPOINT_DOCS: readonly EndpointDoc[] = [
  // ── Store API ──
  {
    api: 'store',
    method: 'GET',
    path: '/products',
    description:
      'Lists the products that are for sale, with their sizes, prices and availability at the key’s location. Sorted by the catalogue’s own order, then name.',
    pathParams: [],
    queryParams: [
      { name: 'category', type: 'string', required: false, description: 'A category slug or id. An unknown category returns an empty page.' },
      { name: 'q', type: 'string', required: false, description: 'Searches product names and descriptions.' },
      { name: 'limit', type: 'number', required: false, description: 'Products per page, 1–100.', default: '24' },
      { name: 'page', type: 'number', required: false, description: 'The page to return, from 1.', default: '1' },
      ...STORE_LOCALE_QUERY,
    ],
    bodyFields: [],
    exampleResponse: { data: [EXAMPLE_PRODUCT], meta: { total: 36, limit: 24, page: 1, pages: 2 } },
    successStatus: 200,
    notes: [
      ...STORE_READ_NOTES,
      '`price` on a product is the lowest price of any size — “from £48”.',
      '`compareAtPrice` is only set when it is higher than `price`. `stock` is null for sizes whose stock is not tracked; tracked stock needs a whole unit on hand at the key’s location to be `available`.',
    ],
  },
  {
    api: 'store',
    method: 'GET',
    path: '/products/{idOrSlug}',
    description: 'Returns one product that is for sale, by its id or slug, in the same shape as the product list.',
    pathParams: [{ name: 'idOrSlug', type: 'string', required: true, description: 'The product’s id (a UUID) or its slug.' }],
    queryParams: [...STORE_LOCALE_QUERY],
    bodyFields: [],
    exampleResponse: { data: EXAMPLE_PRODUCT },
    successStatus: 200,
    notes: [...STORE_READ_NOTES, 'A product that does not exist or is not for sale is a 404.'],
  },
  {
    api: 'store',
    method: 'GET',
    path: '/categories',
    description: 'Lists the workspace’s active categories, in the catalogue’s own order.',
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: [
        { id: 'c2a7e5d1-9f3b-4a6c-8e1d-5b7f0a2c3e94', name: 'Hoodies', slug: 'hoodies' },
        { id: 'e4b9a1c3-5d7f-4e2a-9b6c-8d0e2f4a6b1c', name: 'T-shirts', slug: 't-shirts' },
      ],
    },
    successStatus: 200,
    notes: [...STORE_READ_NOTES],
  },
  {
    api: 'store',
    method: 'GET',
    path: '/locales',
    description: 'Lists the languages the shop sells in, each with its currency. Pass a `code` as `?locale=` on product reads.',
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: [
        { code: 'en', name: 'English', isDefault: true, fallback: null, currency: 'GBP' },
        { code: 'uk', name: 'Українська', isDefault: false, fallback: 'en', currency: 'UAH' },
      ],
      meta: { currency: 'GBP' },
    },
    successStatus: 200,
    notes: [...STORE_READ_NOTES, 'A language with no currency of its own shows the workspace’s; `meta.currency` is the workspace’s currency.'],
  },
  // UNCERTAIN: whether `itemsTotal` and `tax` are VAT-inclusive depends on the workspace's trading settings
  // (settleOrderLines in src/lib/order-pricing.ts was not traced); the example figures assume prices include VAT.
  {
    api: 'store',
    method: 'POST',
    path: '/orders/quote',
    description:
      'Prices a basket exactly as the order will be — catalogue prices, the promo code, VAT and delivery — and records nothing. Show the shopper `total`, charge it, then send it as the order’s `expectedTotal`.',
    pathParams: [],
    queryParams: [],
    bodyFields: [
      ...ITEM_FIELDS,
      ...FULFILMENT_FIELDS,
      ...BASKET_EXTRAS,
      { name: 'customerEmail', type: 'string', required: false, description: 'The shopper’s email, when known, so a once-per-customer or first-order promo code can be checked.' },
    ],
    exampleBody: {
      items: [{ variantId: '3d7e9b1a-6c4f-4e2d-b8a5-9f0c1e2d3a4b', quantity: 2 }],
      fulfilment: { type: 'shipping', method: 'Royal Mail Tracked 48', fee: '4.95', address: EXAMPLE_ADDRESS },
      promoCode: 'AUTUMN20',
      customerEmail: 'amelia.hart@example.co.uk',
    },
    exampleResponse: {
      data: {
        currency: 'GBP',
        items: [
          {
            productId: '8f1c2a4e-3b6d-4c1e-9a7f-2d5b8e0c4a13',
            variantId: '3d7e9b1a-6c4f-4e2d-b8a5-9f0c1e2d3a4b',
            sku: 'HOOD-BLK-M',
            name: 'Oversized Hoodie — M / Black',
            quantity: 2,
            unitPrice: '48.00',
            listPrice: '60.00',
            subtotal: '76.80',
            adjustments: [
              { kind: 'markdown', label: 'Markdown', amount: '24.00' },
              { kind: 'discount', label: 'Autumn 20% off', amount: '19.20' },
            ],
          },
        ],
        itemsTotal: '76.80',
        deliveryFee: '4.95',
        discount: '19.20',
        tax: '12.80',
        total: '81.75',
        promo: { code: 'AUTUMN20', valid: true, summary: '20% off', discount: '19.20' },
      },
    },
    successStatus: 200,
    notes: [
      SECRET_ONLY,
      'Scope `orders:write`. The key must have a selling location (Settings → Developers), or the answer is 409 `location_not_configured`.',
      'A promo code that cannot be used comes back as `promo: { code, valid: false, reason }` and the basket is priced without it. A code is only reserved when the order is placed, so it can still run out in between.',
      'An unknown product or size, or a sized product without its size, is a 400. A line not for sale is 409 `unavailable`; a line with no price in `currency` is 409 `price_unavailable`.',
    ],
  },
  // Checked 2026-10-28: a new order is inserted with status 'pending' and paymentStatus taken from the request's
  // payment (ordering-contract.ts), so a paid checkout reads 'paid'. Rate limits live in lib/marketing/developers.ts.
  {
    api: 'store',
    method: 'POST',
    path: '/orders',
    description:
      'Records a checkout from your website. DUMA prices it from the products you name, matches or creates the customer by email, keeps the address and takes the stock off at once.',
    pathParams: [],
    queryParams: [],
    bodyFields: [
      { name: 'externalReference', type: 'string', required: true, description: 'Your own order number, up to 120 characters. Sending it again returns the same order.' },
      { name: 'customer', type: 'object', required: true, description: 'The shopper. Matched to an existing customer by email, or created.' },
      { name: 'customer.email', type: 'string', required: true, description: 'Lower-cased for you. Up to 255 characters.' },
      { name: 'customer.firstName', type: 'string', required: true, description: 'Up to 100 characters.' },
      { name: 'customer.lastName', type: 'string', required: false, description: 'Up to 100 characters.', default: '""' },
      { name: 'customer.phone', type: 'string', required: false, description: 'Up to 30 characters.' },
      { name: 'customer.marketingOptIn', type: 'boolean', required: false, description: 'The shopper ticked “email me news and offers” at checkout.', default: 'false' },
      ...ITEM_FIELDS,
      ...FULFILMENT_FIELDS,
      { name: 'payment', type: 'object', required: true, description: 'Who took the money, and whether it has been taken.' },
      { name: 'payment.provider', type: 'string', required: true, description: 'Who took the money, e.g. "stripe", "paypal". Up to 50 characters.' },
      { name: 'payment.reference', type: 'string', required: false, description: 'Their reference for it — a payment intent or charge id.' },
      { name: 'payment.method', type: 'string', required: false, description: 'Up to 50 characters.', default: '"card"' },
      {
        name: 'payment.status',
        type: 'string',
        required: false,
        description: '`paid`: your website took the money. `pending`: not paid yet (e.g. a bank transfer staff will check). `claimed`: the shopper says they have paid.',
        values: ['paid', 'pending', 'claimed'],
        default: 'paid',
      },
      { name: 'payment.expiresInMinutes', type: 'number', required: false, description: 'How long a `pending` order holds its stock and promo code unclaimed, 5–10080 minutes.', default: '60' },
      ...BASKET_EXTRAS,
      { name: 'expectedTotal', type: 'string', required: false, description: 'What your website charged, items plus delivery, as a decimal string. If DUMA’s total differs, nothing is recorded.' },
      { name: 'notes', type: 'string', required: false, description: 'Up to 1000 characters.' },
    ],
    exampleBody: {
      externalReference: 'WEB-10482',
      customer: { email: 'amelia.hart@example.co.uk', firstName: 'Amelia', lastName: 'Hart', phone: '07700 900123', marketingOptIn: true },
      items: [{ variantId: '3d7e9b1a-6c4f-4e2d-b8a5-9f0c1e2d3a4b', quantity: 2 }],
      fulfilment: { type: 'shipping', method: 'Royal Mail Tracked 48', fee: '4.95', address: EXAMPLE_ADDRESS },
      payment: { provider: 'stripe', reference: 'pi_3PqR8sLkdIwHu7ix0abc1234', method: 'card', status: 'paid' },
      expectedTotal: '100.95',
    },
    exampleResponse: { data: EXAMPLE_ORDER },
    successStatus: 201,
    notes: [
      SECRET_ONLY,
      'Scope `orders:write`. The key must have a selling location (Settings → Developers), or the answer is 409 `location_not_configured`.',
      'Idempotent by `externalReference`: the same reference with the same shopper and lines returns the original order with status 200 and `replayed: true`; with a different basket it is 409 `idempotency_conflict`.',
      'A size that has run out fails the whole order with 409 `out_of_stock` and an `items` list of what was short. Nothing is recorded.',
      'If `expectedTotal` disagrees with DUMA’s total the answer is 409 `total_mismatch`, carrying `total`, `items`, `deliveryFee` and `discount`.',
      'A `pending` order holds its stock and promo code until `expiresAt`; unclaimed by then, it expires and gives both back.',
      'A promo code that cannot be used is a 400 `promo_invalid`; one used up as the order was placed is 409 `promo_unavailable`.',
    ],
  },
  {
    api: 'store',
    method: 'POST',
    path: '/referral-code',
    description:
      'Returns a signed-in shopper’s own refer-a-friend code, issuing it the first time, for an “invite a friend” page.',
    pathParams: [],
    queryParams: [],
    bodyFields: [{ name: 'email', type: 'string', required: true, description: 'The customer’s email. Lower-cased for you. Up to 255 characters.' }],
    exampleBody: { email: 'amelia.hart@example.co.uk' },
    exampleResponse: { data: { code: 'AMELIA7K' } },
    successStatus: 200,
    notes: [
      SECRET_ONLY,
      'Scope `customers:write`, and the referrals module must be on.',
      'The customer must already exist (they have ordered or signed up): otherwise 404 `customer_not_found`.',
      '409 `referrals_unavailable` when the programme is paused or not set up.',
    ],
  },
  {
    api: 'store',
    method: 'POST',
    path: '/newsletter',
    description:
      'Signs someone up to the newsletter. The subscriber is a customer, matched by email or created with just an email, who has opted in to marketing email.',
    pathParams: [],
    queryParams: [],
    bodyFields: [
      { name: 'email', type: 'string', required: true, description: 'Lower-cased for you. Up to 255 characters.' },
      { name: 'firstName', type: 'string', required: false, description: 'Up to 100 characters.' },
      { name: 'lastName', type: 'string', required: false, description: 'Up to 100 characters.' },
    ],
    exampleBody: { email: 'amelia.hart@example.co.uk', firstName: 'Amelia', lastName: 'Hart' },
    exampleResponse: { data: { status: 'subscribed', alreadySubscribed: false } },
    successStatus: 200,
    notes: [
      SECRET_ONLY,
      'Scope `newsletter:write`.',
      'Signing up again after unsubscribing opts the address back in. `alreadySubscribed` is true when they were already opted in.',
    ],
  },
  {
    api: 'store',
    method: 'POST',
    path: '/newsletter/unsubscribe',
    description:
      'Takes an address off the newsletter, for your site’s own preferences page. Emails DUMA sends carry their own unsubscribe link.',
    pathParams: [],
    queryParams: [],
    bodyFields: [{ name: 'email', type: 'string', required: true, description: 'Lower-cased for you. Up to 255 characters.' }],
    exampleBody: { email: 'amelia.hart@example.co.uk' },
    exampleResponse: { data: { status: 'unsubscribed' } },
    successStatus: 200,
    notes: [
      SECRET_ONLY,
      'Scope `newsletter:write`.',
      'The answer is the same whether or not the address is known, so it never reveals who is a customer.',
      'The address is added to the suppression list, so no automation emails it again.',
    ],
  },

  // ── Content API ──
  {
    api: 'content',
    method: 'GET',
    path: '/content-types',
    description: 'Lists the content types this key can read, with their public field definitions. Private fields are left out.',
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: [
        {
          key: 'blog-post',
          name: 'Blog post',
          description: 'News from the café',
          kind: 'collection',
          titleField: 'title',
          schemaVersion: 3,
          fields: EXAMPLE_CONTENT_TYPE_FIELDS,
          updatedAt: '2026-10-12T16:30:00.000Z',
        },
      ],
    },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES, 'A key limited to some content types sees only those.'],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/content-types/{typeKey}',
    description: 'Returns one content type’s schema: its kind, title field and public field definitions.',
    pathParams: [{ name: 'typeKey', type: 'string', required: true, description: 'The content type’s key, e.g. `blog-post`.' }],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: {
        key: 'blog-post',
        name: 'Blog post',
        description: 'News from the café',
        kind: 'collection',
        titleField: 'title',
        schemaVersion: 3,
        fields: EXAMPLE_CONTENT_TYPE_FIELDS,
        updatedAt: '2026-10-12T16:30:00.000Z',
      },
    },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES, 'A type that does not exist, or that the key may not read, is a 404.'],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/locales',
    description: 'Lists the workspace’s content locales and the fallback each one uses.',
    pathParams: [],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: [
        { code: 'en', name: 'English', isDefault: true, fallbackCode: null },
        { code: 'fr', name: 'Français', isDefault: false, fallbackCode: 'en' },
      ],
    },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/entries/{typeKey}',
    description:
      'Returns a page of a collection’s published entries, with filtering, sorting, full-text search and linked media and entries resolved.',
    pathParams: [{ name: 'typeKey', type: 'string', required: true, description: 'The content type’s key.' }],
    queryParams: [
      {
        name: 'filter[field][op]',
        type: 'string',
        required: false,
        description:
          'Filter on a field, e.g. `filter[category][eq]=news`. `in` and `nin` take comma-separated values. The system fields id, slug, createdAt, updatedAt and publishedAt can be filtered too; group fields use dots (`filter[seo.title]`). At most 20 filters.',
        values: ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'nin', 'contains', 'startsWith', 'exists'],
        default: 'eq',
      },
      { name: 'sort', type: 'string', required: false, description: 'Up to three comma-separated fields; prefix `-` for descending, e.g. `-publishedAt,title`.', default: '-publishedAt' },
      { name: 'limit', type: 'number', required: false, description: 'Entries per page, up to 100.', default: '25' },
      { name: 'page', type: 'number', required: false, description: 'The page to return, from 1. Use `page` or `offset`, not both.', default: '1' },
      { name: 'offset', type: 'number', required: false, description: 'Entries to skip, instead of `page`.' },
      { name: 'q', type: 'string', required: false, description: 'Full-text search, up to 200 characters.' },
      ...ENTRY_READ_QUERY,
    ],
    bodyFields: [],
    exampleResponse: { data: [EXAMPLE_ENTRY], meta: { total: 14, limit: 25, offset: 0, page: 1, pages: 1, locale: 'en' } },
    successStatus: 200,
    notes: [
      ...CONTENT_READ_NOTES,
      'An invalid filter, sort or parameter is a 400 with code `invalid_filter`.',
      '`id` is the document id, the same in every locale; `locale` says which language was served.',
      'Draft responses (`status=draft`) are sent with `Cache-Control: no-store`.',
    ],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/entries/{typeKey}/{idOrSlug}',
    description: 'Returns one published entry by its document id or slug.',
    pathParams: [
      { name: 'typeKey', type: 'string', required: true, description: 'The content type’s key.' },
      { name: 'idOrSlug', type: 'string', required: true, description: 'The entry’s document id (a UUID) or its slug.' },
    ],
    queryParams: [...ENTRY_READ_QUERY],
    bodyFields: [],
    exampleResponse: { data: EXAMPLE_ENTRY },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES, 'An entry that does not exist or is not published is a 404.'],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/singletons/{typeKey}',
    description: 'Returns a singleton content type’s one entry, such as a site’s footer or opening hours.',
    pathParams: [{ name: 'typeKey', type: 'string', required: true, description: 'The singleton content type’s key.' }],
    queryParams: [...ENTRY_READ_QUERY],
    bodyFields: [],
    exampleResponse: {
      data: {
        id: '2b4d6f8a-0c1e-4a3b-9d5f-7e9a1c3b5d7f',
        type: 'opening-hours',
        locale: 'en',
        slug: null,
        createdAt: '2026-09-04T08:00:00.000Z',
        updatedAt: '2026-10-25T17:20:00.000Z',
        publishedAt: '2026-10-25T17:21:00.000Z',
        firstPublishedAt: '2026-09-04T08:10:00.000Z',
        fields: { weekdays: '7:30am – 5pm', weekends: '8:30am – 4pm', note: 'Closed on Boxing Day' },
      },
    },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES, 'A type that is not a singleton, or one that has not been published, is a 404.'],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/assets/{id}',
    description: 'Returns one media file’s metadata: its URL, dimensions, alt text, focal point and smaller copies for `srcset`.',
    pathParams: [{ name: 'id', type: 'string (uuid)', required: true, description: 'The asset’s id.' }],
    queryParams: [],
    bodyFields: [],
    exampleResponse: {
      data: {
        id: '7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f',
        fileName: 'pumpkin-latte.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 412883,
        width: 1600,
        height: 1067,
        title: 'Pumpkin spice latte',
        altText: 'A pumpkin spice latte on an oak table',
        folder: 'menu',
        tags: ['autumn', 'drinks'],
        createdAt: '2026-09-28T11:04:00.000Z',
        updatedAt: '2026-09-28T11:06:00.000Z',
        url: 'https://api.duma-business.com/v1/cms/delivery/assets/7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f/file/pumpkin-latte.jpg',
        focalPoint: { x: 0.5, y: 0.45 },
        renditions: [
          {
            width: 640,
            height: 427,
            mimeType: 'image/webp',
            sizeBytes: 38120,
            url: 'https://api.duma-business.com/v1/cms/delivery/assets/7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f/renditions/b3c5d7e9-1f2a-4b4c-8d6e-0f1a3b5c7d9e',
          },
        ],
        srcset:
          'https://api.duma-business.com/v1/cms/delivery/assets/7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f/renditions/b3c5d7e9-1f2a-4b4c-8d6e-0f1a3b5c7d9e 640w, https://api.duma-business.com/v1/cms/delivery/assets/7d1f3b5a-9c2e-4a6b-8d0f-1e3a5c7b9d2f/file/pumpkin-latte.jpg 1600w',
      },
    },
    successStatus: 200,
    notes: [...CONTENT_READ_NOTES, '`focalPoint` is 0–1 from the left and top, or null. `srcset` is null when there are no smaller copies.'],
  },
  // UNCERTAIN: the response is binary, so `exampleResponse` is a placeholder string rather than JSON.
  {
    api: 'content',
    method: 'GET',
    path: '/assets/{id}/file/{name}',
    description: 'Serves the file itself, for an `<img src>` or video source. It needs no key, because a browser cannot attach a header to an image request.',
    pathParams: [
      { name: 'id', type: 'string (uuid)', required: true, description: 'The asset’s id.' },
      { name: 'name', type: 'string', required: false, description: 'The file name. Optional and only for readable URLs; the id selects the file.' },
    ],
    queryParams: [],
    bodyFields: [],
    exampleResponse: '(the file’s bytes, sent with its own Content-Type, e.g. image/jpeg)',
    successStatus: 200,
    notes: [
      'Keyless and public.',
      'Sent with `Cache-Control: public, max-age=31536000, immutable` — a file never changes under the same id.',
      'A file kept in a public storage bucket answers `302` with an absolute `Location` to that bucket’s URL.',
      'SVG files are served with a sandboxing `Content-Security-Policy`.',
      'A 404 when the asset does not exist, or when the workspace keeps unpublished media private and no published entry uses it.',
    ],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/sync',
    description:
      'Returns what changed since a moment, for mirroring content into a static site without a full rebuild: entries published or republished, and what stopped being delivered.',
    pathParams: [],
    queryParams: [
      { name: 'since', type: 'string', required: false, description: 'An ISO 8601 timestamp — the `nextSince` from your last call. Omit it for everything published.' },
      { name: 'limit', type: 'number', required: false, description: 'Entries per call, 1–200.', default: '100' },
    ],
    bodyFields: [],
    exampleResponse: {
      entries: [EXAMPLE_ENTRY],
      deletions: [{ kind: 'entry', id: '9e1a3c5b-7d2f-4b6a-8c0e-2f4a6b8d0c1e', type: 'blog-post', locale: 'en', deletedAt: '2026-10-21T09:00:00.000Z' }],
      nextSince: '2026-10-28T10:00:00.000Z',
      hasMore: false,
    },
    successStatus: 200,
    notes: [
      ...CONTENT_READ_NOTES,
      'Apply `deletions` first, then upsert `entries`; store `nextSince` and pass it as `since` next time. When `hasMore` is true, call again at once.',
      'Both lists are oldest first. A deletion is an unpublished or deleted entry (`kind: "entry"`) or a deleted asset (`kind: "asset"`).',
      'Entries are the published versions only, without media or references resolved.',
      'An unparseable `since` is a 400.',
    ],
  },
  {
    api: 'content',
    method: 'GET',
    path: '/preview/{token}',
    description:
      'Returns one draft entry for a shared preview link. The token comes from a “Preview on site” link (`?duma_preview=`), names one entry and expires.',
    pathParams: [{ name: 'token', type: 'string', required: true, description: 'The signed preview token from the link.' }],
    queryParams: [{ name: 'include', type: 'number', required: false, description: 'How many levels of media and reference fields to resolve, 0–2.', default: '1' }],
    bodyFields: [],
    exampleResponse: {
      data: {
        id: '4a8c2e6f-1b3d-4f5a-9c7e-2d4f6a8b0c1e',
        type: 'blog-post',
        locale: 'en',
        slug: 'winter-menu-sneak-peek',
        createdAt: '2026-10-27T15:00:00.000Z',
        updatedAt: '2026-10-28T09:12:00.000Z',
        publishedAt: null,
        firstPublishedAt: null,
        fields: { title: 'A sneak peek at our winter menu', slug: 'winter-menu-sneak-peek', body: '<p>Mulled apple, gingerbread lattes…</p>' },
        status: 'draft',
        version: 2,
      },
      preview: { expiresAt: '2026-10-29T09:12:00.000Z' },
    },
    successStatus: 200,
    notes: [
      'Keyless — the token carries its own authority, so a site page can call it from the browser.',
      'An invalid or expired link is a 401.',
      'Sent with `Cache-Control: no-store` and `X-Robots-Tag: noindex`.',
    ],
  },

  // ── Content Management API ──
  {
    api: 'manage',
    method: 'POST',
    path: '/content-types',
    description: 'Creates a content model with its fields. The body is the same one the DUMA admin sends.',
    pathParams: [],
    queryParams: [],
    bodyFields: [
      { name: 'key', type: 'string', required: true, description: 'Lowercase letters, numbers, `-` and `_`, starting with a letter; up to 64 characters and unique in the workspace.' },
      { name: 'name', type: 'string', required: true, description: 'Up to 120 characters.' },
      { name: 'description', type: 'string', required: false, description: 'Up to 1000 characters.' },
      { name: 'kind', type: 'string', required: false, description: '`collection` holds many entries; `singleton` exactly one.', values: ['collection', 'singleton'], default: 'collection' },
      { name: 'fields', type: 'array', required: false, description: 'Field definitions, up to 100.', default: '[]' },
      { name: 'fields[].key', type: 'string', required: true, description: 'Letters, numbers and underscores, starting with a letter; up to 64 characters. Keys the delivery API uses (id, type, locale, fields…) are reserved.' },
      { name: 'fields[].label', type: 'string', required: true, description: 'Up to 120 characters.' },
      { name: 'fields[].type', type: 'string', required: true, description: 'The kind of value the field holds.', values: FIELD_TYPES },
      { name: 'fields[].description', type: 'string', required: false, description: 'Help text, up to 500 characters.' },
      { name: 'fields[].required', type: 'boolean', required: false, description: 'Enforced when an entry is published.' },
      { name: 'fields[].unique', type: 'boolean', required: false, description: 'Text, slug, email, URL and number fields only; not inside a group.' },
      { name: 'fields[].private', type: 'boolean', required: false, description: 'Never sent by the delivery API.' },
      { name: 'fields[].multiple', type: 'boolean', required: false, description: 'Holds a list. Select, media, reference and group fields only.' },
      { name: 'fields[].shared', type: 'boolean', required: false, description: 'One value in every language. Top-level fields only; not unique fields or slugs.' },
      { name: 'fields[].minLength', type: 'number', required: false, description: 'Minimum length of a text value.' },
      { name: 'fields[].maxLength', type: 'number', required: false, description: 'Maximum length of a text value.' },
      { name: 'fields[].min', type: 'number', required: false, description: 'Smallest number allowed.' },
      { name: 'fields[].max', type: 'number', required: false, description: 'Largest number allowed.' },
      { name: 'fields[].integer', type: 'boolean', required: false, description: 'Whole numbers only.' },
      { name: 'fields[].pattern', type: 'string', required: false, description: 'A regular expression the value must match, up to 200 characters.' },
      { name: 'fields[].patternMessage', type: 'string', required: false, description: 'The message shown when `pattern` does not match.' },
      { name: 'fields[].minItems', type: 'number', required: false, description: 'Fewest items in a list field.' },
      { name: 'fields[].maxItems', type: 'number', required: false, description: 'Most items in a list field.' },
      { name: 'fields[].options', type: 'array', required: false, description: 'The choices of a select field, up to 200.' },
      { name: 'fields[].referenceTypes', type: 'array', required: false, description: 'Content type keys a reference field may point at. They must exist.' },
      { name: 'fields[].mediaGroups', type: 'array', required: false, description: 'The kinds of media a media field accepts.', values: ['image', 'video', 'audio', 'document'] },
      { name: 'fields[].slugSource', type: 'string', required: false, description: 'For a slug field, the field it is generated from.' },
      { name: 'fields[].fields', type: 'array', required: false, description: 'For a group field, its own field definitions. Groups nest at most two deep.' },
      { name: 'fields[].defaultValue', type: 'any', required: false, description: 'The value a new entry starts with. Not sent by the delivery API.' },
      { name: 'titleField', type: 'string', required: false, description: 'The key of a single text-like field that names each entry.' },
      { name: 'previewUrl', type: 'string', required: false, description: 'A URL on your site for previewing drafts, up to 500 characters.' },
    ],
    exampleBody: {
      key: 'blog-post',
      name: 'Blog post',
      description: 'News from the café',
      kind: 'collection',
      fields: EXAMPLE_CONTENT_TYPE_FIELDS,
      titleField: 'title',
      previewUrl: 'https://www.oakandember.co.uk/blog/preview',
    },
    exampleResponse: {
      data: {
        id: '1f3a5c7e-9b2d-4f6a-8c0e-3d5f7a9b1c2e',
        key: 'blog-post',
        name: 'Blog post',
        description: 'News from the café',
        kind: 'collection',
        titleField: 'title',
        previewUrl: 'https://www.oakandember.co.uk/blog/preview',
        schemaVersion: 1,
        fields: EXAMPLE_CONTENT_TYPE_FIELDS,
        createdAt: '2026-10-28T10:30:00.000Z',
        updatedAt: '2026-10-28T10:30:00.000Z',
      },
    },
    successStatus: 201,
    notes: [
      ...MANAGE_NOTES,
      'Scope `content:models`. A key limited to some content types cannot create new ones: 403.',
      'The response’s `fields` includes private fields.',
      'A body that fails validation is a 400; invalid field definitions are a 422 with `issues: [{ field, message }]`; a `key` already in use is a 409 `conflict`.',
    ],
  },
  // UNCERTAIN: `version` on a new draft is assumed to be 1 (the first cms_entry_versions row is version 1; the
  // cms_entries column default was not checked). How `slug` is derived (entrySlug in cms-authoring.ts) was not traced.
  {
    api: 'manage',
    method: 'POST',
    path: '/entries/{typeKey}',
    description:
      'Creates an entry as a draft. It is never published by the key — a person reviews and publishes it in DUMA, and there is no edit, publish or delete endpoint for keys.',
    pathParams: [{ name: 'typeKey', type: 'string', required: true, description: 'The content type’s key. Read its fields with GET /v1/cms/delivery/content-types/{typeKey}.' }],
    queryParams: [],
    bodyFields: [
      { name: 'data', type: 'object', required: true, description: 'The field values, keyed by field key. Drafts may be incomplete, but every value given must be valid for its field.' },
      { name: 'locale', type: 'string', required: false, description: 'A configured locale code, up to 16 characters. Defaults to the workspace’s default locale.' },
      { name: 'documentId', type: 'string (uuid)', required: false, description: 'Adds this locale to an existing entry of the same type instead of starting a new one.' },
    ],
    exampleBody: {
      locale: 'en',
      data: { title: 'A sneak peek at our winter menu', slug: 'winter-menu-sneak-peek', body: '<p>Mulled apple, gingerbread lattes…</p>' },
    },
    exampleResponse: {
      data: {
        id: '5c7e9a1b-3d4f-4a6b-8c0d-2e4f6a8b0c1d',
        documentId: '4a8c2e6f-1b3d-4f5a-9c7e-2d4f6a8b0c1e',
        type: 'blog-post',
        locale: 'en',
        status: 'draft',
        version: 1,
        slug: 'winter-menu-sneak-peek',
        data: { title: 'A sneak peek at our winter menu', slug: 'winter-menu-sneak-peek', body: '<p>Mulled apple, gingerbread lattes…</p>' },
      },
    },
    successStatus: 201,
    notes: [
      ...MANAGE_NOTES,
      'Scope `content:write`. A type outside the key’s content type limit is a 404; a type that limits editing to certain roles is a 403.',
      'Links must point at existing entries and assets, and slugs and unique fields must not clash. Invalid data is a 422 with `issues: [{ field, message }]`.',
      'A 409 when the singleton already has its entry, the document already has that locale, or the slug is in use. An unconfigured `locale` is a 400.',
      '`id` is this locale’s entry; `documentId` is shared by every locale of the same entry, and is the `id` the Content API returns.',
    ],
  },
];
