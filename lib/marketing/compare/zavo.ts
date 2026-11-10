// DUMA vs Zavo. Facts read on Zavo's website (zavopay.com); the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const ZAVO_HOME = 'https://zavopay.com/';
const ZAVO_PRICING = 'https://zavopay.com/pricing';
const ZAVO_POS = 'https://zavopay.com/point-of-sale';
const ZAVO_PAYMENTS = 'https://zavopay.com/payments';
const ZAVO_RESERVATIONS = 'https://zavopay.com/reservations';
const ZAVO_MARKETING = 'https://zavopay.com/marketing';
const ZAVO_MULTI = 'https://zavopay.com/multi-location';

export const DUMA_VS_ZAVO: Comparison = {
  slug: 'duma-vs-zavo',
  path: '/compare/duma-vs-zavo',
  competitor: 'Zavo',
  breadcrumb: 'DUMA vs Zavo',
  metaTitle: 'Zavo Alternative UK: DUMA vs Zavo POS | DUMA',
  description:
    'Zavo sells POS, payments and bookings to restaurant groups on a quote. DUMA runs the till, stock, recipe margin and rotas for smaller UK businesses, free. November 2026.',
  checked: '2026-11-03',
  asOf: 'November 2026',
  hero: {
    lead: 'DUMA vs Zavo:',
    mark: 'free for small places, not a quote',
    subtitle:
      'Zavo is a London platform for restaurant groups: POS, its own payments, bookings, guest marketing and an AI voice agent, priced on request. DUMA is for smaller cafés, food businesses and shops: the till, stock, recipe margin, rotas and customers on a free plan, with your own card machine.',
    ticks: ['Free plan, forever', 'Keep your card machine', 'Stock and rotas included'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Choose Zavo if you run a restaurant group and want payments, POS, bookings and guest marketing from one provider, with on-site installation and round-the-clock support, and you are happy to agree a price with them.',
      'Look at DUMA if you are a smaller business that wants stock, recipe margin and rotas alongside the till today, on a free plan, with the card machine you already have. Zavo lists stock as coming soon.',
    ],
  },
  table: {
    title: 'DUMA and Zavo, side by side',
    rows: [
      {
        job: 'Price',
        duma: 'Free plan, forever, with no card needed. Business is £49 a month, coming soon.',
        them: 'POS on custom pricing; payments included, with card rates shown as custom.',
        source: ZAVO_PRICING,
      },
      {
        job: 'Who it’s for',
        duma: 'Small cafés, food businesses and shops, one location or several.',
        them: 'Restaurants, brands and multi-location groups, up to hundreds of sites.',
        source: ZAVO_MULTI,
      },
      {
        job: 'Card payments',
        duma: 'DUMA doesn’t process cards. Keep your machine: Square, SumUp and Stripe connect directly; any other works with the amount keyed in.',
        them: 'Its own payments, powered by Adyen.',
        source: ZAVO_HOME,
      },
      {
        job: 'When the internet drops',
        duma: 'Cash and card-machine sales save on the till and send themselves when the connection returns.',
        them: 'An offline-first POS, with a free 5G fallback for payments if the Wi-Fi drops.',
        source: ZAVO_PAYMENTS,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Bookings',
        duma: 'A booking page for each location, a floor plan, a walk-in waitlist and email reminders.',
        them: 'Bookings from phone, a booking page, walk-ins, Google Reserve and an AI voice agent.',
        source: ZAVO_RESERVATIONS,
        marks: { duma: 'part', them: 'yes' },
      },
      {
        job: 'Stock',
        duma: 'Included and free in full. Every sale takes its recipe’s ingredients off what is on hand.',
        them: 'Listed as coming soon.',
        source: ZAVO_POS,
        marks: { duma: 'yes', them: 'no' },
      },
      {
        job: 'Recipe margin after VAT',
        duma: 'Cost each dish from its ingredients and see the margin after VAT, per size and per option.',
        them: 'We did not find recipe costing on Zavo’s website.',
      },
      {
        job: 'Rotas and clock-ins',
        duma: 'Included and free in full: rotas, clock-ins on staff phones, leave requests and labour cost next to sales.',
        them: 'We did not find rotas or staff scheduling on Zavo’s website.',
      },
      {
        job: 'QR ordering',
        duma: 'Collection orders by QR: customers order and pay by card on their phone, or pay cash at the counter.',
        them: 'We did not find QR or online ordering on Zavo’s website.',
      },
      {
        job: 'Guest marketing',
        duma: 'Email to customers who opted in, with a free allowance.',
        them: 'Guest profiles built automatically, SMS and email campaigns, and birthday and win-back automations.',
        source: ZAVO_MARKETING,
        marks: { duma: 'part', them: 'yes' },
      },
    ],
  },
  pricing: {
    title: 'What Zavo costs',
    bill: {
      unpublished:
        'Zavo lists its POS as “Custom Pricing” and its payments as included, with Visa, Mastercard and Amex rates shown as custom.',
      source: ZAVO_PRICING,
    },
    dumaBill: {
      title: 'The whole operation on DUMA',
      note: 'Till, kitchen screen, stock, recipe margin, rotas, bookings and loyalty on the free plan.',
    },
    facts: [],
  },
  stronger: {
    title: 'Where Zavo is stronger',
    intro: 'Zavo is built for larger restaurant businesses, and it does several things DUMA does not.',
    items: [
      {
        title: 'Payments are built in',
        icon: 'payments',
        them: 'Card payments through Zavo, powered by Adyen, with next-day or instant payouts and tipping on the terminal.',
        duma: 'DUMA does not process payments, and has no tips yet. It works with the card machine you already have.',
      },
      {
        title: 'An AI voice agent',
        icon: 'apps',
        them: 'An AI agent answers the phone and books tables, and bookings also come from Google Reserve.',
        duma: 'DUMA has a booking page per location and no voice agent or Google Reserve.',
      },
      {
        title: 'On-site set-up and support',
        icon: 'hardware',
        them: 'Live within 24 hours, with on-site installation and training, and support around the clock by WhatsApp, email or phone.',
        duma: 'DUMA’s setup help is free and comes from the person who builds it, rather than an on-site team.',
      },
      {
        title: 'Built for groups',
        icon: 'scale',
        them: 'Roll menus and prices out to hundreds of sites at once, with reporting across every location.',
        duma: 'DUMA reports for one site or all of them, and limits staff to their location, but it is built for smaller businesses.',
      },
      {
        title: 'Guest marketing',
        icon: 'sync',
        them: 'Automatic guest profiles, churn-risk segments, and SMS and email automations.',
        duma: 'DUMA emails customers who opted in. No text messages.',
      },
    ],
    verdict: {
      alone: 'Zavo fits a restaurant group that wants payments, POS and bookings from one provider, on a quote.',
      addDuma: 'Choose DUMA if you’re a smaller business that wants stock, recipe margin, rotas and the till today, free.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is a smaller business that wants everything working today, without a sales call.',
    items: [
      {
        title: 'Free, with a published price',
        icon: 'bill',
        tone: 'action',
        body: 'The free plan has no time limit, and Business is £49 a month. No quote, no sales call.',
      },
      {
        title: 'Stock today',
        icon: 'sync',
        tone: 'stock',
        body: 'Every sale takes its recipe’s ingredients off what is on hand, and deliveries are checked in against the order.',
      },
      {
        title: 'Margin after VAT, on every dish',
        icon: 'margin',
        tone: 'reference',
        body: 'Cost each dish from its ingredients and see what you really keep, per size and per option.',
      },
      {
        title: 'Rotas built in',
        icon: 'team',
        tone: 'team',
        body: 'Rotas, clock-ins on staff phones and leave requests, with labour cost next to sales.',
      },
      {
        title: 'Keep your card machine',
        icon: 'card',
        tone: 'stock',
        body: 'Square, SumUp and Stripe connect directly; any other machine works with the amount keyed in, offline too.',
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
    title: 'How to get started with DUMA',
    intro: 'No sales call: create a workspace and we help you set it up, for free.',
    steps: [
      {
        title: 'Create a free DUMA workspace',
        body: 'Tell DUMA what you run, then build your menu in it, or bring it in from a spreadsheet.',
      },
      {
        title: 'Connect your card machine',
        body: 'Square Terminal, SumUp and Stripe Terminal connect directly. Any other machine works through the till’s Card machine method, with the amount keyed in.',
      },
      {
        title: 'Add recipes and stock',
        body: 'Give each dish its ingredients, and DUMA shows its margin after VAT and takes stock off with every sale.',
      },
      { title: 'Add the team and the regulars', body: 'Put the rota, clock-ins, bookings and loyalty in the same workspace.' },
    ],
    connections: {
      sources: [
        { name: 'Your menu', how: 'Imported, or built in DUMA', kind: 'file' },
        { name: 'Square Terminal', how: 'Connected directly', kind: 'card', logo: 'Square' },
        { name: 'Online booking page', how: 'Guests book themselves', kind: 'booking' },
      ],
      updates: [
        { label: 'Stock', icon: 'stock' },
        { label: 'Recipe margin', icon: 'margin' },
        { label: 'Customers', icon: 'customers' },
        { label: 'Rotas', icon: 'rotas' },
      ],
      caption: 'What connects to DUMA, and what it keeps up to date.',
    },
  },
  faqTitle: 'Questions about DUMA and Zavo',
  faqs: [
    {
      question: 'Is DUMA a Zavo alternative?',
      answer:
        'For smaller cafés, food businesses and shops, yes: the till, stock, recipe margin, rotas, bookings and loyalty are on DUMA’s free plan. Zavo is built for restaurant groups and includes its own payments, an AI voice agent and on-site set-up.',
    },
    {
      question: 'How much does Zavo cost?',
      answer:
        'Zavo does not publish its prices. Its website lists the POS as custom pricing and payments as included, with custom card rates.',
    },
    {
      question: 'Does DUMA process card payments like Zavo?',
      answer:
        'No. DUMA works with your existing card machine: Square, SumUp and Stripe connect directly, and any other machine works with the amount keyed in. DUMA takes no cut of your card payments.',
    },
    {
      question: 'Does Zavo have stock management?',
      answer:
        'Its website lists stock as coming soon. In DUMA, stock is included and free in full, and every sale takes its ingredients off what is on hand.',
    },
  ],
  closing: {
    title: 'Everything working today.',
    muted: 'Free, without a sales call.',
  },
};
