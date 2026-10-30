import { ClipboardList, CreditCard, Gift, Layers, MapPin, Package, Repeat, Star, Tag, Truck, Users, WifiOff } from '@/components/icons';
import { CustomerMock, OfflineQueueMock, StockMock, VariantStockMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import { SolutionPage, type SolutionContent, solutionMetadata } from '@/components/marketing/SolutionPage';

/**
 * /solutions/retail — DUMA for in-store retail: gift shops, delis, boutiques,
 * homeware. Claims checked against duma-api: stock per location and per size
 * and colour, stock transfers, stocktakes with counted quantities, suppliers
 * and purchase orders, customers found or scanned (their QR) at the till,
 * loyalty and promo codes with limits. The till does NOT scan product
 * barcodes — its camera scans customers' QR codes — so that is never claimed.
 * Online selling is /solutions/shops.
 */

const content: SolutionContent = {
  path: '/solutions/retail',
  breadcrumb: 'Retail',
  metaTitle: 'Retail POS and Stock Management for Small Shops, Free to Start | DUMA',
  description:
    'Retail software for small shops: a till on any tablet that works offline, stock by size, colour and location, stocktakes, supplier orders, customers and loyalty. Free plan, no card needed.',
  hero: {
    lead: 'Retail software for',
    mark: 'your shop floor',
    subtitle: 'A till on any tablet, stock by size, colour and location, stocktakes and supplier orders, customers and loyalty — in one place, next to the card machine you have.',
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
    caption: 'An example product. Amber is running low; red is sold out.',
  },
  mistakes: {
    title: 'Five things that quietly cost a shop money',
    items: [
      { title: 'Counting stock once a year.', body: 'By stocktake day the numbers are fiction. In DUMA every sale updates stock, and a stocktake records what you count against what it expected.' },
      { title: 'Not knowing who your customers are.', body: 'A sale with no name can’t be thanked or invited back. Find the customer at the till, or scan the QR on their loyalty card.' },
      { title: 'Reordering by guesswork.', body: 'Too much of what doesn’t sell, too little of what does. Low stock is flagged as you sell, and purchase orders go to suppliers from DUMA.' },
      { title: 'Stock stuck in the wrong shop.', body: 'One shop sold out, the other has six. A stock transfer in DUMA moves them, and both counts stay right.' },
      { title: 'Discounts that never end.', body: 'A code shared once and used forever costs margin. DUMA’s promo codes have dates and limits, and are honoured at the till.' },
    ],
  },
  how: {
    title: 'How DUMA runs a shop',
    intro: (
      <p>
        One workspace for the counter and the stock room: <Mark>a till that sells anywhere</Mark>, stock you can trust in every location, and customers who come
        back.
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
    title: 'Four things shops do with DUMA every week',
    lead: [
      'Whether you run a gift shop, a deli, a boutique or a homeware store, these are the jobs DUMA takes off your list.',
      'Start with the one you need most. The rest is already in the same workspace, with nothing to move when you’re ready.',
    ],
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
        Retail software should keep the till, the shelves and the customer list telling the same story. If stock only changes on stocktake day, it’s wrong for the
        other 364. If customers stay anonymous, you can’t invite them back.
      </p>
    ),
    setupTitle: 'How to set up DUMA in a shop',
    steps: [
      { title: 'Tell DUMA what you sell.', body: 'Products in a shop, with or without sizes and colours — answer a few questions at sign-up and DUMA switches on the parts that fit.' },
      { title: 'Bring in your products and stock.', body: 'Add products with their variants, prices and opening stock in each location. We’ll help you do it, for free.' },
      { title: 'Open the till.', body: 'Use any tablet or phone, keep your card machine, and take your first sale. Stock, customers and reports update from then on.' },
    ],
    metricsTitle: 'Shop numbers worth watching',
    metrics: [
      { title: 'Stock by location', body: 'What’s in each shop or store room, so a transfer fixes a gap before a customer finds it.' },
      { title: 'Stock by size and colour', body: 'What’s left of every variant. The sizes that run out first are the ones to reorder deeper.' },
      { title: 'Stocktake differences', body: 'What you counted against what DUMA expected. Small, steady differences point at shrinkage or mistakes at the till.' },
      { title: 'Top sellers', body: 'What sold, by quantity and value. Useful for reorders, the window and the counter.' },
      { title: 'Repeat customers', body: 'Who came back, and how often. The clearest sign loyalty is working.' },
      { title: 'Promotion use', body: 'How often each code is redeemed, against its limit. Codes nobody uses can come down.' },
    ],
    metricIcons: [MapPin, Tag, ClipboardList, Star, Repeat, Gift],
    comparisonTitle: 'A card-reader app, a spreadsheet,',
    comparisonHighlight: 'or one system',
    comparisonLead: 'Three ways most small shops run. Here is what each one covers.',
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
          { job: 'Everything in one place', mark: 'no' },
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
          { job: 'Everything in one place', mark: 'no', note: 'Numbers copied across' },
        ],
      },
      {
        title: 'DUMA',
        summary: 'Till, stock by size, colour and location, stocktakes, supplier orders, customers and loyalty in one workspace.',
        bestFor: 'Shops that want one place and one bill — free to start',
        rows: [
          { job: 'Till and payments', mark: 'yes', note: 'Keep your card machine' },
          { job: 'Stock by size, colour and location', mark: 'yes', note: 'With transfers' },
          { job: 'Stocktakes and supplier orders', mark: 'yes' },
          { job: 'Loyalty and promotions', mark: 'yes' },
          { job: 'Everything in one place', mark: 'yes', note: 'One login, one bill' },
        ],
      },
    ],
    comparisonIcons: [CreditCard, Layers],
  },
  setupBand: { title: 'Open your shop on DUMA.', body: 'Bring your products, sizes and stock across — we’ll help you set it up, for free.' },
  faqTitle: 'Questions shops ask',
  faqs: [
    { question: 'Can I run more than one shop?', answer: 'Yes. Each location has its own stock and reports, you can see the whole business together, and stock moves between shops with a transfer.' },
    { question: 'Does the till scan barcodes?', answer: 'Not product barcodes yet — products are picked by category on the till. The camera scans customers’ loyalty QR codes, to attach them to a sale.' },
    { question: 'How do stocktakes work?', answer: 'Start a stocktake, record what you count, and DUMA compares it with what it expected. When you complete it, stock is set to what you counted.' },
    { question: 'Can I sell online too?', answer: 'Yes. A website built on DUMA’s storefront API shares the same stock and customers as the till. See DUMA for shops and online stores.' },
    { question: 'Can I keep my card machine?', answer: 'Yes. Square and SumUp connect to DUMA directly. With any other card machine, key the amount in and mark the sale as card — it still lands in your reports.' },
    { question: 'What happens if the Wi-Fi goes down?', answer: 'The till keeps taking sales. They are saved on the device and sent when the connection is back, and a sale that cannot be sent is kept for you to check.' },
  ],
  closing: { title: 'The one place to run your shop.', muted: 'One simple bill, or none at all.', body: 'Get started in minutes, completely free. No card required, and we’re here to help you every step of the way.' },
};

export const metadata = solutionMetadata(content);

export default function RetailPage() {
  return <SolutionPage content={content} />;
}
