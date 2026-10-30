import { BarChart3, ClipboardList, CreditCard, Layers, LineChart, Package, Receipt, Star, Trash2, WifiOff } from '@/components/icons';
import { type CostedItem, MarginMock, OfflineQueueMock, StockMock, WasteMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import { SolutionPage, type SolutionContent, solutionMetadata } from '@/components/marketing/SolutionPage';

/**
 * /solutions/bakeries — DUMA for bakeries. Claims checked against duma-api and
 * this repo: per-item VAT rates (bread is zero-rated; lib/menu/costing.ts),
 * the loss log (loss-log.ts), stock, suppliers and purchase orders, phone and
 * collection order channels, the offline till. The demand forecast exists in
 * the API but has no screen yet, so it is not mentioned.
 */

const SOURDOUGH: CostedItem = {
  name: 'Sourdough loaf',
  price: 5.2,
  vatRate: 0,
  ingredients: [
    { name: 'Flour', quantity: '500 g', cost: 0.42 },
    { name: 'Starter, water and salt', quantity: '1', cost: 0.05 },
    { name: 'Paper bag', quantity: '1', cost: 0.09 },
  ],
};

const content: SolutionContent = {
  path: '/solutions/bakeries',
  breadcrumb: 'Bakeries',
  metaTitle: 'Bakery POS, Recipe Costing and Waste Tracking, Free to Start | DUMA',
  description:
    'Bakery software: recipe costing with the right VAT on every bake, waste tracking, stock and supplier orders, phone orders for collection and a till that works offline. Free plan, no card needed.',
  hero: {
    lead: 'Bakery software that knows',
    mark: 'what every bake makes',
    subtitle: 'Recipes and margin, waste, stock and supplier orders, orders for collection and a till that works offline — in one place, on the tablet you already have.',
    ticks: ['Free plan, forever', 'Recipes and waste', 'Works offline'],
    tabs: ['pos', 'dashboard', 'orders', 'customers'],
  },
  teaser: {
    title: 'Cost every bake, with the VAT done right.',
    intro: (
      <p>
        Bread is zero-rated, cakes and hot food are not. Set the rate on each item and DUMA works out the margin <Mark>you actually keep</Mark> — on the menu, in
        the reports and on every sale.
      </p>
    ),
    visual: <MarginMock bleed={false} item={SOURDOUGH} />,
    caption: 'An example loaf. Bread is zero-rated, so no VAT comes out of the price.',
  },
  mistakes: {
    title: 'Five things that quietly cost a bakery money',
    items: [
      { title: 'Pricing bakes by feel.', body: 'Flour and butter go up, the price on the board doesn’t. DUMA costs every bake from its recipe, with the right VAT rate on each item.' },
      { title: 'Binning the margin at close.', body: 'Unsold bakes are money in the bin, and nobody adds it up. Log waste in DUMA and see what it costs, every day.' },
      { title: 'Running out of butter mid-bake.', body: 'Stock counted by eye is wrong by morning. Every sale takes its share off what’s on hand, low items are flagged, and supplier orders are checked in on arrival.' },
      { title: 'Taking orders on scraps of paper.', body: 'A birthday cake ordered by phone shouldn’t live on a sticky note. Take phone and collection orders in DUMA, beside everything else.' },
      { title: 'Letting the till stop with the Wi-Fi.', body: 'A dropped connection at the morning rush shouldn’t mean a queue out the door. The DUMA till keeps taking orders and sends them later.' },
    ],
  },
  how: {
    title: 'How DUMA runs a bakery',
    intro: (
      <p>
        One workspace for the counter, the bakehouse and the stock room: <Mark>recipes with real margin</Mark>, waste you can see, stock that counts itself down and a
        till that never stops.
      </p>
    ),
    cards: [
      { icon: BarChart3, tone: 'reference', tag: 'free in full', title: 'Recipes and margin', body: 'Cost every bake from its ingredients, with the right VAT rate on each item, and see what you keep.', visual: <MarginMock item={SOURDOUGH} /> },
      { icon: Trash2, tone: 'orders', tag: 'included', title: 'Waste and losses', body: 'Log unsold bakes and out-of-date stock at close, valued at cost, so stock and margin stay true.', visual: <WasteMock /> },
      { icon: Package, tone: 'stock', tag: 'free in full', title: 'Stock and suppliers', body: 'Every sale takes its share off what’s on hand. Order from suppliers and check deliveries in against the order.', visual: <StockMock /> },
      { icon: WifiOff, tone: 'stock', tag: 'free in full', title: 'A till that works offline', body: 'Sell on any tablet or phone. When the Wi-Fi drops, orders queue on the device and send themselves later.', visual: <OfflineQueueMock /> },
    ],
  },
  useCases: {
    title: 'Four things bakeries do with DUMA every week',
    lead: [
      'Whether you run a high-street bakery, a patisserie or a market stall, these are the jobs DUMA takes off your early mornings.',
      'Start with the one you need most. The rest is already in the same workspace, with nothing to move when you’re ready.',
    ],
    items: [
      { title: 'Price every bake properly', body: 'See the margin on every loaf, pastry and cake, with zero-rated and standard-rated items each handled right.' },
      { title: 'Bake to what sells', body: 'Check what sold yesterday and on a typical same weekday before deciding how much to bake today.' },
      { title: 'Cut the waste', body: 'Log what’s left at close and see what it cost. The bakes that come back every day are the ones to make fewer of.' },
      { title: 'Take orders for collection', body: 'Phone and collection orders sit with the rest of the day’s orders, so nothing is forgotten at pick-up time.' },
    ],
    icons: [BarChart3, LineChart, Trash2, ClipboardList],
  },
  explainer: {
    title: 'What bakery software should do, and how to set it up',
    intro: (
      <p>
        Bakery software should connect what you bake to what you sell and what you throw away. If you only look at takings, you can’t see the waste. If you only look
        at waste, you can’t see which bakes earn their place.
      </p>
    ),
    setupTitle: 'How to set up DUMA in a bakery',
    steps: [
      { title: 'Tell DUMA what you run.', body: 'Bakery, patisserie or market stall — answer a few questions at sign-up and DUMA switches on the parts that fit.' },
      { title: 'Bring in your bakes and recipes.', body: 'Add your bakes with their recipes, prices and VAT rates, and your suppliers. We’ll help you do it, for free.' },
      { title: 'Open the till.', body: 'Use any tablet or phone, keep your card machine, and take your first order. Stock, waste and reports update from then on.' },
    ],
    metricsTitle: 'Bakery numbers worth watching',
    metrics: [
      { title: 'Margin per bake', body: 'What each item makes after ingredients and the right VAT. The number that tells you what to bake more of.' },
      { title: 'Waste and losses', body: 'What was logged as unsold or out of date, valued at cost — day by day.' },
      { title: 'Takings against a typical day', body: 'Today compared with the same weekday in past weeks, so a slow Wednesday is told apart from a bad one.' },
      { title: 'Top sellers', body: 'What sold, by quantity and value. The first thing to check before tomorrow’s bake.' },
      { title: 'Stock to reorder', body: 'Ingredients running low, flagged as you sell, before the next supplier order.' },
      { title: 'Average order', body: 'What a typical order is worth. Coffee-and-pastry deals show here first.' },
    ],
    metricIcons: [BarChart3, Trash2, LineChart, Star, Package, Receipt],
    comparisonTitle: 'A card-reader app, a spreadsheet,',
    comparisonHighlight: 'or one system',
    comparisonLead: 'Three ways most bakeries run. Here is what each one covers.',
    comparison: [
      {
        title: 'A card-reader till app',
        summary: 'Good at taking payments. Recipe costing, waste and stock usually live somewhere else.',
        bestFor: 'Taking payments, and not much more',
        rows: [
          { job: 'Till and payments', mark: 'yes' },
          { job: 'Recipe costing and margin', mark: 'part', note: 'Often an add-on' },
          { job: 'Waste tracking', mark: 'no' },
          { job: 'Stock and supplier orders', mark: 'part', note: 'Often an add-on' },
          { job: 'Everything in one place', mark: 'no' },
        ],
      },
      {
        title: 'A till plus a spreadsheet',
        summary: 'Flexible, and free — until the spreadsheet is a week out of date and only one person understands it.',
        bestFor: 'One baker who enjoys spreadsheets',
        rows: [
          { job: 'Till and payments', mark: 'yes', note: 'The till app' },
          { job: 'Recipe costing and margin', mark: 'part', note: 'By hand' },
          { job: 'Waste tracking', mark: 'part', note: 'By hand' },
          { job: 'Stock and supplier orders', mark: 'part', note: 'By hand' },
          { job: 'Everything in one place', mark: 'no', note: 'Numbers copied across' },
        ],
      },
      {
        title: 'DUMA',
        summary: 'Till, recipes and margin, waste, stock and supplier orders and reports in one workspace.',
        bestFor: 'Bakeries that want one place and one bill — free to start',
        rows: [
          { job: 'Till and payments', mark: 'yes', note: 'Keep your card machine' },
          { job: 'Recipe costing and margin', mark: 'yes', note: 'VAT rate per item' },
          { job: 'Waste tracking', mark: 'yes', note: 'Valued at cost' },
          { job: 'Stock and supplier orders', mark: 'yes' },
          { job: 'Everything in one place', mark: 'yes', note: 'One login, one bill' },
        ],
      },
    ],
    comparisonIcons: [CreditCard, Layers],
  },
  setupBand: { title: 'Open tomorrow morning on DUMA.', body: 'Bring your bakes, recipes and suppliers across — we’ll help you set it up, for free.' },
  faqTitle: 'Questions bakeries ask',
  faqs: [
    { question: 'Does DUMA handle zero-rated items like bread?', answer: 'Yes. Set the VAT rate on each item — 0% for most bread, the standard rate for hot food and cakes where it applies — and DUMA uses it in every margin.' },
    { question: 'How do I track waste?', answer: 'Log unsold bakes and out-of-date stock as they go. DUMA values them at cost, takes them off stock and shows what they cost you.' },
    { question: 'Can I take orders for collection?', answer: 'Yes. Phone and collection orders sit with the rest of the day’s orders, so they are ready when the customer arrives.' },
    { question: 'Can I order from my suppliers in DUMA?', answer: 'Yes. Raise purchase orders to your suppliers and check deliveries in against them, so stock goes up by what actually arrived.' },
    { question: 'Can I keep my card machine?', answer: 'Yes. Square and SumUp connect to DUMA directly. With any other card machine, key the amount in and mark the sale as card — it still lands in your reports.' },
    { question: 'Can you help me set it up?', answer: 'Yes, for free. We help you bring in your bakes, recipes and suppliers so you can open on DUMA quickly.' },
  ],
  closing: { title: 'The one place to run your bakery.', muted: 'One simple bill, or none at all.', body: 'Get started in minutes, completely free. No card required, and we’re here to help you every step of the way.' },
};

export const metadata = solutionMetadata(content);

export default function BakeriesPage() {
  return <SolutionPage content={content} />;
}
