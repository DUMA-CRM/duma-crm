import type { ComparisonOption, ListItem } from '@/lib/marketing/solutions';

/**
 * /solutions/shops — DUMA for its second audience: clothing shops, online
 * stores and small product sellers, in a shop, online or both.
 *
 * The honest shape of the online offer (checked against duma-api): DUMA has no
 * hosted storefront yet and no Shopify connection. Online selling runs through
 * the storefront API (`/v1/store`: products with sizes and colours, stock,
 * categories, languages, the shopper's currency, order quotes and orders,
 * newsletter sign-ups, referral codes, forms), so a site built on it shares one
 * stock and one customer list with the till. A site that keeps its own
 * platform keeps its own stock there. Say exactly that, and no more.
 */

export const SHOP_MISTAKES: readonly ListItem[] = [
  {
    title: 'Counting sizes on a spreadsheet.',
    body: 'A medium sells in the shop, the website still shows it in stock, and someone is disappointed. In DUMA every size and colour has its own count, and every sale takes from it.',
  },
  {
    title: 'Paying for an app for every feature.',
    body: 'Loyalty, reviews, pop-ups, email, forms — each one another monthly bill on top of the platform. DUMA has them in the same workspace, with a free plan to start on.',
  },
  {
    title: 'Keeping customers in three places.',
    body: 'Some in the store’s admin, some in Instagram messages, some in a spreadsheet. In DUMA every order and visit builds one customer profile, wherever they bought.',
  },
  {
    title: 'Selling at a pop-up with a notebook.',
    body: 'Markets and pop-ups shouldn’t need a second system. Open the DUMA till on the phone or tablet you have, sell from the same stock, and keep selling if the signal drops.',
  },
  {
    title: 'Sending the same offer to everyone.',
    body: 'A discount for regulars that new visitors also see costs margin. DUMA’s promo codes have limits and dates, loyalty rewards the people who come back, and email reaches only those who opted in.',
  },
];

export const SHOP_USE_CASES: readonly ListItem[] = [
  {
    title: 'Never sell what you don’t have',
    body: 'Stock by size and colour, per location, updated by the till and by your storefront. Move stock between shops with a transfer, not a phone call.',
  },
  {
    title: 'Sell in person without a second system',
    body: 'Run the till at the counter, at a market or at a pop-up. Same products, same prices, same stock — and it keeps working offline.',
  },
  {
    title: 'Turn first orders into regulars',
    body: 'Loyalty points or stamps, referral codes that reward a friend’s first order, and promo codes with limits and end dates — all honoured at the till.',
  },
  {
    title: 'Know who buys what',
    body: 'One profile per customer, with every order in the shop and online. Email the people who opted in, and leave the rest alone.',
  },
];

export const SHOP_SETUP_STEPS: readonly ListItem[] = [
  {
    title: 'Tell DUMA what you sell.',
    body: 'Products in sizes and colours, sold in a shop, online or both — answer a few questions at sign-up and DUMA switches on the parts that fit.',
  },
  {
    title: 'Bring in your products.',
    body: 'Add products with their sizes, colours, prices and photos, and your opening stock. We’ll help you do it, for free.',
  },
  {
    title: 'Sell in the shop and online.',
    body: 'Open the till on any tablet or phone. Online, your site reads products and stock from the storefront API and sends its orders back, so both share one stock and one customer list.',
  },
];

export const SHOP_METRICS: readonly ListItem[] = [
  { title: 'Stock by size and colour', body: 'What’s left of every variant. The sizes that run out first are the ones to reorder deeper.' },
  { title: 'Stock by location', body: 'What’s in each shop or store room, so a transfer fixes a gap before a customer finds it.' },
  { title: 'Top sellers', body: 'What sold, by quantity and value. Useful for reorders, the window and the homepage.' },
  { title: 'Repeat customers', body: 'Who came back, and how often. The clearest sign loyalty and email are working.' },
  { title: 'Promotion use', body: 'How often each code is redeemed, against its limit. Codes that nobody uses can come down.' },
  { title: 'Average order', body: 'What a typical order is worth. Bundles and add-ons show here first.' },
];

/**
 * The three ways a small shop usually runs — categories, not named products.
 * DUMA loses the "hosted online store" row today, and says so.
 */
export const SHOP_COMPARISON: readonly ComparisonOption[] = [
  {
    title: 'A hosted store with add-on apps',
    summary: 'A strong online shop. Loyalty, email, forms and in-person selling usually mean extra apps and extra bills.',
    bestFor: 'Online-first stores happy to pay per app',
    rows: [
      { job: 'Hosted online store', mark: 'yes' },
      { job: 'Till for the shop and pop-ups', mark: 'part', note: 'Often a paid add-on' },
      { job: 'Stock by size and colour', mark: 'yes' },
      { job: 'Loyalty, promotions and referrals', mark: 'part', note: 'Usually paid apps' },
      { job: 'One bill', mark: 'no', note: 'One per app' },
    ],
  },
  {
    title: 'A till app plus separate tools',
    summary: 'Good for the counter. The website, stock and marketing each live in a different tool.',
    bestFor: 'Shops that sell mostly in person',
    rows: [
      { job: 'Hosted online store', mark: 'part', note: 'Another tool' },
      { job: 'Till for the shop and pop-ups', mark: 'yes' },
      { job: 'Stock by size and colour', mark: 'part', note: 'Synced by hand' },
      { job: 'Loyalty, promotions and referrals', mark: 'part', note: 'Another app' },
      { job: 'One bill', mark: 'no', note: 'One per tool' },
    ],
  },
  {
    title: 'DUMA',
    summary: 'Till, stock by size and colour, customers, loyalty, promotions, email and a storefront API in one workspace.',
    bestFor: 'Shops that sell in person and online from one stock',
    rows: [
      { job: 'Hosted online store', mark: 'part', note: 'Storefront API today; hosted store planned' },
      { job: 'Till for the shop and pop-ups', mark: 'yes', note: 'Works offline' },
      { job: 'Stock by size and colour', mark: 'yes', note: 'Per location' },
      { job: 'Loyalty, promotions and referrals', mark: 'yes' },
      { job: 'One bill', mark: 'yes', note: 'Free to start' },
    ],
  },
];

export const SHOP_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Does DUMA replace Shopify?',
    answer:
      'Not yet. DUMA has no hosted storefront today — one is planned. You can keep your current store, or build your site on DUMA’s storefront API so it shares stock, customers and orders with the till.',
  },
  {
    question: 'Does DUMA connect to Shopify or WooCommerce?',
    answer:
      'Not directly. If you keep another platform, its stock stays there. A website built on DUMA’s storefront API reads products and stock from DUMA and sends orders back, so everything stays in one place.',
  },
  {
    question: 'What is the storefront API?',
    answer:
      'A public API for your website: products with sizes, colours, photos and prices, stock, categories, languages and the shopper’s currency, plus order quotes, orders, newsletter sign-ups, referral codes and forms. A developer connects your site to it once.',
  },
  {
    question: 'Can I track stock by size and colour?',
    answer: 'Yes. Every size and colour of a product has its own stock, per location, and every sale — in the shop or through the storefront API — takes from it.',
  },
  {
    question: 'Can I sell at markets and pop-ups?',
    answer: 'Yes. Open the till on a phone or tablet and sell from the same products and stock. It keeps taking orders if the signal drops and sends them when it’s back.',
  },
  {
    question: 'Can I keep my card machine?',
    answer:
      'Yes. Square and SumUp connect to DUMA directly. With any other card machine, key the amount in and mark the sale as card in DUMA — it still lands in your reports.',
  },
  {
    question: 'Can you help me set it up?',
    answer: 'Yes, for free. We help you bring in your products, sizes and stock so you can start selling quickly.',
  },
];
