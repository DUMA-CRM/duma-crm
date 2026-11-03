// DUMA vs Sunday. Facts read on Sunday's UK website (sundayapp.com/en-gb); the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const SUNDAY_HOME = 'https://sundayapp.com/en-gb/';
const SUNDAY_PRICING = 'https://sundayapp.com/en-gb/pricing/';
const SUNDAY_BILL = 'https://sundayapp.com/en-gb/digital-bill/';
const SUNDAY_ORDER = 'https://sundayapp.com/en-gb/order-and-pay/';
const SUNDAY_REVIEWS = 'https://sundayapp.com/en-gb/online-reputation/';
const SUNDAY_LOYALTY = 'https://sundayapp.com/en-gb/loyalty/';
const SUNDAY_TERMINAL = 'https://sundayapp.com/en-gb/smart-terminal/';

export const DUMA_VS_SUNDAY: Comparison = {
  slug: 'duma-vs-sunday',
  path: '/compare/duma-vs-sunday',
  competitor: 'Sunday',
  breadcrumb: 'DUMA vs Sunday',
  metaTitle: 'DUMA vs Sunday: Pay at Table App or All-in-One EPOS? | DUMA',
  description:
    'Sunday adds QR pay at the table on top of your POS, from £149 a month. DUMA is the till and everything around it, free. What each does, honestly. Prices as of November 2026.',
  checked: '2026-11-03',
  asOf: 'November 2026',
  hero: {
    lead: 'DUMA vs Sunday:',
    mark: 'a layer on your till, or the till itself',
    subtitle:
      'Sunday lets guests scan, split, tip and pay at the table, on top of the POS you already run. DUMA is the system underneath: the till, kitchen screen, stock, recipe margin, rotas and customers, on a free plan. They solve different problems, and DUMA has no pay at the table yet.',
    ticks: ['Free plan, forever', 'Keep your card machine', 'Till works offline'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Choose Sunday if you run a full-service restaurant on a POS that already does the rest, and you want guests to pay, split and tip at the table from a QR code. That is what Sunday is built for, and DUMA does not do it yet.',
      'Look at DUMA if what you need is the till and back office itself: orders, a kitchen screen, stock, recipe margin, rotas and loyalty, without paying for a POS and a layer on top of it.',
    ],
  },
  table: {
    title: 'DUMA and Sunday, side by side',
    intro: 'Sunday’s figures are from its UK website. DUMA’s are from the product today.',
    rows: [
      {
        job: 'What it is',
        duma: 'A till and back office: orders, kitchen screen, stock, recipe margin, rotas, customers and reports.',
        them: 'A QR pay-at-table layer that connects to the POS you already run.',
        source: SUNDAY_BILL,
      },
      {
        job: 'Monthly price',
        duma: 'Free plan, forever, with no card needed. Business is £89 a month, coming soon.',
        them: 'Standard £149 a month; Premium £199 a month.',
        source: SUNDAY_PRICING,
      },
      {
        job: 'Pay at the table by QR',
        duma: 'Not yet. Guests pay at the till or on the card machine.',
        them: 'Scan, split, tip and pay from the bill, with no app.',
        source: SUNDAY_BILL,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'Split the bill',
        duma: 'Not yet.',
        them: 'By item, by number of people, or a custom amount.',
        source: SUNDAY_BILL,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'Tips',
        duma: 'Not yet.',
        them: 'One-tap tips with pre-selected amounts, and staff are notified.',
        source: SUNDAY_BILL,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'Order from a QR code',
        duma: 'Collection orders: guests order and pay by card on their phone, or pay cash at the counter. No ordering to a table yet.',
        them: 'Order & Pay for eat-in and takeaway, with a text or email when the order is ready.',
        source: SUNDAY_ORDER,
        marks: { duma: 'part', them: 'yes' },
      },
      {
        job: 'Google reviews',
        duma: 'DUMA doesn’t ask guests for reviews.',
        them: 'Every guest who pays is prompted to leave a Google review.',
        source: SUNDAY_REVIEWS,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'Loyalty',
        duma: 'Included: stamp cards and points, applied at the till.',
        them: 'Plugs into your own loyalty programme. Loyalty is £49 a month on Standard, included in Premium.',
        source: SUNDAY_LOYALTY,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Till, stock and rotas',
        duma: 'Included: the till, kitchen screen, stock, recipe margin, rotas and clock-ins.',
        them: 'Not part of Sunday: it connects to your existing POS.',
        source: SUNDAY_BILL,
        marks: { duma: 'yes', them: 'no' },
      },
    ],
  },
  pricing: {
    title: 'What Sunday costs',
    intro:
      'Read on Sunday’s UK website on 3 November 2026. Sunday changes its prices from time to time, so check the linked page before you decide.',
    bill: {
      title: 'A restaurant on Sunday Standard',
      lines: [
        { label: 'Standard plan', pounds: 149, source: SUNDAY_PRICING },
        { label: 'Loyalty add-on', pounds: 49, source: SUNDAY_PRICING },
      ],
      note: 'Each month, on top of the POS it connects to, and before transaction fees, which Sunday doesn’t publish. Premium, with loyalty included, is £199.',
    },
    dumaBill: {
      title: 'The till and the rest on DUMA',
      note: 'Till, kitchen screen, QR ordering for collection, stock and loyalty on the free plan. No pay at the table yet.',
    },
    facts: [
      { text: 'Standard £149 a month; Premium £199 a month, adding Loyalty Integration and the Enterprise Pack.', source: SUNDAY_PRICING },
      {
        text: 'Add-ons: Click & Collect £29, Hybrid Ordering £49, Payment Links £29, Loyalty £49, AI Menu £25 a month.',
        source: SUNDAY_PRICING,
      },
      { text: 'A7 QR codes £3.50 + VAT each; other QR codes on quote.', source: SUNDAY_PRICING },
      { text: 'Transaction fees are not published: Sunday quotes them on request.', source: SUNDAY_HOME },
      { text: 'Its Smart Terminal card machines connect to your POS. No hardware price is published.', source: SUNDAY_TERMINAL },
    ],
    duma: [
      'Free, forever, with no card needed. The till, orders, payments, products and margin, stock, customers and rotas stay free in full. Every other part keeps a free allowance.',
      'Business is £89 a month, or £80 a month paid yearly. It is coming soon, and anyone who joins before it launches keeps 10% off for life.',
      'DUMA takes no cut of your card payments. Your card provider charges its own fees, as it does today.',
    ],
  },
  stronger: {
    title: 'Where Sunday is stronger',
    intro: 'Paying at the table is Sunday’s whole product, and it does it in ways DUMA does not.',
    items: [
      {
        title: 'Pay at the table',
        icon: 'payments',
        them: 'Guests scan the bill, pay with Apple Pay, Google Pay or a card, with no app, in about ten seconds, Sunday says.',
        duma: 'DUMA has no pay at the table yet. Guests pay at the till or on the card machine.',
      },
      {
        title: 'Split bills and tips',
        icon: 'till',
        them: 'Split by item, by person or by amount, with one-tap tips that notify staff.',
        duma: 'Split bills and tips are not in DUMA yet.',
      },
      {
        title: 'Reviews on every payment',
        icon: 'apps',
        them: 'Each guest who pays is prompted to leave a Google review, with AI replies to reviews.',
        duma: 'DUMA doesn’t ask guests for reviews.',
      },
      {
        title: 'Works with the POS you have',
        icon: 'sync',
        them: 'Sunday connects to the POS systems it partners with, so you keep your till.',
        duma: 'DUMA is the till itself, and doesn’t connect to Sunday or another POS.',
      },
      {
        title: 'Size and track record',
        icon: 'scale',
        them: 'Over 5,000 clients, Sunday says.',
        duma: 'DUMA is new, built and supported by one person. When you ask for something, you’re talking to the person who builds it.',
      },
    ],
    verdict: {
      alone: 'Sunday is the pick if your POS already does the rest and you want guests to pay at the table.',
      addDuma: 'Choose DUMA if you need the till, kitchen screen, stock, rotas and customers themselves, on a free plan.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is the system the payment comes from, not the moment of paying.',
    items: [
      {
        title: 'The till, not a layer on top',
        icon: 'till',
        tone: 'orders',
        body: 'Orders, the kitchen screen and payments are in DUMA itself, so there is no POS underneath to pay for.',
      },
      {
        title: 'Margin after VAT, on every dish',
        icon: 'margin',
        tone: 'reference',
        body: 'Cost each dish from its ingredients and see what you really keep, per size and per option.',
      },
      {
        title: 'Stock that moves with every sale',
        icon: 'sync',
        tone: 'stock',
        body: 'Every sale takes its recipe’s ingredients off what is on hand, and deliveries are checked in against the order.',
      },
      {
        title: 'Rotas built in',
        icon: 'team',
        tone: 'team',
        body: 'Rotas, clock-ins on staff phones and leave requests, with labour cost next to sales.',
      },
      {
        title: 'One bill, or none',
        icon: 'bill',
        tone: 'action',
        body: 'The till, stock, rotas and customers are on the free plan. No monthly fee for a layer on top.',
      },
      {
        title: 'Free setup help',
        icon: 'help',
        tone: 'team',
        body: 'We help you bring your menu and team across, on every plan, from the person who builds DUMA.',
      },
    ],
  },
  together: {
    title: 'How orders and payments reach DUMA',
    intro: 'There is no Sunday connection to DUMA. This is how DUMA takes orders and payments on its own.',
    steps: [
      {
        title: 'Create a free DUMA workspace',
        body: 'Tell DUMA what you run, then build your menu in it, or bring it in from a spreadsheet.',
      },
      {
        title: 'Connect your card machine',
        body: 'Square Terminal and SumUp connect directly. Any other machine works through the till’s Card machine method, with the amount keyed in.',
      },
      {
        title: 'Turn on QR ordering for collection',
        body: 'Customers scan, order and pay by card on their phone, or choose to pay cash at the counter. Orders go straight to the kitchen screen.',
      },
      {
        title: 'Switch on the rest when you’re ready',
        body: 'Stock, recipes, rotas and loyalty are already in the same workspace. There is nothing to move.',
      },
    ],
    connections: {
      sources: [
        { name: 'Customer’s phone', how: 'QR order for collection', kind: 'qr' },
        { name: 'Square Terminal', how: 'Connected directly', kind: 'card', logo: 'Square' },
        { name: 'Any other card machine', how: 'Amount keyed in', kind: 'card' },
      ],
      updates: [
        { label: 'Stock', icon: 'stock' },
        { label: 'Recipe margin', icon: 'margin' },
        { label: 'Customers', icon: 'customers' },
        { label: 'Reports', icon: 'reports' },
      ],
    },
  },
  faqTitle: 'Questions about DUMA and Sunday',
  faqs: [
    {
      question: 'Is DUMA a Sunday alternative?',
      answer:
        'Not directly. Sunday adds pay at the table to an existing POS; DUMA is the POS and back office itself. If you want guests to pay, split and tip at the table, Sunday does that and DUMA does not yet.',
    },
    {
      question: 'Can guests pay on their phone with DUMA?',
      answer:
        'For QR collection orders, yes: customers order and pay by card on their phone, or pay cash at the counter. Paying a table bill from a phone, splitting it and tipping are not in DUMA yet.',
    },
    {
      question: 'Does Sunday work with DUMA?',
      answer: 'No. Sunday connects to the POS systems it partners with, and DUMA is not one of them.',
    },
    {
      question: 'How much does Sunday cost?',
      answer:
        'On its UK website, Sunday’s Standard plan is £149 a month and Premium £199 a month, on top of your POS. Transaction fees are quoted on request. DUMA’s free plan has no monthly fee.',
    },
  ],
  closing: {
    title: 'Start with the till.',
    muted: 'Everything around it is already there.',
    body: 'Start free in minutes, with no card needed. We’ll help you bring your menu and team across.',
  },
};
