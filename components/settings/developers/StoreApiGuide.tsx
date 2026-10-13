'use client';

import { ERRORS, ORDER_EXAMPLE, PRODUCT_EXAMPLE, QUOTE_EXAMPLE } from '@/lib/utils/storefront-docs';

import { C, CodeBlock, DocSection, DocTable, Note } from './docs-blocks';

/** The Store API's guide, after its endpoint list: in reading order, as the rail shows it. */
export const STORE_GUIDE_SECTIONS = [
  { id: 'store-products', label: 'Show products' },
  { id: 'store-orders', label: 'Record an order' },
  { id: 'store-newsletter', label: 'Newsletter & referrals' },
  { id: 'store-errors', label: 'Store errors' },
] as const;

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** What a shop's website sends and gets back. Everything is JSON; money is a decimal string. */
export function StoreApiGuide({ base }: { base: string }) {
  return (
    <>
      <DocSection
        id="store-products"
        title="Show products"
        lead="Publishable or secret key. The list takes category, q, limit and page; a product is fetched by slug or id."
      >
        <CodeBlock
          tabs={[
            { label: 'GET /products/oversized-hoodie', language: 'JSON', code: json(PRODUCT_EXAMPLE) },
            {
              label: 'JavaScript',
              language: 'fetch',
              code: `const res = await fetch(\`\${process.env.DUMA_STORE_URL}/products?limit=24\`, {\n  headers: { Authorization: \`Bearer \${process.env.DUMA_PUBLISHABLE_KEY}\` },\n});\nconst { data, meta } = await res.json();`,
            },
            {
              label: 'cURL',
              language: 'shell',
              code: `curl "${base}/products?limit=24" \\\n  -H "Authorization: Bearer $DUMA_PUBLISHABLE_KEY"`,
            },
          ]}
        />
        <Note>
          Show a size as sold out when <C>available</C> is false. A photo with an <C>option</C> belongs to that colour. Use <C>srcset</C>{' '}
          and <C>focalPoint</C> (as object-position) on images. Add <C>locale</C> for text in another language and <C>currency</C> for its
          prices — a product without a price in that currency comes back in the shop’s, so always show the <C>currency</C> it carries.
        </Note>
      </DocSection>

      <DocSection
        id="store-orders"
        title="Record an order"
        lead="Secret key, from your server. Price the basket before payment, then record the order once your checkout has taken the money."
      >
        <CodeBlock
          tabs={[
            { label: 'POST /orders/quote', language: 'JSON', code: json(QUOTE_EXAMPLE) },
            { label: 'POST /orders', language: 'JSON', code: json(ORDER_EXAMPLE) },
          ]}
        />
        <Note>
          Charge the <C>total</C> the quote returns. A promo code that can’t be used comes back with <C>valid: false</C> and a <C>reason</C>{' '}
          to show the shopper; the rest is priced without it.
        </Note>
        <Note tone="warning">
          Send products and sizes, never prices — DUMA prices every line. Sending the same <C>externalReference</C> again returns the same
          order, so a retry is safe. Stock comes off at once; a size that ran out fails the whole order with <C>409 out_of_stock</C> and
          nothing is recorded. A secret key records orders at the location it sells from — set one when you create it.
        </Note>
      </DocSection>

      <DocSection id="store-newsletter" title="Newsletter & referrals" lead="Secret key, from your server.">
        <CodeBlock
          tabs={[
            { label: 'POST /newsletter', language: 'JSON', code: json({ email: 'sam@example.com', firstName: 'Sam' }) },
            { label: 'POST /newsletter/unsubscribe', language: 'JSON', code: json({ email: 'sam@example.com' }) },
            { label: 'POST /referral-code', language: 'JSON', code: json({ email: 'sam@example.com' }) },
          ]}
        />
        <Note>
          A subscriber becomes a customer who has opted in to marketing email; emails DUMA sends carry their own unsubscribe link. A
          referral code is a signed-in shopper’s own — a friend sends it as an order’s <C>promoCode</C>. Only when the shop has refer a
          friend on; <C>409 referrals_unavailable</C> otherwise.
        </Note>
      </DocSection>

      <DocSection id="store-errors" title="Store errors" lead="Errors are JSON with an error message and a code.">
        <DocTable
          head={['Status', 'Code', 'When']}
          rows={ERRORS.map((entry) => [String(entry.status), <C key={entry.code}>{entry.code}</C>, entry.when])}
        />
      </DocSection>
    </>
  );
}
