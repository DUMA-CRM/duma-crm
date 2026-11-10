// DUMA vs Shopify. Facts read on Shopify's UK website; the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const SHOPIFY_PRICING = 'https://www.shopify.com/uk/pricing';
const SHOPIFY_POS_PRICING = 'https://www.shopify.com/uk/pos/pricing';
const SHOPIFY_OFFLINE = 'https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline';
const SHOPIFY_EMAIL = 'https://www.shopify.com/uk/email-marketing';
const SHOPIFY_LOYALTY = 'https://www.shopify.com/uk/blog/pos-loyalty-program';
const SHOPIFY_POS_FEATURES = 'https://www.shopify.com/uk/pos/features';

export const DUMA_VS_SHOPIFY: Comparison = {
  slug: 'duma-vs-shopify',
  path: '/compare/duma-vs-shopify',
  competitor: 'Shopify',
  breadcrumb: 'DUMA vs Shopify',
  metaTitle: 'Shopify POS Alternative UK: DUMA vs Shopify | DUMA',
  description:
    'Keep your Shopify store. DUMA adds a free offline till for your shop and pop-ups, plus rotas, customers and loyalty. Shopify prices as of November 2026.',
  checked: '2026-11-02',
  asOf: 'November 2026',
  hero: {
    lead: 'DUMA vs Shopify:',
    mark: 'keep your storefront',
    subtitle:
      'Shopify is the place to run an online store, and DUMA does not replace it. DUMA is for the parts around the shop window: a till for your shop or pop-ups, rotas, customers, loyalty, email and reports, in one place.',
    ticks: ['Keep your Shopify store', 'Free plan, forever', 'Till works offline'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Keep Shopify for your online store. Its storefront, checkout, themes and app store are mature, and DUMA has no hosted online store today (one is planned for later).',
      'Look at DUMA if you sell in person too and are weighing up POS Pro, or if the apps around your store (loyalty, forms, rotas) keep adding to the bill. Be clear about one thing first: DUMA has no Shopify connector yet, so stock does not sync between the two by itself.',
    ],
  },
  table: {
    title: 'DUMA and Shopify, side by side',
    rows: [
      {
        job: 'Monthly price',
        duma: 'Free plan, forever, with no card needed. Business is £49 a month, coming soon.',
        them: 'Basic £25, Grow £65, Advanced £344 a month paid monthly (£19, £49, £259 paid yearly). Plus from £1,800 a month.',
        source: SHOPIFY_PRICING,
      },
      {
        job: 'Online store and checkout',
        duma: 'No hosted online store yet; one is planned. A storefront API lets a custom-built site use DUMA’s products, stock and orders.',
        them: 'A full online store with themes, checkout and Shopify Payments.',
        source: SHOPIFY_PRICING,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'In-person till',
        duma: 'Included and free in full, on any tablet, phone or laptop you already own.',
        them: 'Every plan includes casual in-person selling for limited staff. POS Pro is £69 a month per location, billed yearly.',
        source: SHOPIFY_POS_PRICING,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Card fees',
        duma: 'DUMA does not process cards. Keep your card machine: Square, SumUp and Stripe connect directly, and any other works with the amount keyed in.',
        them: 'In person from 1.5% to 1.7% by plan with Shopify Payments. Online from 1.3% + 25p to 2% + 25p.',
        source: SHOPIFY_PRICING,
      },
      {
        job: 'When the internet drops',
        duma: 'Cash and card-machine sales save on the till and send themselves when the connection returns. Nothing queued is thrown away.',
        them: 'Cash and manual payments offline for all POS users. Offline card payments can be switched on in admin.',
        source: SHOPIFY_OFFLINE,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Stock by size and colour',
        duma: 'Every size and colour has its own stock, per location, taken off by every till sale.',
        them: 'Inventory counts and low-stock alerts for the shop come with POS Pro.',
        source: SHOPIFY_POS_PRICING,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Staff rotas',
        duma: 'Included and free in full: rotas, clock-ins on phones, leave requests, labour next to sales.',
        them: 'Not listed on Shopify’s POS features page; rota apps come from the Shopify App Store.',
        source: SHOPIFY_POS_FEATURES,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Loyalty',
        duma: 'Included: stamp cards and points, recognised at the till by the customer’s QR code.',
        them: 'Shopify’s own UK blog says Shopify POS doesn’t have built-in loyalty tools and points to apps.',
        source: SHOPIFY_LOYALTY,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Email marketing',
        duma: 'Included, with a free allowance, sent only to customers who opted in.',
        them: 'Up to 10,000 emails a month free, then charged per 1,000.',
        source: SHOPIFY_EMAIL,
        marks: { duma: 'yes', them: 'yes' },
      },
    ],
  },
  pricing: {
    title: 'What Shopify costs',
    facts: [
      {
        text: 'Online card rates with Shopify Payments: 2% + 25p (Basic), 1.7% + 25p (Grow), 1.5% + 25p (Advanced), 1.3% + 25p (Plus).',
        source: SHOPIFY_PRICING,
      },
      { text: 'In-person card rates: 1.7% (Basic), 1.6% (Grow), 1.5% (Advanced and Plus).', source: SHOPIFY_PRICING },
      { text: 'Using a payment provider other than Shopify Payments adds a fee of 2%, 1%, 0.6% or 0.2% by plan.', source: SHOPIFY_PRICING },
    ],
    bill: {
      title: 'A shop on Shopify, selling in person',
      lines: [
        { label: 'Shopify Basic plan, paid monthly', pounds: 25, source: SHOPIFY_PRICING },
        { label: 'POS Pro, per location, billed yearly', pounds: 69, source: SHOPIFY_POS_PRICING },
      ],
      note: 'Each month, before card fees and hardware, whose prices Shopify doesn’t publish. Loyalty and rota apps from the Shopify App Store cost extra. Selling online too? Keep your Shopify plan for the store: DUMA doesn’t replace it.',
    },
    dumaBill: {
      title: 'The in-person side on DUMA',
      note: 'The till, stock by size and colour, rotas and loyalty on the free plan.',
    },
  },
  stronger: {
    title: 'Where Shopify is stronger',
    intro: 'For selling online, Shopify is the more complete product, and we would not ask you to leave it.',
    items: [
      {
        title: 'The online store itself',
        icon: 'store',
        them: 'Themes, checkout, payments, shipping and a store you can launch without a developer.',
        duma: 'DUMA has no hosted storefront today.',
      },
      {
        title: 'A huge app store',
        icon: 'apps',
        them: 'Whatever you need, someone has usually built an app for it.',
        duma: 'DUMA covers fewer things, in one place, and adds integrations on request.',
      },
      {
        title: 'Stock synced online and in store',
        icon: 'sync',
        them: 'Shopify keeps online and POS stock in one place.',
        duma: 'DUMA does not sync with Shopify yet, so if you sell in both, one of them has to be the stock record.',
      },
      {
        title: 'Payments in one account',
        icon: 'payments',
        them: 'Shopify Payments takes card payments online and in person.',
        duma: 'DUMA works with your existing card machine instead of processing payments.',
      },
      {
        title: 'Scale',
        icon: 'scale',
        them: 'Shopify runs very large stores.',
        duma: 'DUMA is new, built for small owner-run businesses, and supported by the person who builds it.',
      },
    ],
    verdict: {
      alone: 'Shopify alone is enough if you only sell online.',
      addDuma: 'Add DUMA for the till, the team and your regulars on the shop floor. Keep Shopify for the online store.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is everything that is not the online shop window.',
    items: [
      {
        title: 'A full till without a per-location add-on',
        icon: 'till',
        tone: 'orders',
        body: 'The till is free in full. It runs in a browser on any device, and keeps taking cash and card-machine sales when the Wi-Fi drops.',
      },
      {
        title: 'Fewer apps to pay for',
        icon: 'apps',
        tone: 'action',
        body: 'Loyalty, promotions, referrals, forms, email and rotas are part of the same workspace, not separate subscriptions.',
      },
      {
        title: 'Staff and the shop floor',
        icon: 'team',
        tone: 'team',
        body: 'Rotas, clock-ins on your team’s phones, leave and labour cost next to sales. Shopify’s POS features page doesn’t list rotas.',
      },
      {
        title: 'One customer list from the till',
        icon: 'customers',
        tone: 'orders',
        body: 'Every in-person sale can build the customer’s profile, earn loyalty and feed the reports.',
      },
      {
        title: 'No fee for your own card machine',
        icon: 'card',
        tone: 'stock',
        body: 'Keep the card machine you have. Square, SumUp and Stripe connect directly, and any other works with the amount keyed in.',
      },
      {
        title: 'Free setup help',
        icon: 'help',
        tone: 'team',
        body: 'We help you set up on every plan, including importing your products from Shopify’s CSV export.',
      },
    ],
  },
  together: {
    title: 'How to run DUMA alongside Shopify',
    intro: 'Keep your storefront and its checkout. Use DUMA for the till, the team and your customers.',
    steps: [
      {
        title: 'Import your products',
        body: 'Export your products from Shopify as a CSV and import it into DUMA. Sizes, colours, prices, SKUs, barcodes and stock come across, and a product is matched rather than duplicated if you import again.',
      },
      {
        title: 'Open the till for your shop or pop-up',
        body: 'Any tablet or phone will do. Connect your card machine, or key the amount into it.',
      },
      {
        title: 'Decide where stock lives',
        body: 'There is no Shopify connector yet, so pick one system as the stock record for each location. Tell us if you need a live sync — we add integrations on request — or a developer can send orders in through DUMA’s API.',
      },
      {
        title: 'Add the team and the regulars',
        body: 'Put the rota, clock-ins and loyalty in DUMA, and email the customers who opted in.',
      },
    ],
    connections: {
      sources: [
        { name: 'Shopify products', how: 'CSV export, imported', kind: 'file' },
        { name: 'Your card machine', how: 'Square, SumUp, Stripe or keyed in', kind: 'card', logo: 'SumUp' },
        { name: 'A custom-built site', how: 'Through DUMA’s API', kind: 'api' },
      ],
      updates: [
        { label: 'Stock by size', icon: 'stock' },
        { label: 'Customers', icon: 'customers' },
        { label: 'Rotas', icon: 'rotas' },
        { label: 'Loyalty', icon: 'loyalty' },
      ],
    },
  },
  faqTitle: 'Questions about DUMA and Shopify',
  faqs: [
    {
      question: 'Does DUMA replace Shopify?',
      answer:
        'No. Keep your Shopify store and its checkout. DUMA has no hosted online store today; one is planned for later. DUMA runs the parts around it: a till for in-person sales, rotas, customers, loyalty, email and reports.',
    },
    {
      question: 'Is DUMA a Shopify POS alternative?',
      answer:
        'For in-person selling, yes. DUMA’s till is free in full and keeps working offline for cash and card-machine sales. Shopify’s POS Pro is £69 a month per location, billed yearly (as of November 2026).',
    },
    {
      question: 'Does DUMA connect to Shopify?',
      answer:
        'Not directly yet. You can import your products from Shopify’s CSV export. Orders and stock do not sync between the two on their own; tell us if you need that, because we add integrations on request.',
    },
    {
      question: 'Can I import my products from Shopify?',
      answer:
        'Yes. DUMA reads Shopify’s product export, including sizes and colours, prices, SKUs, barcodes and stock, and matches products by name and SKU so a second import does not duplicate them.',
    },
    {
      question: 'Which card machine can I use with DUMA?',
      answer:
        'The one you have. Square, SumUp and Stripe readers connect directly. Any other card machine works through the till’s Card machine method, with the amount keyed in.',
    },
    {
      question: 'How much does DUMA cost?',
      answer:
        'DUMA has a free plan forever, with no card needed. Business will be £49 a month, or £539 a year with one month free, and is coming soon.',
    },
  ],
  closing: {
    title: 'Keep your storefront.',
    muted: 'Run the shop floor on DUMA.',
  },
};
