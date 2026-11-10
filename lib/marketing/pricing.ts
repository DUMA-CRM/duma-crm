/**
 * Plans and pricing words for /pricing, in one place.
 *
 * Decisions (the "DUMA Business Profile" vault note, section 7, changed by the
 * owner on 2026-11-10): a Free plan forever; one Business plan at £49 a month,
 * or one month free when paid yearly (£539 a year); and a contact-us tier for
 * closer support. There is no founding-member discount. Business cannot be bought yet
 * — no billing exists — so every page says "coming soon" beside its price.
 * Free-plan allowances are not decided, so nothing here may name a limit.
 *
 * When Business launches, change BUSINESS.available, SIGN_UP_CTA and
 * softwareApplicationSchema's offer together.
 */

export const BUSINESS = {
  /** £ per month, billed monthly. */
  monthly: 49,
  /** Months free when paying yearly. */
  freeMonthsYearly: 1,
  available: false,
} as const;

export type Billing = 'monthly' | 'yearly';

/** What Business costs for a billing period: a month, or a year with the free months taken off. Pure, so it can be tested. */
export function businessPrice(billing: Billing): { total: number; period: 'month' | 'year' } {
  return billing === 'monthly'
    ? { total: BUSINESS.monthly, period: 'month' }
    : { total: BUSINESS.monthly * (12 - BUSINESS.freeMonthsYearly), period: 'year' };
}

/** What paying yearly saves over twelve monthly payments, in £. */
export function yearlySaving(): number {
  return BUSINESS.monthly * BUSINESS.freeMonthsYearly;
}

/** £49, £539, £44.92 — whole pounds without pence, otherwise two places. */
export function formatPounds(amount: number): string {
  return Number.isInteger(amount) ? `£${amount}` : `£${amount.toFixed(2)}`;
}

export const FREE_FEATURES: readonly string[] = [
  'Till, orders and payments',
  'Products, menu, recipes and margin',
  'Stock',
  'Customers',
  'Rotas, clock-ins and leave',
  'Works offline',
  'Every other part, with a free allowance',
];

export const BUSINESS_FEATURES: readonly string[] = ['Everything in Free', 'Much higher limits on everything, including Ask DUMA, the assistant'];

export const SETUP_HELP: readonly string[] = ['Bring in your menu or products', 'Add your team and their roles', 'Connect your card machine', 'Show you round, so you can run it yourself'];

export const PRICING_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Is the free EPOS plan really free forever?',
    answer:
      'Yes. It has no time limit and needs no card. The till, orders, payments, products, stock, customers and rotas stay free in full, and every other part keeps a free allowance.',
  },
  {
    question: 'What is free today?',
    answer:
      'Everything. Until the Business plan launches, every part of DUMA is free. When it does, the basics stay free in full and the other parts keep a free allowance — we will publish the allowances well before anything changes.',
  },
  {
    question: 'What will the Business plan cost?',
    answer:
      '£49 a month, or £539 a year when you pay yearly, which is one month free. It is coming soon.',
  },
  {
    question: 'Will something I use for free today become paid?',
    answer:
      'The basics never will. If you use a lot of one of the other parts, you may reach its free allowance once Business launches, and we will tell you clearly before that happens.',
  },
  {
    question: 'Does DUMA take a cut of my card payments?',
    answer: 'No. Card fees are charged by your card machine provider — not by DUMA. Keep the machine and the deal you already have.',
  },
  {
    question: 'Is there a contract?',
    answer: 'No. There is nothing to sign and nothing to cancel on the free plan.',
  },
  {
    question: 'What if I need more support than setup help?',
    answer: 'For businesses that want closer, ongoing support, there is a Contact us plan. Talk to us and we will work out what you need.',
  },
];

/** How a part of DUMA sits on a plan. Allowances are undecided, so no row names a number. */
export type PlanCell = 'full' | 'allowance' | 'higher';

/** The first group (the basics, free in full) has no heading: it leads the table. */
export const PLAN_COMPARISON: readonly { group?: string; rows: readonly { part: string; free: PlanCell; business: PlanCell }[] }[] = [
  {
    rows: [
      { part: 'Till, orders and payments', free: 'full', business: 'full' },
      { part: 'Products, menu, recipes and margin', free: 'full', business: 'full' },
      { part: 'Stock', free: 'full', business: 'full' },
      { part: 'Customers', free: 'full', business: 'full' },
      { part: 'Rotas, clock-ins and leave', free: 'full', business: 'full' },
      { part: 'Works offline', free: 'full', business: 'full' },
    ],
  },
  {
    group: 'Sell and serve',
    rows: [
      { part: 'Kitchen screen', free: 'allowance', business: 'higher' },
      { part: 'QR ordering', free: 'allowance', business: 'higher' },
      { part: 'Table bookings and waitlist', free: 'allowance', business: 'higher' },
    ],
  },
  {
    group: 'Grow',
    rows: [
      { part: 'Loyalty, promotions and referrals', free: 'allowance', business: 'higher' },
      { part: 'Email and automation', free: 'allowance', business: 'higher' },
      { part: 'Forms', free: 'allowance', business: 'higher' },
      { part: 'Website content (CMS)', free: 'allowance', business: 'higher' },
    ],
  },
  {
    group: 'Insight and tools',
    rows: [
      { part: 'Reports and analytics', free: 'allowance', business: 'higher' },
      { part: 'Ask DUMA, the assistant', free: 'allowance', business: 'higher' },
      { part: 'API, MCP and webhooks', free: 'allowance', business: 'higher' },
    ],
  },
];
