/**
 * The home page's words, kept apart from its layout so the FAQ that renders
 * and the FAQ in the structured data cannot drift — Google only honours
 * FAQPage markup whose answers are visibly on the page.
 *
 * Source of truth for every claim: the "DUMA Business Profile" note in the
 * Obsidian vault (Permanent/Platform), section 10 "What may be claimed". If a
 * line here is not true of the product today, it does not ship. In particular:
 * Square, SumUp and Stripe terminals connect directly and any other card machine works
 * with the amount keyed in (the till's 'Card machine' method), receipts print through the
 * device's own print dialog, the cash drawer opens through a QZ Tray or Epson network printer,
 * there is no hosted storefront, and payroll is prepared here and submitted
 * elsewhere.
 */

/** Domain colours from DESIGN.md's Domain Ownership Rule. */
export type Tone = 'action' | 'orders' | 'reference' | 'stock' | 'team';

/**
 * One sale, followed into every part of the business it touches. An example
 * with made-up figures, labelled as one on the page.
 */
export const SALE_TRAIL: readonly { tone: Tone; where: string; what: string }[] = [
  { tone: 'stock', where: 'Stock', what: '2 × oat milk portions and 1 × croissant taken off what’s on hand' },
  { tone: 'orders', where: 'Customer', what: 'Sam’s 12th visit — one more and their loyalty reward unlocks' },
  { tone: 'reference', where: 'Margin', what: '£4.85 sale, 71% margin after ingredients and VAT' },
  { tone: 'team', where: 'Labour', what: 'Staff cost for today moves to 24% of takings' },
  { tone: 'action', where: 'Reports', what: 'Today’s takings, top items and busiest hour update' },
];

export const FAQS: { question: string; answer: string }[] = [
  {
    question: 'Is DUMA really free?',
    answer:
      'Yes. There is a free plan with no time limit and no card needed, and it covers the till, orders, payments, products, stock, customers and rotas. A paid Business plan with higher limits will come later.',
  },
  {
    question: 'What kind of business is DUMA for?',
    answer:
      'Small food and drink businesses in the UK — cafés, bakeries, restaurants, bars and food trucks — and small shops that sell products in store, online or both. It also works for services, creators and anyone who needs just one part, such as forms, notes or website content.',
  },
  {
    question: 'Do I need new EPOS hardware?',
    answer:
      'No. DUMA runs in the browser on the tablet, phone or computer you already have, and you can keep your card machine: Square, SumUp and Stripe connect directly, and with any other you key in the amount and the sale still lands in your reports. Receipts print from any tablet, phone or laptop through its own print dialog, AirPrint on iPad. The cash drawer can open by itself after a cash payment, through a receipt printer connected with QZ Tray on a Windows, Mac or Linux till, or an Epson network printer on an iPad or computer.',
  },
  {
    question: 'What happens if the internet goes down?',
    answer:
      'The till keeps taking orders. They are saved on the device and sent when the connection comes back, and a sale that cannot be sent is kept for you to check rather than thrown away.',
  },
  {
    question: 'Does DUMA replace Shopify?',
    answer:
      'Not yet. Keep your online store and its checkout; DUMA runs everything around it — stock, customers, loyalty, email, forms, a till for in-person sales and the reports. A hosted DUMA storefront is planned for later.',
  },
  {
    question: 'Will you help me set it up?',
    answer:
      'Yes, for free, whatever plan you are on. We help you bring in your menu or products, your team and your settings, so you can start selling quickly.',
  },
  {
    question: 'Where is my data kept?',
    answer: 'On servers in the United Kingdom. Website media can be kept in your own Cloudflare R2 or Vercel Blob storage instead.',
  },
  {
    question: 'Can I run more than one location?',
    answer:
      'Yes. One workspace holds all your locations, with reports for each one or for the whole business, and staff can be limited to the location they work at.',
  },
];
