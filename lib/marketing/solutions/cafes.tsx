import { BarChart3, CalendarDays, ChefHat, CreditCard, Gift, Layers, LineChart, Package, QrCode, Receipt, Star, Trash2, Users, WifiOff } from '@/components/icons';
import { CustomerMock, KitchenMock, MarginMock, OfflineQueueMock, QrMock, RotaMock, StockMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import type { SolutionContent } from '@/components/marketing/SolutionPage';

import { AUDIENCE_LINKS, type ComparisonOption, type ListItem } from '@/lib/marketing/solutions';

/**
 * /solutions/cafes — the words for DUMA's first audience: cafés, restaurants
 * and other small food and drink businesses, run by the owner. Pains and claims
 * follow the "DUMA Business Profile" vault note; each feature named here exists
 * in the product today. Data in the mocks is an example and is labelled as one.
 */

/** Seline's "common mistakes", for a café: each a costly habit and what DUMA does about it. */
const CAFE_MISTAKES: readonly ListItem[] = [
  {
    title: 'Pricing the menu by feel.',
    body: 'Without a recipe cost behind each dish, a price rise on milk or butter quietly eats the margin. DUMA costs every dish from its ingredients and takes VAT out, so you see what you actually keep.',
  },
  {
    title: 'Paying for a different app for every job.',
    body: 'A till app, a rota app, a booking app, an email tool and a spreadsheet for stock — five bills and five logins that never agree. DUMA is one workspace and one login, with a free plan to start on.',
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
const CAFE_USE_CASES: readonly ListItem[] = [
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

const CAFE_SETUP_STEPS: readonly ListItem[] = [
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
const CAFE_METRICS: readonly ListItem[] = [
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
const CAFE_COMPARISON: readonly ComparisonOption[] = [
  {
    title: 'A card-reader till app',
    summary: 'Good at taking payments. Most of the rest is an add-on, or lives somewhere else.',
    bestFor: 'Taking payments, and not much more',
    rows: [
      { job: 'Till and payments', mark: 'yes' },
      { job: 'Stock and recipe margin', mark: 'part', note: 'Often an add-on' },
      { job: 'Rotas and clock-ins', mark: 'no' },
      { job: 'Loyalty and email', mark: 'part', note: 'Often an add-on' },
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
    ],
  },
  {
    title: 'DUMA',
    summary: 'Till, kitchen screen, recipes and margin, stock, rotas, customers and reports in one workspace.',
    bestFor: 'Cafés that want everything in one place — free to start',
    rows: [
      { job: 'Till and payments', mark: 'yes', note: 'Keep your card machine' },
      { job: 'Stock and recipe margin', mark: 'yes', note: 'VAT-aware' },
      { job: 'Rotas and clock-ins', mark: 'yes' },
      { job: 'Loyalty and email', mark: 'yes' },
    ],
  },
];

const CAFE_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Can I keep my card reader?',
    answer:
      'Yes, whichever you have. Square, SumUp and Stripe connect to DUMA directly. With any other card machine, staff key the amount into it and mark the sale as card in DUMA — it still lands in your reports, and it works offline too. Card fees are charged by your card machine provider, not by DUMA.',
  },
  {
    question: 'Does the café EPOS keep working if the Wi-Fi goes down mid-rush?',
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
    answer:
      'Not to start. Receipts print from any tablet, phone or laptop through its own print dialog, AirPrint on iPad. If you have a cash drawer, it can open by itself after a cash payment, through a receipt printer connected with QZ Tray on a Windows, Mac or Linux till, or an Epson network printer on an iPad or computer.',
  },
  {
    question: 'Can you help me set it up?',
    answer: 'Yes, for free. We help you bring in your menu, recipes, team and settings so you can open on DUMA quickly.',
  },
];

export const CAFES: SolutionContent = {
  path: '/solutions/cafes',
  breadcrumb: 'Cafés and restaurants',
  metaTitle: 'Café EPOS and Restaurant Software UK, Free to Start | DUMA',
  description:
    'A café and restaurant EPOS that works offline, with QR ordering, a kitchen screen, recipe margin, stock and rotas. Keep your card machine. Free plan.',
  hero: {
    lead: (
      <>
        Café and restaurant software <br className="hidden sm:inline" />
        that runs
      </>
    ),
    mark: 'the whole day',
    subtitle:
      'An EPOS for UK cafés and restaurants, with the kitchen screen, QR ordering, recipes and margin, stock, rotas and loyalty — in one place, on the tablet and card machine you already have.',
    ticks: ['Free plan, forever', 'Keep your card machine', 'Works offline'],
    tabs: ['pos', 'dashboard', 'orders', 'customers'],
  },
  teaser: {
    title: 'Know what every dish makes you.',
    intro: (
      <p>
        Add a recipe once. DUMA costs it from your ingredients, takes VAT out of the price if you’re registered, and shows the margin you{' '}
        <Mark>really keep</Mark> — on the menu, in the reports and on every sale.
      </p>
    ),
    visual: <MarginMock bleed={false} />,
    caption: 'An example recipe for a VAT-registered café, worked out by DUMA’s own costing.',
  },
  mistakes: { title: 'Five things that quietly cost a café money', items: CAFE_MISTAKES },
  how: {
    title: 'How DUMA runs a café, from the EPOS to the rota',
    intro: (
      <p>
        One workspace for the counter, the kitchen and the back office: a <Mark>till that never stops</Mark>, a screen for the kitchen, recipes with real
        margin, stock that counts itself down, rotas on your team’s phones and a reason for regulars to come back.
      </p>
    ),
    cards: [
      { icon: WifiOff, tone: 'stock', tag: 'free in full', title: 'A till that works offline', body: 'Sell on any tablet or phone. When the Wi-Fi drops, orders queue on the device and send themselves when it’s back.', visual: <OfflineQueueMock /> },
      { icon: ChefHat, tone: 'orders', tag: 'included', title: 'Kitchen screen', body: 'Every order lands on a screen in the kitchen — new, preparing, ready — whether it came from the till or a QR code.', visual: <KitchenMock /> },
      { icon: BarChart3, tone: 'reference', tag: 'free in full', title: 'Recipes and margin', body: 'Cost each dish from its ingredients and see what you keep after VAT, on the menu and in the reports.', visual: <MarginMock /> },
      { icon: CalendarDays, tone: 'team', tag: 'free in full', title: 'Rotas and time', body: 'Your team sees the rota on their phone, clocks in there and asks for leave there — with staff cost next to sales.', visual: <RotaMock /> },
      { icon: Package, tone: 'stock', tag: 'free in full', title: 'Stock', body: 'Every sale takes its share off what’s on hand. Low items are flagged; deliveries are checked in against the order.', visual: <StockMock /> },
      { icon: QrCode, tone: 'orders', tag: 'included', title: 'QR ordering', body: 'Customers scan, order and pay from their own phone, and the order goes straight to the kitchen screen.', visual: <QrMock /> },
      { icon: Users, tone: 'orders', tag: 'included', title: 'Customers and loyalty', body: 'Every visit builds the customer’s profile. Stamp cards and points reward the regulars; email reaches only those who opted in.', visual: <CustomerMock />, wide: true },
    ],
  },
  useCases: { title: 'Four things cafés do with DUMA every week', items: CAFE_USE_CASES, icons: [Receipt, CalendarDays, Package, Gift] },
  explainer: {
    title: 'What café software should do, and how to set it up',
    intro: <p>Café software should connect what happens at the counter to what happens in the kitchen, the stockroom and the bank.</p>,
    setupTitle: 'How to set up DUMA in a café',
    steps: CAFE_SETUP_STEPS,
    metricsTitle: 'Café numbers worth watching',
    metrics: CAFE_METRICS,
    /** One per CAFE_METRICS entry, in order: margin, takings vs typical day, staff cost, top sellers, waste, average order. */
    metricIcons: [BarChart3, LineChart, Users, Star, Trash2, Receipt],
    comparisonTitle: 'A card-reader app, separate apps,',
    comparisonHighlight: 'or one system',
    comparison: CAFE_COMPARISON,
    /** Card-reader app, separate apps — DUMA's own entry shows the logo instead. */
    comparisonIcons: [CreditCard, Layers],
  },
  setupBand: { title: 'Open tomorrow on DUMA.', body: 'Tell DUMA what you run and bring your menu across — we’ll help you set it up, for free.' },
  faqTitle: 'Questions cafés ask',
  faqs: CAFE_FAQS,
  closing: { title: 'The one place to run your café.' },
  related: { audiences: [AUDIENCE_LINKS.bakeries, AUDIENCE_LINKS.bars], terms: ['recipe-costing', 'food-cost-percentage', 'staff-rota', 'epos'] },
};
