// DUMA vs Square. Facts read on Square's UK website; the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const SQUARE_PRICING = 'https://squareup.com/gb/en/pricing';
const SQUARE_RESTAURANTS = 'https://squareup.com/gb/en/point-of-sale/restaurants/pricing';
const SQUARE_RETAIL = 'https://squareup.com/gb/en/point-of-sale/retail/pricing';
const SQUARE_SHIFTS = 'https://squareup.com/gb/en/staff/shifts/pricing';
const SQUARE_LOYALTY = 'https://squareup.com/gb/en/software/loyalty';
const SQUARE_MARKETING = 'https://squareup.com/gb/en/software/marketing';
const SQUARE_OFFLINE = 'https://squareup.com/help/gb/en/article/8106-offline-payments-time-limits';

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
        duma: 'Keep your card machine. Square Terminal, SumUp and Stripe Terminal readers connect directly. Any other machine works with the amount keyed in.',
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
        them: 'Gift cards, split bills, tips and receipt printers that print every sale automatically.',
        duma: 'Not in DUMA yet. Receipts print through the device’s print dialog, though the cash drawer can open by itself after a cash payment.',
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
