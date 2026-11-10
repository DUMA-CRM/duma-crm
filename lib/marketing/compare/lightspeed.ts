// DUMA vs Lightspeed. Facts read on Lightspeed's UK website (lightspeedhq.com/uk); the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const LS_RESTAURANT_PRICING = 'https://www.lightspeedhq.com/uk/pos/restaurant/pricing/';
const LS_RETAIL_PRICING = 'https://www.lightspeedhq.com/uk/pos/retail/pricing/';
const LS_RESTAURANT = 'https://www.lightspeedhq.com/uk/pos/restaurant/';
const LS_PAYMENTS = 'https://www.lightspeedhq.com/uk/payments/';

export const DUMA_VS_LIGHTSPEED: Comparison = {
  slug: 'duma-vs-lightspeed',
  path: '/compare/duma-vs-lightspeed',
  competitor: 'Lightspeed',
  breadcrumb: 'DUMA vs Lightspeed',
  metaTitle: 'Lightspeed Alternative UK: DUMA vs Lightspeed POS | DUMA',
  description:
    'A free Lightspeed alternative for UK cafés, restaurants and shops: till, stock, recipe margin, rotas and loyalty in one workspace, with your own card machine. Prices as of November 2026.',
  checked: '2026-11-03',
  asOf: 'November 2026',
  vatNote: 'Lightspeed’s UK website does not say whether its figures include VAT.',
  hero: {
    lead: 'DUMA vs Lightspeed:',
    mark: 'the same jobs, without the monthly plan',
    subtitle:
      'Lightspeed is a polished ePOS for restaurants and shops, from £79 a month. DUMA runs the till, kitchen screen, stock, recipe margin, rotas and customers in one workspace on a free plan, with the card machine you already have.',
    ticks: ['Free plan, forever', 'Keep your card machine', 'Till works offline'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Choose Lightspeed if you run a busy full-service restaurant or a multi-store shop, want payments, gift cards and a large integration marketplace from one supplier, and the monthly plan fits your budget.',
      'Look at DUMA if you are a smaller café, food business or shop that wants stock, recipe margin, rotas and loyalty without a plan per terminal. DUMA works with the card machine you already have; Lightspeed says its payments can’t use existing terminal hardware.',
    ],
  },
  table: {
    title: 'DUMA and Lightspeed, side by side',
    rows: [
      {
        job: 'Software price',
        duma: 'Free plan, forever, with no card needed. Business is £49 a month, coming soon.',
        them: 'Restaurant: Basic £79, Core £149, Pro £219 a month. Retail: Basic £75, Core £149, Plus £189 a month.',
        source: LS_RESTAURANT_PRICING,
      },
      {
        job: 'Card machine',
        duma: 'Keep yours. Square, SumUp and Stripe connect directly; any other machine works with the amount keyed in.',
        them: 'Lightspeed Payments. Lightspeed says you can’t use existing terminal hardware, and its hardware is sold separately.',
        source: LS_PAYMENTS,
        marks: { duma: 'yes', them: 'no' },
      },
      {
        job: 'When the internet drops',
        duma: 'Cash and card-machine sales save on the till and send themselves when the connection returns. Nothing queued is thrown away.',
        them: 'Lightspeed Restaurant keeps working offline and syncs when the connection returns.',
        source: LS_RESTAURANT,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Stock',
        duma: 'Included and free in full. Every sale takes its recipe’s ingredients off what is on hand.',
        them: 'Inventory management on Restaurant Core and Pro, not Basic. Inventory and purchase orders on every Retail plan.',
        source: LS_RESTAURANT_PRICING,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Recipe margin after VAT',
        duma: 'Cost each dish from its ingredients and see the margin after VAT, per size and per combination of options.',
        them: 'Stock tracked to the ingredient, with recipe consistency. We did not find margin after VAT on Lightspeed’s UK pages.',
        source: LS_RESTAURANT,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Kitchen display',
        duma: 'Included: tickets move from New to Preparing to Ready.',
        them: 'An add-on on Restaurant Basic; one of the licences you choose on Core and Pro.',
        source: LS_RESTAURANT_PRICING,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'QR ordering',
        duma: 'Collection orders by QR: customers order and pay by card on their phone, or pay cash at the counter. No ordering to a table yet.',
        them: 'QR code ordering and pay on Restaurant Core and Pro.',
        source: LS_RESTAURANT_PRICING,
        marks: { duma: 'part', them: 'part' },
      },
      {
        job: 'Rotas and clock-ins',
        duma: 'Included and free in full: rotas, clock-in on the staff member’s phone, leave requests, and labour cost next to sales.',
        them: 'Not listed on the restaurant page; employee management comes through integrations.',
        source: LS_RESTAURANT,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Loyalty',
        duma: 'Included: stamp cards and points, applied at the till.',
        them: 'Gift Cards & Loyalty on Restaurant Core and Pro; in-store and online loyalty on every Retail plan.',
        source: LS_RESTAURANT_PRICING,
        marks: { duma: 'yes', them: 'part' },
      },
      {
        job: 'Gift cards',
        duma: 'Not in DUMA yet.',
        them: 'Included with Restaurant Core and Pro.',
        source: LS_RESTAURANT_PRICING,
        marks: { duma: 'no', them: 'yes' },
      },
    ],
  },
  pricing: {
    title: 'What Lightspeed costs',
    bill: {
      title: 'A café or restaurant on Lightspeed Core',
      lines: [{ label: 'Restaurant Core, with two licences', pounds: 149, source: LS_RESTAURANT_PRICING }],
      note: 'Each month, before card fees and hardware, whose prices Lightspeed doesn’t publish. Reservations, workforce and marketing are add-ons or integrations, and Lightspeed says additional fees may apply.',
    },
    dumaBill: {
      title: 'The same jobs on DUMA',
      note: 'Till, kitchen screen, stock, recipe margin, rotas and loyalty on the free plan.',
    },
    facts: [
      {
        text: 'Restaurant: Basic £79 a month (one licence), Core £149 (two), Pro £219 (three). An extra register is £39.',
        source: LS_RESTAURANT_PRICING,
      },
      // The table's retail prices are read here, so the line stays as their source.
      { text: 'Retail: Basic £75, Core £149, Plus £189 a month, each with one register.', source: LS_RETAIL_PRICING },
      { text: 'Payment rates are shown as “Default” on Restaurant Basic and “Custom” on Core and Pro.', source: LS_RESTAURANT_PRICING },
      { text: 'A chargeback costs a single £15 fee.', source: LS_PAYMENTS },
      {
        text: 'Add-ons and integrations, with no prices published: ordering kiosk, reservations, workforce and payroll, accounting, marketing automation.',
        source: LS_RESTAURANT_PRICING,
      },
      { text: 'Monthly plans can be cancelled at the end of the month; annual plans run to the end of the term.', source: LS_RESTAURANT },
    ],
  },
  stronger: {
    title: 'Where Lightspeed is stronger',
    intro: 'Lightspeed is an established ePOS, and it does several things DUMA does not.',
    items: [
      {
        title: 'Payments are built in',
        icon: 'payments',
        them: 'Lightspeed Payments is part of the system, with the same rate whatever card the customer uses.',
        duma: 'DUMA does not process payments. It works with the card machine you already have.',
      },
      {
        title: 'More at the till today',
        icon: 'till',
        them: 'Gift cards on Restaurant Core and Pro, and click & collect and delivery on Pro.',
        duma: 'Gift cards, split bills and tips are not in DUMA yet.',
      },
      {
        title: 'Retail depth',
        icon: 'store',
        them: 'Supplier catalogues, purchase orders, landed costs and eCommerce on its Retail plans.',
        duma: 'DUMA has stock in every size and colour and purchase orders, but no hosted online store yet.',
      },
      {
        title: 'A large integration marketplace',
        icon: 'apps',
        them: 'An integration marketplace on every Restaurant plan, with accounting, PMS and marketing add-ons.',
        duma: 'DUMA connects to fewer services, adds integrations on request, and has a public API.',
      },
      {
        title: 'Size and track record',
        icon: 'scale',
        them: 'Established, with a much larger team and client base.',
        duma: 'DUMA is new, built and supported by one person. When you ask for something, you’re talking to the person who builds it.',
      },
    ],
    verdict: {
      alone: 'Lightspeed is the safer pick for a large venue that wants payments and gift cards from one supplier.',
      addDuma:
        'Choose DUMA if you want stock, recipe margin, rotas and loyalty without a plan per terminal, and to keep your card machine.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is the whole operation on one free plan, built for smaller places.',
    items: [
      {
        title: 'No plan per terminal',
        icon: 'bill',
        tone: 'action',
        body: 'The till, stock, rotas and customers are on the free plan, whatever device you run them on.',
      },
      {
        title: 'Margin after VAT, on every dish',
        icon: 'margin',
        tone: 'reference',
        body: 'Recipe costing takes VAT out if you are registered, per size and per option, using the same arithmetic as the till.',
      },
      {
        title: 'Rotas built in',
        icon: 'team',
        tone: 'team',
        body: 'Rotas, clock-ins on staff phones and leave requests, with labour cost next to sales. No integration to buy.',
      },
      {
        title: 'Keep your card machine',
        icon: 'card',
        tone: 'stock',
        body: 'Square, SumUp and Stripe connect directly; any other machine works with the amount keyed in, offline too.',
      },
      {
        title: 'Every sale updates everything',
        icon: 'sync',
        tone: 'stock',
        body: 'A sale moves stock, the customer’s history, your margin and the reports at the same moment.',
      },
      {
        title: 'Free setup help',
        icon: 'help',
        tone: 'team',
        body: 'We help you bring your menu or products and your team across, on every plan, from the person who builds DUMA.',
      },
    ],
  },
  together: {
    title: 'How to move from Lightspeed to DUMA',
    intro: 'Most of the work is your menu or products. We help with that for free.',
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
      {
        title: 'Add the team and the regulars',
        body: 'Put the rota, clock-ins and loyalty in the same workspace. There is nothing to connect.',
      },
    ],
    connections: {
      sources: [
        { name: 'Your menu or products', how: 'Imported, or built in DUMA', kind: 'file' },
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
  faqTitle: 'Questions about DUMA and Lightspeed',
  faqs: [
    {
      question: 'Is DUMA a free Lightspeed alternative?',
      answer:
        'For smaller cafés, food businesses and shops, yes: the till, kitchen screen, stock, recipe margin, rotas and loyalty are on DUMA’s free plan. Lightspeed’s plans start at £79 a month for restaurants and £75 for shops, and it has things DUMA does not yet, such as gift cards and built-in payments.',
    },
    {
      question: 'Can I keep my card machine?',
      answer:
        'With DUMA, yes. Square, SumUp and Stripe connect directly, and any other machine works with the amount keyed in. Lightspeed says its payments can’t use existing terminal hardware, so check your Lightspeed agreement before you move.',
    },
    {
      question: 'Does DUMA work offline like Lightspeed?',
      answer:
        'Yes. When the internet drops, cash and card-machine sales are saved on the till and sent when it is back, and a sale that can’t be sent is kept for you to check. A card reader connected to DUMA needs the internet; a standalone machine keeps working.',
    },
    {
      question: 'Does DUMA have gift cards or split bills?',
      answer: 'Not yet. Gift cards, split bills and tips are not in DUMA today. Promo codes and loyalty rewards are.',
    },
  ],
  closing: {
    title: 'The whole operation, on one free plan.',
    muted: 'With the card machine you already have.',
  },
};
