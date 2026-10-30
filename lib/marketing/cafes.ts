import type { ComparisonOption, ListItem } from '@/lib/marketing/solutions';

/**
 * /solutions/cafes — the words for DUMA's first audience: cafés, restaurants
 * and other small food and drink businesses, run by the owner. Pains and claims
 * follow the "DUMA Business Profile" vault note; each feature named here exists
 * in the product today.
 */

/**
 * An example recipe for the margin section. The page runs it through
 * lib/menu/costing.ts — the product's own margin calculation — so the figures
 * on the page are the figures DUMA would show.
 */
export const EXAMPLE_DISH = {
  name: 'Oat flat white',
  price: 3.6,
  ingredients: [
    { name: 'Espresso, double shot', quantity: '18 g', cost: 0.34 },
    { name: 'Oat milk', quantity: '180 ml', cost: 0.27 },
    { name: 'Cup, lid and sleeve', quantity: '1', cost: 0.14 },
  ],
} as const;

/** Seline's "common mistakes", for a café: each a costly habit and what DUMA does about it. */
export const CAFE_MISTAKES: readonly ListItem[] = [
  {
    title: 'Pricing the menu by feel.',
    body: 'Without a recipe cost behind each dish, a price rise on milk or butter quietly eats the margin. DUMA costs every dish from its ingredients and takes VAT out, so you see what you actually keep.',
  },
  {
    title: 'Paying for a different app for every job.',
    body: 'A till app, a rota app, a booking app, an email tool and a spreadsheet for stock — five bills and five logins that never agree. DUMA is one workspace and one bill, with a free plan to start on.',
  },
  {
    title: 'Writing the rota in a group chat.',
    body: 'Shifts get missed and nobody can see what staff cost against the day’s takings. In DUMA the team sees the rota on their phone, clocks in there, and labour cost sits next to sales.',
  },
  {
    title: 'Finding out you’re out of oat milk at 8am.',
    body: 'Stock counted on paper is wrong by the morning rush. Every DUMA sale takes its share off what’s on hand, low items are flagged, and deliveries are checked in against the order you sent.',
  },
  {
    title: 'Letting the till stop when the Wi-Fi does.',
    body: 'A dropped connection shouldn’t mean a queue out of the door. The DUMA till keeps taking orders offline and sends them when the connection is back — nothing is thrown away.',
  },
];

/** Four things a café does with DUMA every week. */
export const CAFE_USE_CASES: readonly ListItem[] = [
  {
    title: 'Price the menu with confidence',
    body: 'See the margin on every dish and drink, VAT included, and spot the ones that cost more to make than they should before you reprint the menu.',
  },
  {
    title: 'Staff the rush, not the quiet hour',
    body: 'See staff cost against takings, and today against a typical same weekday, then move shifts to where the customers actually are.',
  },
  {
    title: 'Never run out mid-service',
    body: 'Low-stock items are flagged as you sell. Order from your suppliers, check the delivery in, and record waste so the numbers stay true.',
  },
  {
    title: 'Bring the regulars back',
    body: 'Every visit builds the customer’s profile. A stamp card or points reward the regulars, and email reaches only the people who opted in.',
  },
];

export const CAFE_SETUP_STEPS: readonly ListItem[] = [
  {
    title: 'Tell DUMA what you run.',
    body: 'Café, bakery, restaurant, bar or food truck — answer a few questions at sign-up and DUMA switches on the parts that fit.',
  },
  {
    title: 'Bring in your menu and team.',
    body: 'Add your dishes, recipes and prices, and invite your staff with the roles they need. We’ll help you do it, for free.',
  },
  {
    title: 'Open the till.',
    body: 'Use any tablet or phone, keep your card machine, and take your first order. Every sale updates stock, customers and reports from then on.',
  },
];

/** Café numbers worth watching — each one DUMA shows. */
export const CAFE_METRICS: readonly ListItem[] = [
  { title: 'Margin per dish', body: 'What each item makes after ingredients and VAT. The number that tells you what to promote and what to reprice.' },
  { title: 'Takings against a typical day', body: 'Today compared with the same weekday in past weeks, so a slow Tuesday is told apart from a bad one.' },
  { title: 'Staff cost against takings', body: 'Labour as a share of sales. The quickest sign the rota and the trade are out of step.' },
  { title: 'Top sellers', body: 'What sold, by quantity and value. Useful for the menu, the specials board and the stock order.' },
  { title: 'Waste and losses', body: 'Logged spoilage and breakage, so stock and margin reflect what really left the kitchen.' },
  { title: 'Average order', body: 'What a typical order is worth. Up-sells and bundles show here first.' },
];

/**
 * The three ways a café usually runs, compared — categories, not named
 * products, so every mark is a fair generalisation rather than a claim about
 * a competitor.
 */
export const CAFE_COMPARISON: readonly ComparisonOption[] = [
  {
    title: 'A card-reader till app',
    summary: 'Good at taking payments. Most of the rest is an add-on, or lives somewhere else.',
    bestFor: 'Taking payments, and not much more',
    rows: [
      { job: 'Till and payments', mark: 'yes' },
      { job: 'Stock and recipe margin', mark: 'part', note: 'Often an add-on' },
      { job: 'Rotas and clock-ins', mark: 'no' },
      { job: 'Loyalty and email', mark: 'part', note: 'Often an add-on' },
      { job: 'Everything in one place', mark: 'no' },
    ],
  },
  {
    title: 'Separate apps for each job',
    summary: 'Each tool can be strong on its own, but none of them share data.',
    bestFor: 'Teams happy to run several logins and bills',
    rows: [
      { job: 'Till and payments', mark: 'yes', note: 'One app' },
      { job: 'Stock and recipe margin', mark: 'yes', note: 'Another app' },
      { job: 'Rotas and clock-ins', mark: 'yes', note: 'Another app' },
      { job: 'Loyalty and email', mark: 'yes', note: 'Two more apps' },
      { job: 'Everything in one place', mark: 'no', note: 'Numbers copied between apps' },
    ],
  },
  {
    title: 'DUMA',
    summary: 'Till, kitchen screen, recipes and margin, stock, rotas, customers and reports in one workspace.',
    bestFor: 'Cafés that want one place and one bill — free to start',
    rows: [
      { job: 'Till and payments', mark: 'yes', note: 'Keep your card machine' },
      { job: 'Stock and recipe margin', mark: 'yes', note: 'VAT-aware' },
      { job: 'Rotas and clock-ins', mark: 'yes' },
      { job: 'Loyalty and email', mark: 'yes' },
      { job: 'Everything in one place', mark: 'yes', note: 'One login, one bill' },
    ],
  },
];

export const CAFE_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Can I keep my card reader?',
    answer:
      'Yes, whichever you have. Square and SumUp connect to DUMA directly. With any other card machine, staff key the amount into it and mark the sale as card in DUMA — it still lands in your reports, and it works offline too. Card fees are charged by your card machine provider, not by DUMA.',
  },
  {
    question: 'What happens if the Wi-Fi goes down mid-rush?',
    answer:
      'The till keeps taking orders. They are saved on the device and sent when the connection is back, and a sale that cannot be sent is kept for you to check rather than thrown away.',
  },
  {
    question: 'Can customers order from their phone?',
    answer: 'Yes. Put your QR code on the tables or the counter; customers open your menu on their phone, order and pay, and the order arrives on the kitchen screen.',
  },
  {
    question: 'How does DUMA work out the margin on a dish?',
    answer:
      'Add a recipe with the ingredients and what each costs. DUMA takes VAT out of the price if you are VAT-registered, then subtracts the ingredients, so the margin is what you actually keep.',
  },
  {
    question: 'Do I need a receipt printer or cash drawer?',
    answer: 'Not to start. Receipts print from the browser today, and dedicated receipt printer and cash drawer support is coming soon.',
  },
  {
    question: 'Can you help me set it up?',
    answer: 'Yes, for free. We help you bring in your menu, recipes, team and settings so you can open on DUMA quickly.',
  },
];
