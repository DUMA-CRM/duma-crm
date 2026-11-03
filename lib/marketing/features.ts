/**
 * The words for the /features/[slug] pages, rendered by
 * components/marketing/features/FeaturePage.tsx. A module gets a page here
 * when its words are written, and is published in lib/marketing/site.ts
 * (MODULES) when they are checked — the route only builds slugs that are both.
 *
 * Every line describes what the product does today, checked against the code
 * on 2026-11-02:
 * - pos: app/(crm)/pos/page.tsx, components/pos/CheckoutFlow.tsx,
 *   stores/offlineOrdersStore.ts, lib/utils/offline-order-sync.ts,
 *   components/providers/OfflineOrderSync.tsx, components/cash-up.
 * - staff-scheduling: components/scheduling/*, components/people/HrInbox.tsx,
 *   lib/utils/leave-review.ts, coverage-check.ts, lib/reports/catalogue.ts.
 * - products-catalog: lib/menu/costing.ts, components/menu/RecipeEditorPage.tsx,
 *   RecipeIngredientEditor.tsx, ModifierRecipeEditor.tsx, lib/utils/menu-engineering.ts,
 *   catalog-import.ts; ingredient cost is the stock item's cost per unit,
 *   updated when a purchase order is received (duma-api purchase-orders.ts).
 *
 * The "not yet" lists are part of the promise: keep them true too. When one
 * of them ships, move it up into the capabilities.
 */
import type { ScreenshotKey } from '@/lib/marketing/screenshots';
import type { ListItem } from '@/lib/marketing/solutions';

export type FeatureCapability = ListItem & { tag?: string };

export type FeatureContent = {
  slug: string;
  metaTitle: string;
  description: string;
  hero: {
    lead: string;
    mark: string;
    subtitle: string;
    ticks: [string, string, string];
    /** The product screenshot under the hero — a placeholder until its file is added. */ shot: ScreenshotKey;
    caption: string;
  };
  explainer: { title: string; paragraphs: string[] };
  capabilities: { title: string; intro: string; items: readonly FeatureCapability[] };
  steps: { title: string; intro: string; items: readonly ListItem[] };
  notYet: { title: string; intro: string; items: readonly string[] };
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  closing: { title: string; muted: string; body: string };
};

const POS: FeatureContent = {
  slug: 'pos',
  metaTitle: 'Offline EPOS Till That Works Without Internet | DUMA',
  description:
    'A free EPOS till for UK cafés and shops that keeps selling when the Wi-Fi drops. Runs in a browser on any tablet, and you keep your card machine.',
  hero: {
    lead: 'An EPOS till that',
    mark: 'keeps selling offline',
    subtitle:
      'DUMA’s till runs in a browser on the tablet, phone or laptop you already have. When the internet drops, cash and card-machine sales are saved on the till and sent the moment it’s back. Nothing queued is thrown away.',
    ticks: ['Free in full', 'Keep your card machine', 'Any device, no install'],
    shot: 'pos',
    caption: 'The DUMA till, with demo data.',
  },
  explainer: {
    title: 'What an offline POS should do',
    paragraphs: [
      'Most cafés and small shops lose the connection at some point: a router restarts, the broadband drops at the busiest hour, the pop-up has one bar of signal. A till that stops selling then costs you the queue.',
      'An offline POS keeps taking orders, keeps each sale safe on the device, and sends it on its own when the connection returns, without staff having to remember anything. That is what DUMA’s till does for cash and card-machine sales, and it tells you exactly what is waiting.',
    ],
  },
  capabilities: {
    title: 'What the DUMA till does',
    intro: 'The till is part of the free plan in full. These are the things it does today.',
    items: [
      {
        title: 'Sells through a dropped connection',
        body: 'When the Wi-Fi goes, the till says so: cash and card-machine sales save on this till and send when the connection returns. A counter shows how many are waiting.',
        tag: 'free in full',
      },
      {
        title: 'Never throws a sale away',
        body: 'A queued sale is financial data. If the server is busy it retries; if the cashier’s sign-in has expired it waits for them; if the sale is refused it stays on the till with the reason and a Retry button.',
        tag: 'free in full',
      },
      {
        title: 'Keeps your card machine',
        body: 'Square Terminal and SumUp readers connect directly, so the till sends them the amount. Any other card machine works through the Card machine method: key the amount in, take the payment, and the sale is recorded.',
      },
      {
        title: 'Runs on what you own',
        body: 'Any tablet, phone or laptop with a browser. Install it to the home screen like an app. There is no DUMA hardware to buy.',
      },
      {
        title: 'Options, notes and held tickets',
        body: 'Required choices such as size or milk are enforced as you build the order. Add a kitchen note, hold up to 12 tickets on the device, and undo a removed line.',
      },
      {
        title: 'Customers and loyalty at the counter',
        body: 'Find a customer by name, phone or email, add a new one, or scan their loyalty QR code. Apply a reward on the ticket; points and stamps are earned when the order completes.',
      },
      {
        title: 'Stock and margin from every sale',
        body: 'A completed sale takes its recipe’s ingredients off stock and feeds the margin and sales reports. Low and out-of-stock items can be flagged on the till.',
      },
      {
        title: 'Cash-up built into the till',
        body: 'Open the day with a float, then close it in four steps: check for held tickets and unsent sales, count the cash blind, enter the card machine’s total, and review. A difference of £1 or more needs a note.',
      },
    ],
  },
  steps: {
    title: 'What happens when the internet drops',
    intro: 'Step by step, from the moment the connection goes to the moment every sale is in.',
    items: [
      {
        title: 'The till tells you it’s offline',
        body: 'A banner appears with the number of sales waiting. Card readers that need the internet are greyed out; Cash and Card machine stay available.',
      },
      {
        title: 'Each sale is saved on this device',
        body: 'Sales wait in this browser on this till. Keep the browser’s site data while sales are waiting, because that is where they are kept.',
      },
      {
        title: 'They send themselves when it’s back',
        body: 'As soon as the connection returns, and every 30 seconds after, DUMA sends the waiting sales from whichever DUMA screen is open. The till shows how many are sending, then lists the ones recently sent.',
      },
      {
        title: 'Anything refused is kept for you',
        body: 'If a sale can’t be accepted, for example because an item changed in the meantime, it stays on the till with the time it was taken, the reason and a Retry button. It is never deleted for you.',
      },
    ],
  },
  notYet: {
    title: 'What the till doesn’t do yet',
    intro: 'So you can decide with the full picture. Tell us if one of these matters to you: we add things on request.',
    items: [
      'Card payments through a connected reader need the internet. Offline, use cash or your card machine on its own.',
      'Promo codes are checked online, so a sale with a promo code can’t be taken offline.',
      'Receipts print from the browser. Dedicated receipt printers and cash drawers are coming soon.',
      'No split bills, gift cards or tips on the till yet.',
      'Refunds are made from the order in Orders, not on the till.',
      'Discounts come from promo codes and loyalty rewards; there is no free-typed discount on the till.',
    ],
  },
  faqTitle: 'Questions about the DUMA till',
  faqs: [
    {
      question: 'Does the DUMA till work without internet?',
      answer:
        'Yes, for cash and card-machine sales. They are saved on the till while the connection is down and sent automatically when it returns. Card readers connected to DUMA, and promo codes, need a connection.',
    },
    {
      question: 'What happens to a sale that fails to send?',
      answer:
        'It is kept. A temporary problem is retried, an expired sign-in waits for the cashier to sign in again, and a sale the server refuses stays on the till with the reason and a Retry button. DUMA never deletes a queued sale for you.',
    },
    {
      question: 'Do I need special hardware for DUMA EPOS?',
      answer: 'No. The till runs in a web browser on any tablet, phone or laptop, and can be installed to the home screen like an app.',
    },
    {
      question: 'Which card machines work with the DUMA till?',
      answer:
        'Any. Square Terminal and SumUp readers connect directly, so the till sends them the amount. Any other card machine works through the Card machine method: you key the amount into the machine and the sale is recorded in DUMA.',
    },
    {
      question: 'Is the DUMA till free?',
      answer: 'Yes. The till, orders and payments are part of the free plan in full, with no time limit and no card needed to sign up.',
    },
    {
      question: 'Can I print receipts?',
      answer:
        'Yes, from the browser, once the sale has reached DUMA. Support for dedicated receipt printers and cash drawers is coming soon.',
    },
  ],
  closing: {
    title: 'A till that doesn’t stop.',
    muted: 'Free, on the device you already have.',
    body: 'Start in minutes with no card needed. We’ll help you bring your menu across and connect your card machine.',
  },
};

const STAFF_SCHEDULING: FeatureContent = {
  slug: 'staff-scheduling',
  metaTitle: 'Free Rota App for Restaurants and Cafés, UK | DUMA',
  description:
    'A free staff rota app for UK cafés, restaurants and shops: build and publish the rota, clock in on a phone, handle leave and see labour cost next to sales.',
  hero: {
    lead: 'A free rota app',
    mark: 'next to your sales',
    subtitle:
      'Build the week, publish it, and your team sees their shifts on their own phone. They clock in there and ask for leave there, and you see what the hours cost against what you took.',
    ticks: ['Free in full', 'On your team’s phones', 'Labour cost next to sales'],
    shot: 'rota',
    caption: 'A week’s rota in DUMA, with demo data.',
  },
  explainer: {
    title: 'Why a rota belongs next to the till',
    paragraphs: [
      'In a lot of small food businesses the rota lives in a WhatsApp group and a spreadsheet. Nobody is sure which version is current, leave is agreed in a message that gets lost, and nobody knows what Saturday’s staff cost compared with Saturday’s takings until the accountant tells you.',
      'In DUMA the rota, the clock-ins and the sales share one place. The shifts you plan, the hours people actually work and the money the day took sit side by side, so labour cost is a number you can see this week, not a surprise next month.',
    ],
  },
  capabilities: {
    title: 'What DUMA’s rotas do',
    intro: 'Rotas and time are part of the free plan in full.',
    items: [
      {
        title: 'Build the week',
        body: 'Add shifts for each person, or leave an open slot with nobody assigned yet. Repeat a shift weekly on chosen days for up to 12 weeks; each one stays editable on its own.',
        tag: 'free in full',
      },
      {
        title: 'Draft, then publish',
        body: 'New shifts start as drafts, so you can plan without the team watching it change. Publish every draft for a location and date range in one go when it’s ready.',
        tag: 'free in full',
      },
      {
        title: 'My rota, on their phone',
        body: 'Each person sees their week, their next shift, scheduled and worked hours and approved leave. Hourly staff see their estimated pay. New and changed shifts are marked.',
      },
      {
        title: 'Clock in where they are',
        body: 'Staff slide to clock in on My rota, or at the till, which asks them to clock in before it opens. A clock-in shortly before a published shift is matched to it.',
      },
      {
        title: 'Planned against worked',
        body: 'One view shows each shift beside the time actually clocked: late or early by how many minutes, no-shows, and work that was not on the rota.',
      },
      {
        title: 'Leave, with the context',
        body: 'Staff request time off from their phone. You approve or decline seeing their remaining allowance, who else is off, and the shifts it would leave uncovered.',
      },
      {
        title: 'Cover against demand',
        body: 'Compare the people on the rota, hour by hour, with the staff your recent orders suggest you need, by weekday, so the short-staffed hours stand out.',
      },
      {
        title: 'Labour cost next to sales',
        body: 'An estimated cost for the rota, and a Labour vs sales report with labour as a share of takings and sales per labour hour. A Staff hours report works as the timesheet.',
      },
    ],
  },
  steps: {
    title: 'How to write a staff rota in DUMA',
    intro: 'The first week takes a few minutes. After that most of it repeats.',
    items: [
      {
        title: 'Add your team',
        body: 'Invite each person with their role and the location they work at. Add an hourly rate if you want labour cost.',
      },
      {
        title: 'Plan the shifts as drafts',
        body: 'Add shifts for the week, repeat the regular ones weekly, and leave open slots where you still need someone.',
      },
      {
        title: 'Check cover, then publish',
        body: 'Look at the cover panel for hours that look short, adjust, then publish. Your team sees the published rota on My rota.',
      },
      {
        title: 'Compare the week with the takings',
        body: 'After the week, open Labour vs sales to see what the hours cost as a share of what you took, and tune next week’s rota.',
      },
    ],
  },
  notYet: {
    title: 'What the rota doesn’t do yet',
    intro: 'Honest gaps, so nothing surprises you. Tell us if one of these matters: we add things on request.',
    items: [
      'No shift swaps between staff yet. Swaps go through the manager.',
      'Publishing doesn’t send a notification. Your team sees the new rota when they open My rota.',
      'No copy-a-whole-week or rota templates. Regular shifts repeat weekly instead.',
      'No GPS, geofenced or PIN clock-in. Staff clock in for the location chosen in the app.',
      'It is an installable web app, not a native app from an app store.',
      'Pay runs are prepared in DUMA and exported for your payroll tool or accountant. DUMA does not submit anything to HMRC.',
    ],
  },
  faqTitle: 'Questions about rotas in DUMA',
  faqs: [
    {
      question: 'Is DUMA a free rota app?',
      answer:
        'Yes. Rotas and time are part of DUMA’s free plan in full: building and publishing the rota, clock-ins, leave requests and the labour reports. There is no time limit and no card is needed.',
    },
    {
      question: 'Can my staff see the rota on their phone?',
      answer:
        'Yes. Each person has My rota, which shows their week, their next shift, their hours and their approved leave. It works in the phone’s browser and can be installed to the home screen like an app.',
    },
    {
      question: 'Can staff clock in and out on their phone?',
      answer:
        'Yes. They slide to clock in on My rota, or clock in at the till. A manager can correct a clock time, and staff can query a day that looks wrong.',
    },
    {
      question: 'Does it show labour cost against sales?',
      answer:
        'Yes. The rota shows an estimated cost, and the Labour vs sales report shows labour cost as a share of takings and sales per labour hour, because the rota and the till share one system.',
    },
    {
      question: 'Can staff swap shifts?',
      answer: 'Not yet. For now a manager moves the shift. Tell us if you need swaps, because requests decide what we build next.',
    },
    {
      question: 'Does DUMA run payroll?',
      answer:
        'It prepares pay runs and payslips from the hours worked, and exports them for your accountant or payroll tool. It does not submit PAYE to HMRC.',
    },
  ],
  closing: {
    title: 'Take the rota out of WhatsApp.',
    muted: 'Free, on your team’s phones.',
    body: 'Start in minutes with no card needed. We’ll help you add your team and build the first week.',
  },
};

const PRODUCTS_CATALOG: FeatureContent = {
  slug: 'products-catalog',
  metaTitle: 'Recipe Costing Software with Menu Margin After VAT | DUMA',
  description:
    'Recipe costing software for UK cafés and restaurants: cost each dish from its ingredients and see the margin after VAT, per size and option. Free plan.',
  hero: {
    lead: 'Recipe costing that shows',
    mark: 'what you really keep',
    subtitle:
      'Add a recipe once. DUMA costs it from your ingredient prices, takes VAT out of the price if you’re registered, and shows the margin per size and per combination of options, on the menu and in the reports.',
    ticks: ['Free in full', 'VAT taken out first', 'Updates when prices change'],
    shot: 'products',
    caption: 'A product’s recipe and margin in DUMA, with demo data.',
  },
  explainer: {
    title: 'What recipe costing is, and why VAT matters',
    paragraphs: [
      'Recipe costing means adding up what goes into one portion of a dish (every ingredient, at what you pay for it) so you can set a price that leaves a margin. Without it, menu prices are guesses, and a rise in the price of milk or butter eats your margin without anyone noticing.',
      'The common mistake is to compare the cost with the menu price. If you are VAT-registered and your prices include VAT, part of every price is HMRC’s, not yours. On a £3.20 flat white at 20% VAT you keep £2.67, so 60p of ingredients leaves £2.07, not £2.60. DUMA always works the margin from what you keep.',
    ],
  },
  capabilities: {
    title: 'What DUMA’s recipe costing does',
    intro: 'Products, menu and margin are part of the free plan in full.',
    items: [
      {
        title: 'Recipes from your own stock',
        body: 'Each ingredient is one of your stock items, measured in its own unit. A size can use a different quantity, so a large latte costs more than a small one.',
        tag: 'free in full',
      },
      {
        title: 'Options have recipes too',
        body: 'Give a modifier its own recipe, so oat milk or an extra shot changes the cost of the drink it’s added to, exactly as the till sells it.',
        tag: 'free in full',
      },
      {
        title: 'Margin after VAT, the way the till records it',
        body: 'DUMA takes VAT out of VAT-inclusive prices, or adds it to exclusive ones, using the same arithmetic as the till. Not registered? Nothing is deducted. An item can have its own VAT rate.',
      },
      {
        title: 'Try a combination',
        body: 'Pick the options a customer would choose and see that exact drink or dish’s cost and margin, before you put a price on it.',
      },
      {
        title: 'Costs that keep up',
        body: 'Ingredient cost comes from the stock item’s cost per unit. Receiving a purchase order updates it to the price you just paid, so the margin follows your suppliers.',
      },
      {
        title: 'Gaps are flagged',
        body: 'Items with no recipe show as recipe gaps, and a total that includes an ingredient with no cost is marked as incomplete, so a margin is never quietly too good.',
      },
      {
        title: 'Allergens roll up',
        body: 'Set the 14 UK allergens on ingredients once, and each dish shows the allergens its recipe contains, with energy and nutrition per size.',
      },
      {
        title: 'Menu engineering',
        body: 'The menu engineering report sorts dishes by popularity and margin into Stars, Workhorses, Opportunities and Low performers, with what to do about each.',
      },
    ],
  },
  steps: {
    title: 'How to cost a recipe in DUMA',
    intro: 'Once your ingredients have a cost, a recipe takes a minute.',
    items: [
      {
        title: 'Add your ingredients as stock items',
        body: 'Give each one a unit (g, ml, each) and what it costs you per unit, or let a received purchase order set it.',
      },
      {
        title: 'Open the dish’s Recipe & cost tab',
        body: 'Add each ingredient with its quantity, and a different quantity for each size where it changes.',
      },
      {
        title: 'Add recipes to the options',
        body: 'Give milk swaps, extra shots or add-ons their own small recipe, so every combination is costed.',
      },
      {
        title: 'Read the margin and set the price',
        body: 'See the cost, the VAT and what you keep for each size. Change the price until the margin is where you want it.',
      },
    ],
  },
  notYet: {
    title: 'What recipe costing doesn’t do yet',
    intro: 'Honest gaps. Tell us if one of these matters: we add things on request.',
    items: [
      'Ingredient cost is the stock item’s cost per unit (set by hand or by the last purchase order), not a weighted average.',
      'No meal deals or bundles priced as one item yet. Option groups set the rules for choices instead.',
      'Items with no ingredient cost are left out of the menu engineering report until they have one.',
    ],
  },
  faqTitle: 'Questions about recipe costing',
  faqs: [
    {
      question: 'What is recipe costing software?',
      answer:
        'Software that adds up the cost of the ingredients in one portion of a dish and compares it with the price, so you know the margin on each item. DUMA does it from your own stock items, per size and per combination of options.',
    },
    {
      question: 'Does DUMA take VAT into account in the margin?',
      answer:
        'Yes. If you are VAT-registered, DUMA takes the VAT out of a VAT-inclusive price (or adds it to an exclusive one) before working out the margin, using the same arithmetic as the till. If you are not registered, nothing is deducted.',
    },
    {
      question: 'Where does the ingredient cost come from?',
      answer:
        'From each stock item’s cost per unit. You can type it in, and receiving a purchase order updates it to the price you just paid.',
    },
    {
      question: 'Can I cost drinks with milk swaps and extra shots?',
      answer:
        'Yes. Options can have their own recipes, and Try a combination shows the cost and margin of an item with the options a customer would actually choose.',
    },
    {
      question: 'Does selling a dish take its ingredients off stock?',
      answer: 'Yes. When an order is completed, the recipe of each item and of each option chosen is taken off stock.',
    },
    {
      question: 'Is recipe costing free?',
      answer: 'Yes. Products, menu and margin are part of DUMA’s free plan in full, with no time limit and no card needed.',
    },
  ],
  closing: {
    title: 'Price every dish on purpose.',
    muted: 'Free, with the margin after VAT.',
    body: 'Start in minutes with no card needed. We’ll help you bring your menu and ingredients across.',
  },
};

export const FEATURE_PAGES: readonly FeatureContent[] = [POS, STAFF_SCHEDULING, PRODUCTS_CATALOG];

export function featureContent(slug: string): FeatureContent | undefined {
  return FEATURE_PAGES.find((page) => page.slug === slug);
}
