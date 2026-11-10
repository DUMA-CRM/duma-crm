import { ClipboardList, CreditCard, Layers, MapPin, Package, Repeat, Star, Tag, Truck, Users, WifiOff } from '@/components/icons';
import { CustomerMock, OfflineQueueMock, StockMock, VariantStockMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import { SolutionPage, type SolutionContent, solutionMetadata } from '@/components/marketing/SolutionPage';

import { AUDIENCE_LINKS } from '@/lib/marketing/solutions';

/**
 * /solutions/retail — DUMA for in-store retail run across more than one shop or
 * stock room: gift shops, delis, homeware, independents. Its subject is the
 * stock room — locations, transfers, stocktakes, supplier orders — so it stays
 * apart from /solutions/shops (clothing, online stores, pop-ups). Claims checked against duma-api: stock per location and per size
 * and colour, stock transfers, stocktakes with counted quantities, suppliers
 * and purchase orders, customers found or scanned (their QR) at the till,
 * loyalty and promo codes with limits. The till does NOT scan product
 * barcodes — its camera scans customers' QR codes — so that is never claimed.
 * Online selling is /solutions/shops.
 */

const content: SolutionContent = {
  path: '/solutions/retail',
  breadcrumb: 'Retail',
  metaTitle: 'Retail EPOS and Stock Control for Small UK Shops | DUMA',
  description:
    'A till on any tablet that works offline, stock in every location, stocktakes, transfers and supplier orders. Free plan, no card needed.',
  hero: {
    lead: 'Retail software for',
    mark: 'your shop floor',
    subtitle: 'A retail EPOS for independent UK shops, with stock counted in every location, stocktakes, transfers and supplier orders — in one place, next to the card machine you have.',
    ticks: ['Free plan, forever', 'Stock in every location', 'Works offline'],
    tabs: ['pos', 'customers', 'orders', 'dashboard'],
  },
  teaser: {
    title: 'Know what’s on the shelf, in every shop.',
    intro: (
      <p>
        Every product, size and colour has its own count in each location. Every sale takes from it, and <Mark>a transfer moves stock</Mark> to the shop that’s
        selling it.
      </p>
    ),
    visual: <VariantStockMock bleed={false} />,
    caption: 'An example product, counted size by size. Amber needs reordering; red is sold out.',
  },
  mistakes: {
    title: 'Five stock mistakes that cost a retailer money',
    items: [
      { title: 'Counting stock once a year.', body: 'By stocktake day the numbers are fiction. In DUMA every sale updates stock, and a stocktake records what you count against what it expected.' },
      { title: 'Checking deliveries by eye.', body: 'A short delivery gets paid for in full. In DUMA a delivery is checked in against its purchase order, so stock goes up by what actually arrived.' },
      { title: 'Reordering by guesswork.', body: 'Too much of what doesn’t sell, too little of what does. Low stock is flagged as you sell, and purchase orders go to suppliers from DUMA.' },
      { title: 'Stock stuck in the wrong shop.', body: 'One shop sold out, the other has six. A stock transfer in DUMA moves them, and both counts stay right.' },
      { title: 'Not knowing where stock goes.', body: 'Small, steady gaps between the shelf and the system are shrinkage or mistakes at the till. A stocktake in DUMA records each difference, so you can see where it starts.' },
    ],
  },
  how: {
    title: 'A retail EPOS with stock you can trust in every shop',
    intro: (
      <p>
        One workspace for the counter and the stock room: a till that sells anywhere, <Mark>stock you can trust in every location</Mark>, and supplier orders
        checked in against what arrived.
      </p>
    ),
    cards: [
      { icon: Tag, tone: 'stock', tag: 'free in full', title: 'Stock by size and colour', body: 'Every variant has its own count, per location. Low sizes are flagged as you sell.', visual: <VariantStockMock /> },
      { icon: ClipboardList, tone: 'stock', tag: 'free in full', title: 'Stocktakes and reorders', body: 'Count the shelves against what DUMA expects, and order from suppliers when stock runs low.', visual: <StockMock /> },
      { icon: Users, tone: 'orders', tag: 'included', title: 'Customers and loyalty', body: 'Find a customer at the till or scan their loyalty QR. Points or stamps reward the regulars.', visual: <CustomerMock /> },
      { icon: WifiOff, tone: 'stock', tag: 'free in full', title: 'A till that works offline', body: 'Sell on any tablet or phone. When the Wi-Fi drops, sales queue on the device and send themselves later.', visual: <OfflineQueueMock /> },
    ],
  },
  useCases: {
    title: 'Four stock jobs retailers do in DUMA every week',
    items: [
      { title: 'Count stock without closing', body: 'Run a stocktake section by section. DUMA records what you counted against what it expected, and the difference.' },
      { title: 'Move stock to where it sells', body: 'Transfer stock between shops in a few taps, so the shop that’s selling a line never runs out while another holds it.' },
      { title: 'Recognise regulars at the till', body: 'Search by name, phone or email, or scan the customer’s loyalty QR. Their history and rewards come with them.' },
      { title: 'Order from suppliers', body: 'Raise purchase orders from DUMA and check deliveries in against them, so stock goes up by what actually arrived.' },
    ],
    icons: [ClipboardList, Truck, Users, Package],
  },
  explainer: {
    title: 'What retail software should do, and how to set it up',
    intro: (
      <p>
        Retail software should keep the till, the shelves and the customer list telling the same story.
      </p>
    ),
    setupTitle: 'How to set up DUMA across your shops',
    steps: [
      { title: 'Add your locations.', body: 'Each shop or stock room is a location, with its own stock and reports. Answer a few questions at sign-up and DUMA switches on the parts that fit.' },
      { title: 'Bring in your products, stock and suppliers.', body: 'Add products with their prices and opening stock in each location, and the suppliers you order from. We’ll help you do it, for free.' },
      { title: 'Open the till.', body: 'Use any tablet or phone, keep your card machine, and take your first sale. Stock, customers and reports update from then on.' },
    ],
    metricsTitle: 'Stock numbers worth watching',
    metrics: [
      { title: 'Stock in each location', body: 'What each shop and stock room holds, so stock is moved before one of them runs out.' },
      { title: 'Stocktake differences', body: 'What you counted against what DUMA expected. Small, steady differences point at shrinkage or mistakes at the till.' },
      { title: 'Low stock', body: 'Items flagged as running low as you sell, before the next supplier order.' },
      { title: 'Deliveries against orders', body: 'What arrived against the purchase order, so a short delivery is caught when it’s checked in.' },
      { title: 'Stock transfers', body: 'What moved between your shops, so both counts stay right.' },
      { title: 'Top sellers', body: 'What sold, by quantity and value. Useful for the next supplier order.' },
    ],
    metricIcons: [MapPin, ClipboardList, Package, Truck, Repeat, Star],
    comparisonTitle: 'A card-reader app, a spreadsheet,',
    comparisonHighlight: 'or one system',
    comparison: [
      {
        title: 'A card-reader till app',
        summary: 'Good at taking payments. Variants, multi-shop stock and loyalty are often limited or extra.',
        bestFor: 'Taking payments, and not much more',
        rows: [
          { job: 'Till and payments', mark: 'yes' },
          { job: 'Stock by size, colour and location', mark: 'part', note: 'Often limited' },
          { job: 'Stocktakes and supplier orders', mark: 'part', note: 'Often an add-on' },
          { job: 'Loyalty and promotions', mark: 'part', note: 'Often an add-on' },
        ],
      },
      {
        title: 'A till plus a spreadsheet',
        summary: 'Flexible — until the spreadsheet is a week behind the shelves and only one person trusts it.',
        bestFor: 'One shop with a small range',
        rows: [
          { job: 'Till and payments', mark: 'yes', note: 'The till app' },
          { job: 'Stock by size, colour and location', mark: 'part', note: 'By hand' },
          { job: 'Stocktakes and supplier orders', mark: 'part', note: 'By hand' },
          { job: 'Loyalty and promotions', mark: 'no' },
        ],
      },
      {
        title: 'DUMA',
        summary: 'Till, stock by size, colour and location, stocktakes, supplier orders, customers and loyalty in one workspace.',
        bestFor: 'Shops with stock in more than one place — free to start',
        rows: [
          { job: 'Till and payments', mark: 'yes', note: 'Keep your card machine' },
          { job: 'Stock by size, colour and location', mark: 'yes', note: 'With transfers' },
          { job: 'Stocktakes and supplier orders', mark: 'yes' },
          { job: 'Loyalty and promotions', mark: 'yes' },
        ],
      },
    ],
    comparisonIcons: [CreditCard, Layers],
  },
  setupBand: { title: 'Count your stock on DUMA.', body: 'Bring your products, locations and suppliers across — we’ll help you set it up, for free.' },
  faqTitle: 'Questions retailers ask',
  faqs: [
    { question: 'Can I run more than one shop?', answer: 'Yes. Each location has its own stock and reports, you can see the whole business together, and stock moves between shops with a transfer.' },
    { question: 'Does the till scan barcodes?', answer: 'Not product barcodes yet — products are picked by category on the till. The camera scans customers’ loyalty QR codes, to attach them to a sale.' },
    { question: 'How do stocktakes work?', answer: 'Start a stocktake, record what you count, and DUMA compares it with what it expected. When you complete it, stock is set to what you counted.' },
    { question: 'Can I order from my suppliers in DUMA?', answer: 'Yes. Raise purchase orders to your suppliers and check each delivery in against its order, so stock goes up by what actually arrived.' },
    { question: 'Can I sell online too?', answer: 'Yes. A website built on DUMA’s storefront API shares the same stock and customers as the till. See DUMA for shops and online stores.' },
    { question: 'Can I keep my card machine?', answer: 'Yes. Square, SumUp and Stripe connect to DUMA directly. With any other card machine, key the amount in and mark the sale as card — it still lands in your reports.' },
    { question: 'Does the retail EPOS keep working if the Wi-Fi goes down?', answer: 'Yes, the till keeps taking sales. They are saved on the device and sent when the connection is back, and a sale that cannot be sent is kept for you to check.' },
  ],
  closing: { title: 'The one place to run your shops.' },
  related: { audiences: [AUDIENCE_LINKS.shops, AUDIENCE_LINKS.bakeries, AUDIENCE_LINKS.cafes], terms: ['stocktake', 'stock-variance', 'purchase-order', 'par-level'] },
};

export const metadata = solutionMetadata(content);

export default function RetailPage() {
  return <SolutionPage content={content} />;
}
