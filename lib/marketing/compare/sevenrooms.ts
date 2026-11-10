// DUMA vs SevenRooms. Facts read on sevenrooms.com (it has no UK-priced site); the rules are in lib/marketing/compare.ts.
import type { Comparison } from '@/lib/marketing/compare';

const SR_PRICING = 'https://sevenrooms.com/pricing/';
const SR_RESERVATIONS = 'https://sevenrooms.com/platform/reservations-waitlist/';
const SR_TABLES = 'https://sevenrooms.com/platform/table-management/';
const SR_CRM = 'https://sevenrooms.com/platform/crm/';
const SR_MARKETING = 'https://sevenrooms.com/platform/marketing-automation/';
const SR_INTEGRATIONS = 'https://sevenrooms.com/platform/integrations-apis/';

export const DUMA_VS_SEVENROOMS: Comparison = {
  slug: 'duma-vs-sevenrooms',
  path: '/compare/duma-vs-sevenrooms',
  competitor: 'SevenRooms',
  breadcrumb: 'DUMA vs SevenRooms',
  metaTitle: 'SevenRooms Alternative UK: DUMA vs SevenRooms | DUMA',
  description:
    'SevenRooms is reservations, guest CRM and marketing on a quote. DUMA puts simpler bookings next to the till, stock and rotas, free. An honest comparison, November 2026.',
  checked: '2026-11-03',
  asOf: 'November 2026',
  hero: {
    lead: 'DUMA vs SevenRooms:',
    mark: 'bookings beside the till',
    subtitle:
      'SevenRooms is a reservations, guest CRM and marketing platform for restaurant groups, priced on a quote. DUMA keeps simpler bookings, a floor plan and a waitlist in the same free workspace as the till, stock, rotas and customers.',
    ticks: ['Free plan, forever', 'No cover fees', 'Bookings linked to customers'],
  },
  verdict: {
    title: 'The short answer',
    paragraphs: [
      'Choose SevenRooms if bookings are the centre of your business: you need deposits and card holds, SMS confirmations, bookings from Google and marketplaces, and automated marketing across a group of restaurants.',
      'Look at DUMA if you want straightforward online bookings, a floor plan and a waitlist next to the till, stock and rotas, on a free plan. DUMA takes no deposits and sends reminders by email only, so check that is enough for you.',
    ],
  },
  table: {
    title: 'DUMA and SevenRooms, side by side',
    rows: [
      {
        job: 'Price',
        duma: 'Free plan, forever, with no card needed. Business is £49 a month, coming soon.',
        them: 'Starter, Growth and Premium plans, priced through a “Get a quote” form. No prices are published.',
        source: SR_PRICING,
      },
      {
        job: 'Online bookings',
        duma: 'A booking page for each location that guests use themselves. Link to it from your website; it can’t be embedded yet.',
        them: 'Branded reservations from Google, DoorDash, Facebook, Instagram and your own site.',
        source: SR_RESERVATIONS,
        marks: { duma: 'part', them: 'yes' },
      },
      {
        job: 'Floor plan and waitlist',
        duma: 'A floor plan with areas and tables, and a walk-in waitlist that seats guests as bookings.',
        them: 'Table management with AI seating, and a waitlist with a QR code and Google Reserve.',
        source: SR_TABLES,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Deposits and no-show fees',
        duma: 'Not yet. A no-show is recorded on the booking.',
        them: 'Credit card holds and cancellation fees to protect busy slots.',
        source: SR_RESERVATIONS,
        marks: { duma: 'no', them: 'yes' },
      },
      {
        job: 'Confirmations and reminders',
        duma: 'Confirmation, reminder and cancellation emails. No text messages.',
        them: 'Pre-arrival reminders and two-way SMS confirmations.',
        source: SR_RESERVATIONS,
        marks: { duma: 'part', them: 'yes' },
      },
      {
        job: 'Guest profiles',
        duma: 'A booking links to the customer record: visits, spend, notes, allergies and seating preference.',
        them: 'Over 100 data points per guest, auto-tags, and spend from its POS integrations.',
        source: SR_CRM,
        marks: { duma: 'yes', them: 'yes' },
      },
      {
        job: 'Marketing',
        duma: 'Email to customers who opted in, with a free allowance.',
        them: '13 pre-built automated emails; WhatsApp and text marketing are add-ons.',
        source: SR_MARKETING,
        marks: { duma: 'part', them: 'yes' },
      },
      {
        job: 'Till, stock and rotas',
        duma: 'Included: the till, kitchen screen, stock, recipe margin, rotas and clock-ins.',
        them: 'Not part of SevenRooms: it connects to over 65 POS systems.',
        source: SR_INTEGRATIONS,
        marks: { duma: 'yes', them: 'no' },
      },
    ],
  },
  pricing: {
    title: 'What SevenRooms costs',
    bill: {
      unpublished:
        'SevenRooms sells three plans, Starter, Growth and Premium, through a “Get a quote” form. Email marketing, event management, Voice AI, WhatsApp and text marketing, and API access are sold as add-ons.',
      source: SR_PRICING,
    },
    dumaBill: {
      title: 'Bookings and the rest on DUMA',
      note: 'Online bookings, floor plan and waitlist, with the till, stock and rotas, on the free plan. No cover fees.',
    },
    facts: [
      {
        text: 'Starter includes guest profiles, branded reservations and waitlist, table management, reputation management and basic marketing automations.',
        source: SR_PRICING,
      },
      { text: 'SevenRooms says it charges no cover fees on its own reservations.', source: SR_RESERVATIONS },
    ],
  },
  stronger: {
    title: 'Where SevenRooms is stronger',
    intro: 'For restaurants that live on bookings, SevenRooms does a great deal DUMA does not.',
    items: [
      {
        title: 'Deposits and card holds',
        icon: 'payments',
        them: 'Card holds and cancellation fees protect high-demand slots, and add-ons can be sold at booking.',
        duma: 'DUMA takes no deposits or card holds yet.',
      },
      {
        title: 'Bookings from more places',
        icon: 'store',
        them: 'Google, DoorDash, Facebook, Instagram and your own site, plus the DoorDash and Deliveroo reservation marketplace.',
        duma: 'DUMA has one booking page per location, which you link to. It can’t be embedded in your website yet.',
      },
      {
        title: 'Marketing automation',
        icon: 'apps',
        them: '13 ready-made automated emails, with WhatsApp and text campaigns.',
        duma: 'DUMA emails customers who opted in. No text or WhatsApp messages.',
      },
      {
        title: 'Smarter seating',
        icon: 'sync',
        them: 'AI table management that works through thousands of table combinations every second.',
        duma: 'In DUMA you seat guests on the floor plan; an online booking takes a single table.',
      },
      {
        title: 'Size and track record',
        icon: 'scale',
        them: 'Established, with a much larger team and client base.',
        duma: 'DUMA is new, built and supported by one person. When you ask for something, you’re talking to the person who builds it.',
      },
    ],
    verdict: {
      alone: 'SevenRooms is the stronger choice for a busy group that lives on bookings, deposits and guest marketing.',
      addDuma: 'Choose DUMA if you want simple bookings in the same place as the till, stock and rotas, on a free plan.',
    },
  },
  different: {
    title: 'Where DUMA is different',
    intro: 'DUMA’s case is a booking and a sale in the same system.',
    items: [
      {
        title: 'Bookings and the till together',
        icon: 'till',
        tone: 'orders',
        body: 'A booking, the guest’s order and their spend sit in one workspace, with nothing to integrate.',
      },
      {
        title: 'Free, with no cover fees',
        icon: 'bill',
        tone: 'action',
        body: 'Bookings, the floor plan and the waitlist are on the free plan, and DUMA charges nothing per cover.',
      },
      {
        title: 'One customer record',
        icon: 'customers',
        tone: 'orders',
        body: 'Visits, spend, allergies and notes on one profile, shown when you open the booking.',
      },
      {
        title: 'Stock and margin',
        icon: 'margin',
        tone: 'reference',
        body: 'Every sale takes its ingredients off stock, and every dish shows its margin after VAT.',
      },
      {
        title: 'Rotas built in',
        icon: 'team',
        tone: 'team',
        body: 'Plan the team for the bookings you have, with labour cost next to sales.',
      },
      {
        title: 'Free setup help',
        icon: 'help',
        tone: 'team',
        body: 'We help you set up your floor plan, booking rules and menu, on every plan, for free.',
      },
    ],
  },
  together: {
    title: 'How bookings work in DUMA',
    intro: 'There is no SevenRooms connection to DUMA. This is how bookings run in DUMA on their own.',
    steps: [
      { title: 'Draw your floor plan', body: 'Add your areas and tables, with the covers each one seats.' },
      {
        title: 'Set your booking rules',
        body: 'Slot length, notice, how far ahead guests can book, and the largest party online. Larger groups are asked to phone.',
      },
      {
        title: 'Share your booking page',
        body: 'Each location gets its own page for guests. Link to it from your website and social profiles.',
      },
      {
        title: 'Seat guests, walk-ins included',
        body: 'Seat bookings on the floor plan, add walk-ins to the waitlist, and link each booking to the customer’s profile.',
      },
    ],
    connections: {
      sources: [
        { name: 'Online booking page', how: 'Guests book themselves', kind: 'booking' },
        { name: 'Phone and walk-ins', how: 'Added by your team', kind: 'walkin' },
        { name: 'Your card machine', how: 'Square, SumUp, Stripe or keyed in', kind: 'card', logo: 'Square' },
      ],
      updates: [
        { label: 'Customers', icon: 'customers' },
        { label: 'Loyalty', icon: 'loyalty' },
        { label: 'Stock', icon: 'stock' },
        { label: 'Reports', icon: 'reports' },
      ],
      caption: 'How bookings and sales reach DUMA, and what they update.',
    },
  },
  faqTitle: 'Questions about DUMA and SevenRooms',
  faqs: [
    {
      question: 'Is DUMA a SevenRooms alternative?',
      answer:
        'For smaller restaurants and cafés that want straightforward online bookings, a floor plan and a waitlist next to the till, yes. For a group that relies on deposits, SMS and marketplace bookings, SevenRooms does much more.',
    },
    {
      question: 'Does DUMA take deposits or charge no-show fees?',
      answer: 'Not yet. DUMA records a no-show on the booking, but takes no deposit or card hold.',
    },
    {
      question: 'Does DUMA charge cover fees?',
      answer: 'No. DUMA charges nothing per booking or per cover, and bookings are on the free plan.',
    },
    {
      question: 'How much does SevenRooms cost?',
      answer: 'SevenRooms does not publish its prices. Its website asks you to request a quote for its Starter, Growth and Premium plans.',
    },
  ],
  closing: {
    title: 'Bookings, the till and the team.',
    muted: 'In one free workspace.',
  },
};
