/**
 * The words for the /compare/duma-vs-… pages, one Comparison each, rendered by
 * components/marketing/compare/ComparePage.tsx.
 *
 * Two rules, from the "DUMA Business Profile" vault note:
 *
 * 1. Every competitor fact is one we read on the competitor's own UK website,
 *    on the date in `checked`, and its row or line names the page in `source`.
 *    A fact we could not find there is left out, not guessed. Prices change:
 *    re-check each source and move `checked` when you edit a page.
 * 2. Every DUMA fact is true of the product today (the till's offline queue,
 *    recipe costing in lib/menu/costing.ts, the rota in components/scheduling,
 *    the Square and SumUp reader connections in duma-api payments.ts). Say
 *    where the competitor is stronger. Never say DUMA replaces Shopify, and
 *    never name Stripe.
 */
import type { Tone } from '@/lib/marketing/home';
import type { ListItem } from '@/lib/marketing/solutions';

export type SourcedFact = { text: string; source: string };

export type CompareVerdict = 'yes' | 'part' | 'no';

export type CompareRow = {
  job: string;
  duma: string;
  them: string;
  /** The competitor page `them` was read on. */
  source?: string;
  /**
   * The table's discs, as the text beside them says it. Left off rows where a
   * tick would be a judgment rather than a fact — prices and card fees.
   */
  marks?: { duma: CompareVerdict; them: CompareVerdict };
};

/** One line of the competitor's monthly bill, with the page its price was read on. */
export type BillLine = { label: string; pounds: number; source: string };

/** The icons the "stronger" cards can wear, mapped to components in ComparePage. */
export type StrongerIcon = 'payments' | 'hardware' | 'offline' | 'till' | 'scale' | 'store' | 'apps' | 'sync';

/** The icons the "different" cards can wear, mapped to components in ComparePage. */
export type DifferentIcon = 'bill' | 'margin' | 'team' | 'sync' | 'api' | 'help' | 'till' | 'apps' | 'customers' | 'card';

/**
 * What the "use both" diagram shows: the tools on the left, beaming into DUMA,
 * and what a sale in DUMA updates on the right. Only connections that exist —
 * `how` says plainly what each one is (a direct connection, a CSV import, the
 * amount keyed in).
 */
export type Connections = {
  sources: readonly { name: string; how: string; kind: 'card' | 'file' | 'api'; logo?: 'Square' | 'SumUp' }[];
  updates: readonly { label: string; icon: 'stock' | 'margin' | 'customers' | 'reports' | 'rotas' | 'loyalty' }[];
};

export type Comparison = {
  slug: string;
  path: `/compare/${string}`;
  competitor: string;
  breadcrumb: string;
  metaTitle: string;
  description: string;
  /** ISO date the competitor facts were read on their site. */
  checked: string;
  /** "November 2026" — shown on the page beside every competitor figure. */
  asOf: string;
  hero: { lead: string; mark: string; subtitle: string; ticks: [string, string, string] };
  verdict: { title: string; paragraphs: string[] };
  table: { title: string; intro: string; rows: readonly CompareRow[] };
  pricing: {
    title: string;
    intro: string;
    /** The competitor's paid parts for the business this page is about, itemised and totalled per month. */
    bill: { title: string; lines: readonly BillLine[]; note: string };
    /** What the same parts cost on DUMA, under its £0. */
    dumaBill: { title: string; note: string };
    /** Everything else on their price list, each with its source. */
    facts: readonly SourcedFact[];
    duma: readonly string[];
  };
  stronger: {
    title: string;
    intro: string;
    /** What the competitor does better (`them`), and where DUMA stands on it today (`duma`). */
    items: readonly { title: string; them: string; duma: string; icon: StrongerIcon }[];
    /** The closing card: when the competitor alone is enough, and when to add DUMA. */
    verdict: { alone: string; addDuma: string };
  };
  different: { title: string; intro: string; items: readonly (ListItem & { icon: DifferentIcon; tone: Tone })[] };
  together: { title: string; intro: string; steps: readonly ListItem[]; connections: Connections };
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  closing: { title: string; muted: string; body: string };
};

const SQUARE_PRICING = 'https://squareup.com/gb/en/pricing';
const SQUARE_RESTAURANTS = 'https://squareup.com/gb/en/point-of-sale/restaurants/pricing';
const SQUARE_RETAIL = 'https://squareup.com/gb/en/point-of-sale/retail/pricing';
const SQUARE_SHIFTS = 'https://squareup.com/gb/en/staff/shifts/pricing';
const SQUARE_LOYALTY = 'https://squareup.com/gb/en/software/loyalty';
const SQUARE_MARKETING = 'https://squareup.com/gb/en/software/marketing';
const SQUARE_OFFLINE = 'https://squareup.com/help/gb/en/article/8106-offline-payments-time-limits';

const SHOPIFY_PRICING = 'https://www.shopify.com/uk/pricing';
const SHOPIFY_POS_PRICING = 'https://www.shopify.com/uk/pos/pricing';
const SHOPIFY_OFFLINE = 'https://help.shopify.com/en/manual/sell-in-person/shopify-pos/selling-offline';
const SHOPIFY_EMAIL = 'https://www.shopify.com/uk/email-marketing';
const SHOPIFY_LOYALTY = 'https://www.shopify.com/uk/blog/pos-loyalty-program';
const SHOPIFY_POS_FEATURES = 'https://www.shopify.com/uk/pos/features';

export const DUMA_VS_SQUARE: Comparison = {
  slug: 'duma-vs-square',
  path: '/compare/duma-vs-square',
  competitor: 'Square',
  breadcrumb: 'DUMA vs Square',
  metaTitle: 'Square Alternative UK: DUMA vs Square POS | DUMA',
  description:
    'A Square alternative for UK cafés and shops: keep your Square Terminal, add stock, recipe margin, rotas and loyalty for free. Prices as of November 2026.',
  checked: '2026-11-02',
  asOf: 'November 2026',
  hero: {
    lead: 'DUMA vs Square:',
    mark: 'keep the card machine, add the rest',
    subtitle:
      'Square is a strong way to take card payments. DUMA is the system around the payment: till, stock, recipe margin, rotas, customers and reports, on one bill. Many businesses will want both, and that works.',
    ticks: ['Keep your Square Terminal', 'Free plan, forever', 'Till works offline'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Choose Square on its own if you mainly need to take card payments with good hardware, and the till, stock and staff tools in its free plan cover you. Square’s payments, devices and offline card acceptance are mature, and DUMA does not process cards at all.',
      'Look at DUMA if you are paying for add-ons on top of the till (rotas, loyalty, marketing, restaurant stock), or if you want to know the margin on every dish after VAT. DUMA includes those in one workspace, and you can keep using your Square Terminal for the card payment itself.',
    ],
  },
  table: {
    title: 'DUMA and Square, side by side',
    intro: 'Square’s figures are from its UK website and exclude VAT where Square says so. DUMA’s are from the product today.',
    rows: [
      {
        job: 'Software price',
        duma: 'Free plan, forever, with no card needed. Business is £89 a month, coming soon.',
        them: 'Free plan at £0 a month. Plus from £29 a month. Premium is custom-priced.',
        source: SQUARE_PRICING,
      },
      {
        job: 'Restaurant and retail plans',
        duma: 'One plan for every kind of business. Switch on the parts you need.',
        them: 'Square for Restaurants Plus is £69 a month per location. Square for Retail Plus is £49 a month per location.',
        source: SQUARE_RESTAURANTS,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Card fees',
        duma: 'DUMA does not process cards, so it adds no card fee. Your card provider’s own fees still apply.',
        them: '1.75% in person, 1.4% + 25p online, and 2.5% for manually entered cards (UK cards).',
        source: SQUARE_PRICING,
      },
      {
        job: 'Card hardware',
        duma: 'Keep your card machine. Square Terminal and SumUp readers connect directly. Any other machine works with the amount keyed in.',
        them: 'Its own range. Square Reader is £19 + VAT and Square Terminal is £149 + VAT.',
        source: SQUARE_PRICING,
      },
      {
        job: 'When the internet drops',
        duma: 'Cash and card-machine sales save on the till and send themselves when the connection returns. A sale that can’t be sent is kept for you to check, never thrown away.',
        them: 'Offline card payments on Square devices, within 24 to 72 hours depending on the device. Physical contactless cards are not supported offline, and the seller is responsible for declined payments.',
        source: SQUARE_OFFLINE,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Stock',
        duma: 'Included and free in full. Every sale takes its recipe’s ingredients off what is on hand.',
        them: 'For restaurants, ingredient stock is Square Restaurant Inventory by MarketMan: not included on Free, and £79 a month per location on Plus.',
        source: SQUARE_RESTAURANTS,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Recipe costing and margin',
        duma: 'Cost each dish from its ingredients and see the margin after VAT, per size and per combination of options.',
        them: 'We did not find recipe costing on Square’s UK pricing pages.',
        marks: { duma: 'yes', them: 'no' },
      },
      {
        job: 'Rotas and clock-ins',
        duma: 'Included and free in full: rotas, clock-in on the staff member’s phone, leave requests, and labour cost next to sales.',
        them: 'Shifts Free covers up to five team members, including the owner. Shifts Plus starts at £3 per team member a month.',
        source: SQUARE_SHIFTS,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Loyalty',
        duma: 'Included: stamp cards and points, applied at the till.',
        them: 'Square Loyalty is £25 a month per location for up to 500 loyalty visits, rising with use.',
        source: SQUARE_LOYALTY,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Email marketing',
        duma: 'Included, with a free allowance. Only customers who opted in are emailed.',
        them: 'Square Marketing is £9 a month for up to 500 contacts, rising with your list.',
        source: SQUARE_MARKETING,
        marks: { duma: 'yes', them: 'part' },
      },
    ],
  },
  pricing: {
    title: 'What Square costs',
    intro:
      'Read on Square’s UK website on 2 November 2026. Square changes its prices from time to time, so check the linked page before you decide.',
    facts: [
      {
        text: 'Square Point of Sale: Free at £0 a month plus processing fees; Plus from £29 a month; Premium custom-priced.',
        source: SQUARE_PRICING,
      },
      { text: 'In-person card payments with UK cards: 1.75%. Online: 1.4% + 25p. Manually entered: 2.5%.', source: SQUARE_PRICING },
      {
        text: 'Square for Restaurants Plus: £69 a month per location. Restaurant inventory by MarketMan: £79 a month per location on Plus.',
        source: SQUARE_RESTAURANTS,
      },
      { text: 'Square for Retail Plus: £49 a month per location.', source: SQUARE_RETAIL },
      { text: 'Shifts: free for up to five team members; Shifts Plus from £3 per team member a month.', source: SQUARE_SHIFTS },
      { text: 'Square Loyalty: £25, £45 or £65 a month per location, by loyalty visits.', source: SQUARE_LOYALTY },
      { text: 'Square Marketing: from £9 a month for up to 500 contacts.', source: SQUARE_MARKETING },
      { text: 'Square Reader: £19 + VAT. Square Terminal: £149 + VAT.', source: SQUARE_PRICING },
    ],
    bill: {
      title: 'A café on Square’s paid plans',
      lines: [
        { label: 'Square for Restaurants Plus', pounds: 69, source: SQUARE_RESTAURANTS },
        { label: 'Restaurant inventory by MarketMan', pounds: 79, source: SQUARE_RESTAURANTS },
        { label: 'Square Loyalty, up to 500 visits', pounds: 25, source: SQUARE_LOYALTY },
        { label: 'Square Marketing, up to 500 contacts', pounds: 9, source: SQUARE_MARKETING },
      ],
      note: 'Per location, each month, before card fees and hardware. Shifts is free for up to five team members, then from £3 each.',
    },
    dumaBill: {
      title: 'The same parts on DUMA',
      note: 'Till, stock, recipe margin, rotas and loyalty on the free plan. Email keeps a free allowance.',
    },
    duma: [
      'Free, forever, with no card needed. The till, orders, payments, products and margin, stock, customers and rotas stay free in full. Every other part keeps a free allowance.',
      'Business is £89 a month, or £80 a month paid yearly. It is coming soon, and anyone who joins before it launches keeps 10% off for life.',
      'DUMA takes no cut of your card payments. Your card provider charges its own fees, as it does today.',
    ],
  },
  stronger: {
    title: 'Where Square is stronger',
    intro: 'Square is a well-established product, and it does several things DUMA does not.',
    items: [
      {
        title: 'Payments are built in',
        icon: 'payments',
        them: 'One Square account takes card payments in person, online and by invoice.',
        duma: 'DUMA does not process payments. It works with the card machine you already have.',
      },
      {
        title: 'Its own hardware, made to work together',
        icon: 'hardware',
        them: 'Readers, terminals, stands and registers from one company, from a £19 reader.',
        duma: 'DUMA runs in a browser on the tablet, phone or laptop you already own.',
      },
      {
        title: 'Card payments offline',
        icon: 'offline',
        them: 'Square devices can take some card payments with no connection, within time limits.',
        duma: 'A connected reader needs the internet. When it drops, cash and a standalone card machine keep working.',
      },
      {
        title: 'More at the till today',
        icon: 'till',
        them: 'Gift cards, split bills, tips and dedicated receipt printers.',
        duma: 'Not in DUMA yet. It prints receipts from the browser; printer and cash drawer support is coming.',
      },
      {
        title: 'Size and track record',
        icon: 'scale',
        them: 'Square has been doing this for years, with a large help centre.',
        duma: 'DUMA is new, built and supported by one person. When you ask for something, you’re talking to the person who builds it.',
      },
    ],
    verdict: {
      alone: 'Square alone is enough if all you need is to take payments.',
      addDuma: 'Add DUMA when you want stock, recipe margin, rotas and regulars in one place. Your Square Terminal keeps working.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is the other side of the till: what a sale does to your stock, your margin, your rota and your regulars.',
    items: [
      {
        title: 'One bill instead of add-ons',
        icon: 'bill',
        tone: 'action',
        body: 'Stock, rotas, loyalty and email are part of the same workspace rather than separate monthly charges per location. Switch on only the parts you need.',
      },
      {
        title: 'Margin after VAT, on every dish',
        icon: 'margin',
        tone: 'reference',
        body: 'Add a recipe once. DUMA costs it from your ingredient prices and takes VAT out of the price if you are registered, so the margin is what you really keep.',
      },
      {
        title: 'Staff cost next to sales',
        icon: 'team',
        tone: 'team',
        body: 'The rota, the clock-ins and the takings live in one place, so the labour report shows staff cost as a share of sales without an export.',
      },
      {
        title: 'Every sale updates everything',
        icon: 'sync',
        tone: 'stock',
        body: 'A sale takes its ingredients off stock, adds to the customer’s profile and lands in the reports. Nobody re-types it.',
      },
      {
        title: 'Open by design',
        icon: 'api',
        tone: 'reference',
        body: 'A public API, an MCP server for AI assistants, API keys and webhooks. Your data is yours to use elsewhere.',
      },
      {
        title: 'Free setup help',
        icon: 'help',
        tone: 'team',
        body: 'We help every business set up, on every plan, including bringing your menu across.',
      },
    ],
  },
  together: {
    title: 'How to use DUMA with your Square Terminal',
    intro: 'You don’t need new hardware, and Square stays your card provider.',
    steps: [
      {
        title: 'Create a free DUMA workspace',
        body: 'Tell DUMA what you run, then build your menu in it, or bring it in from a spreadsheet.',
      },
      {
        title: 'Connect your Square Terminal',
        body: 'In DUMA’s card payment settings, add your Terminal’s device ID and an access token from your Square account. The DUMA till then sends the amount to the Terminal.',
      },
      {
        title: 'Or use any device as a card machine',
        body: 'A Square Reader, or any other machine, works through the till’s Card machine method: key the amount in, take the payment, and the sale is recorded in DUMA. This also works offline.',
      },
      {
        title: 'Switch on the rest when you’re ready',
        body: 'Stock, recipes, rotas and loyalty are already in the same workspace. There is nothing to move.',
      },
    ],
    connections: {
      sources: [
        { name: 'Square Terminal', how: 'Connected directly', kind: 'card', logo: 'Square' },
        { name: 'Square Reader or any machine', how: 'Amount keyed in', kind: 'card' },
        { name: 'Your menu', how: 'Imported, or built in DUMA', kind: 'file' },
      ],
      updates: [
        { label: 'Stock', icon: 'stock' },
        { label: 'Recipe margin', icon: 'margin' },
        { label: 'Customers', icon: 'customers' },
        { label: 'Reports', icon: 'reports' },
      ],
    },
  },
  faqTitle: 'Questions about DUMA and Square',
  faqs: [
    {
      question: 'Is DUMA a good Square alternative in the UK?',
      answer:
        'It depends what you use Square for. If you need card payments, DUMA works alongside Square rather than replacing it, because DUMA does not process cards. If you want stock, recipe margin, rotas, loyalty and email without paying for add-ons, DUMA includes them, and its free plan has no time limit.',
    },
    {
      question: 'Can I keep my Square card reader?',
      answer:
        'Yes. A Square Terminal connects to DUMA directly, so the till sends it the amount. A Square Reader, or any other card machine, works through the till’s Card machine method: you key the amount in and the sale is recorded in DUMA.',
    },
    {
      question: 'Will I still pay Square’s card fees?',
      answer: 'Yes. Square charges its own fees on the card payments it processes. DUMA adds no fee of its own on top.',
    },
    {
      question: 'Does DUMA work when the internet goes down?',
      answer:
        'Yes, for cash and card-machine sales. They are saved on the till and sent when the connection returns, and a sale that can’t be sent is kept for you to check rather than deleted. A connected card reader needs a connection to take payment.',
    },
    {
      question: 'Does DUMA include staff rotas, or is it extra?',
      answer:
        'Rotas and time are free in full: building and publishing the rota, clocking in from a phone, leave requests and the labour-versus-sales report.',
    },
    {
      question: 'How much does DUMA cost compared with Square?',
      answer:
        'DUMA has a free plan forever. Business will be £89 a month, or £80 a month paid yearly, and is coming soon. Square’s point of sale also has a free plan, with paid plans from £29 a month and paid add-ons such as Loyalty and Marketing (as of November 2026). Card fees are separate in both cases.',
    },
  ],
  closing: {
    title: 'Keep Square for payments.',
    muted: 'Run the rest of the business on DUMA.',
    body: 'Start free in minutes, with no card needed. We’ll help you connect your Terminal and bring your menu across.',
  },
};

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
      'Shopify is the place to run an online store, and DUMA does not replace it. DUMA is for the parts around the shop window: a till for your shop or pop-ups, rotas, customers, loyalty, email and reports, on one bill.',
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
    intro: 'Shopify’s figures are from its UK website. DUMA’s are from the product today.',
    rows: [
      {
        job: 'Monthly price',
        duma: 'Free plan, forever, with no card needed. Business is £89 a month, coming soon.',
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
        duma: 'DUMA does not process cards. Keep your card machine: Square and SumUp connect directly, and any other works with the amount keyed in.',
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
    intro:
      'Read on Shopify’s UK website on 2 November 2026. Shopify changes its prices from time to time, so check the linked page before you decide.',
    facts: [
      {
        text: 'Basic £25 a month, Grow £65, Advanced £344 when paid monthly; £19, £49 and £259 a month when paid yearly. Plus starts at £1,800 a month.',
        source: SHOPIFY_PRICING,
      },
      {
        text: 'Online card rates with Shopify Payments: 2% + 25p (Basic), 1.7% + 25p (Grow), 1.5% + 25p (Advanced), 1.3% + 25p (Plus).',
        source: SHOPIFY_PRICING,
      },
      { text: 'In-person card rates: 1.7% (Basic), 1.6% (Grow), 1.5% (Advanced and Plus).', source: SHOPIFY_PRICING },
      { text: 'Using a payment provider other than Shopify Payments adds a fee of 2%, 1%, 0.6% or 0.2% by plan.', source: SHOPIFY_PRICING },
      { text: 'POS Pro: £69 a month per location, billed yearly.', source: SHOPIFY_POS_PRICING },
      { text: 'Email: up to 10,000 emails a month free.', source: SHOPIFY_EMAIL },
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
    duma: [
      'Free, forever, with no card needed. The till, orders, payments, products, stock, customers and rotas stay free in full. Every other part keeps a free allowance.',
      'Business is £89 a month, or £80 a month paid yearly. It is coming soon, and anyone who joins before it launches keeps 10% off for life.',
      'DUMA takes no cut of your card payments, and has no extra fee for using another payment provider.',
    ],
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
        body: 'Keep the card machine you have. Square and SumUp connect directly, and any other works with the amount keyed in.',
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
        { name: 'Your card machine', how: 'Square or SumUp, or keyed in', kind: 'card', logo: 'SumUp' },
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
        'For in-person selling, yes. DUMA’s till is free in full and keeps working offline for cash and card-machine sales. Shopify’s POS Pro is £69 a month per location, billed yearly (as of November 2026). The catch is stock: DUMA does not sync with Shopify yet.',
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
        'The one you have. Square and SumUp readers connect directly. Any other card machine works through the till’s Card machine method, with the amount keyed in.',
    },
    {
      question: 'How much does DUMA cost?',
      answer:
        'DUMA has a free plan forever, with no card needed. Business will be £89 a month, or £80 a month paid yearly, and is coming soon.',
    },
  ],
  closing: {
    title: 'Keep your storefront.',
    muted: 'Run the shop floor on DUMA.',
    body: 'Start free in minutes, with no card needed. We’ll help you import your products and set up the till.',
  },
};

export const COMPARISONS: readonly Comparison[] = [DUMA_VS_SQUARE, DUMA_VS_SHOPIFY];
