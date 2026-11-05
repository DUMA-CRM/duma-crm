/**
 * Terms & definitions — /glossary, after seline.com/google-analytics-terms: an
 * A–Z index, and a short article for each term that answers "what is X" for
 * the people DUMA is for (cafés, restaurants, bars, small shops).
 *
 * Every "in DUMA" line names something that exists: the reports in
 * lib/reports/catalogue.ts, recipe costing in lib/menu/costing.ts, the menu
 * engineering quadrants in lib/utils/menu-engineering.ts, the reorder level on
 * stock items, stocktakes and the till cash-up. Claims follow the business
 * profile's guardrails (Obsidian, Platform/DUMA Business Profile §10).
 *
 * Bodies are Markdown for components/marketing/blog/Markdown.tsx: ## headings
 * become the table of contents, and links to /glossary/<slug> must name a term
 * that exists here — tests/unit/glossary.test.mts holds that.
 *
 * No path-alias imports: the unit tests load this file directly.
 */

export type GlossaryTerm = {
  slug: string;
  /** As it appears in the index and the breadcrumb. */
  term: string;
  /** The article's headline — the question people search for. */
  title: string;
  /** One sentence: the index line, the TL;DR and the meta description. */
  short: string;
  body: string;
  faq: { question: string; answer: string }[];
  related: string[];
  /**
   * The audience page where this number lives in DUMA, linked from the term as
   * "See it in DUMA". The label is the anchor, so it says what the page is.
   */
  seeIt: { path: `/solutions/${string}`; label: string };
  /** A search title, when the headline alone would not say who the guide is for. Otherwise `${title} | DUMA`. */
  metaTitle?: string;
  /** ISO date the article last changed. */
  updated: string;
};

export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    slug: 'food-cost-percentage',
    title: 'What is food cost percentage?',
    term: 'Food cost percentage',
    short: 'The share of your food sales that went on the ingredients to make it — the first number a kitchen is run on.',
    updated: '2026-11-03',
    related: ['gross-profit-margin', 'prime-cost', 'margin-vs-markup', 'wastage'],
    seeIt: { path: '/solutions/cafes', label: 'Food cost and recipe margin for cafés and restaurants' },
    body: `
Picture a burger that sells for £12. The bun, the beef, the cheese and the sauce cost you £3.60. That burger has a food cost of 30%: for every pound it brings in, 30p went on ingredients. Food cost percentage is that same sum, for one dish or for the whole kitchen.

## The formula

For one dish, divide what its ingredients cost by its selling price **before VAT**:

> Food cost % = ingredient cost ÷ selling price (ex VAT) × 100

For a week or a month, use what the kitchen actually used up — the stock you started with, plus what you bought, less what is left:

> Food cost % = (opening stock + purchases − closing stock) ÷ food sales (ex VAT) × 100

## A worked example

You open the week with £1,800 of food stock, buy £2,400 more, and count £1,500 left on Sunday night. You used £2,700 of food. Food sales for the week were £9,000 before VAT.

£2,700 ÷ £9,000 = **30%**.

## What is a good food cost?

There is no single right number — a coffee shop and a steakhouse live in different worlds. Many restaurants aim for somewhere around 25–35%. What matters more is your own number moving: a jump of three or four points from one month to the next is money leaving through waste, over-portioning, theft or a supplier price rise.

## Why it matters

- It tells you whether your prices still cover your ingredients after a supplier puts theirs up.
- It is the quickest way to spot waste and over-portioning — the dish costs the same on paper, but the kitchen uses more.
- Together with labour, it makes up [prime cost](/glossary/prime-cost), the biggest cost a restaurant controls.

## Common mistakes

1. **Including VAT in the price.** A £6 dish with 20% VAT brings you £5. Work from £5, or every food cost looks better than it is.
2. **Costing a recipe once and forgetting it.** Ingredient prices move; the recipe card has to move with them.
3. **Ignoring waste.** A theoretical food cost that leaves out [wastage](/glossary/wastage) will always be lower than the real one.
4. **Skipping the stocktake.** Without a closing count, the period formula is a guess. See [stocktake](/glossary/stocktake).

## Tracking it in DUMA

Add a recipe to each menu item and DUMA works out the cost of every dish from its ingredients, and its margin with VAT taken out of the price when you are VAT-registered. The **Prime cost** report shows food and labour as a share of sales over any period, and **Stock usage** shows what was used, item by item.

Work out the food cost of one dish, with the VAT taken out, in the free [menu margin calculator](/tools/margin-calculator).
`,
    faq: [
      {
        question: 'Is food cost percentage the same as gross profit?',
        answer: 'They are two sides of the same sum. If your food cost is 30%, your gross profit on food is 70%. Food cost tells you what you spent; gross profit tells you what was left.',
      },
      {
        question: 'Should drinks be included in food cost?',
        answer: 'Most businesses track beverage cost separately, because drinks usually run at a much lower cost percentage than food. Mixing them hides a problem in either.',
      },
      {
        question: 'How often should I calculate food cost?',
        answer: 'Weekly is ideal for a busy kitchen, and monthly at the least. It is only as accurate as your stocktake, so calculate it when you count.',
      },
    ],
  },
  {
    slug: 'gross-profit-margin',
    title: 'What is gross profit margin (GP)?',
    term: 'Gross profit margin (GP)',
    short: 'What is left of each sale after the cost of the goods sold, as a percentage of the sale.',
    updated: '2026-11-03',
    related: ['food-cost-percentage', 'margin-vs-markup', 'prime-cost', 'menu-engineering'],
    seeIt: { path: '/solutions/cafes', label: 'Margin per dish, after VAT, for cafés and restaurants' },
    body: `
In UK hospitality you will hear "what GP are we running at?" more than almost any other question. Gross profit is what a sale leaves you after paying for the goods in it — the ingredients in a dish, the stock behind a T-shirt. The margin is that profit as a share of the sale.

## The formula

> Gross profit = net sales − cost of goods sold

> Gross profit margin = gross profit ÷ net sales × 100

"Net sales" means after VAT, discounts and refunds — the money that is actually yours.

## A worked example

A latte sells for £3.60 including 20% VAT, so £3.00 is yours. The coffee, milk and cup cost £0.60.

Gross profit is £3.00 − £0.60 = £2.40, and the margin is £2.40 ÷ £3.00 = **80%**.

If you had worked from £3.60 instead, you would have reported 83% — a margin that does not exist.

## Gross profit is not the profit you keep

Gross profit pays for everything else: wages, rent, energy, card fees, insurance. A dish can run at 70% GP and still lose money if it takes a chef twenty minutes to make. That is why restaurants watch [prime cost](/glossary/prime-cost) as well.

## Why it matters

- It shows which products pay for the business and which only keep customers happy.
- It is how you set prices: decide the margin you need, then price to reach it.
- A falling GP with steady prices means costs have crept up, or stock is going missing.

## Common mistakes

1. **Confusing margin with markup.** A 50% markup is only a 33% margin. See [margin vs markup](/glossary/margin-vs-markup).
2. **Working from prices that include VAT.** It flatters every margin by the whole VAT fraction.
3. **Looking only at the average.** One high-margin best-seller can hide a menu full of weak dishes — [menu engineering](/glossary/menu-engineering) separates them.

## Tracking it in DUMA

Every menu item with a recipe shows its cost and margin, with VAT taken out when you are VAT-registered, so the number matches what you keep. The **Menu engineering** report sets each item's margin against how often it sells, and **Item & category sales** shows units and sales for every item.

Check the GP of one dish or drink, after VAT, with the free [menu margin and GP calculator](/tools/margin-calculator).
`,
    faq: [
      {
        question: 'What is a good gross profit margin for a restaurant?',
        answer: 'Food often runs at 65–75% GP and drinks higher, but it varies by concept. Compare yourself month to month before you compare yourself to anyone else.',
      },
      {
        question: 'What is the difference between gross and net profit?',
        answer: 'Gross profit only takes off the cost of the goods sold. Net profit takes off everything — wages, rent, bills, tax — and is what the business actually earned.',
      },
      {
        question: 'Do discounts affect gross profit margin?',
        answer: 'Yes. A discount lowers the sale but not the cost, so the margin on that sale falls. Track discounts separately so you can see what they cost you.',
      },
    ],
  },
  {
    slug: 'margin-vs-markup',
    title: 'Margin vs markup: what is the difference?',
    term: 'Margin vs markup',
    short: 'Two ways to describe the same profit: margin divides it by the price, markup divides it by the cost.',
    updated: '2026-11-03',
    related: ['gross-profit-margin', 'food-cost-percentage'],
    seeIt: { path: '/solutions/cafes', label: 'VAT-aware margin on every dish for cafés and restaurants' },
    body: `
You buy a candle for £4 and sell it for £10. Is that a 60% profit or a 150% profit? Both — it depends whether you are talking about margin or markup. Mixing the two up is one of the most common ways small businesses underprice.

## The formulas

> Margin = (price − cost) ÷ price × 100

> Markup = (price − cost) ÷ cost × 100

The profit on top is the same £6. Margin compares it to the £10 price: **60%**. Markup compares it to the £4 cost: **150%**.

## Converting between them

| Markup | Margin |
| --- | --- |
| 25% | 20% |
| 50% | 33% |
| 100% | 50% |
| 200% | 67% |
| 300% | 75% |

To go from a margin you want to the price you need:

> Price = cost ÷ (1 − margin)

For a 70% margin on a £2.10 dish: £2.10 ÷ 0.30 = **£7.00** before VAT.

## Why it matters

Say you want a 50% margin and you "add 50%" to a £10 cost. You charge £15 and earn a 33% margin, not 50%. On a whole menu or a rail of stock, that gap is the difference between profit and a busy month that pays nothing.

## Common mistakes

1. **Adding a markup when you meant a margin.** Decide which one your target is, and use the formula for it.
2. **Forgetting VAT.** Both formulas use the price before VAT. Add VAT after you have set the price you need.
3. **Using one markup for everything.** A £1 cost and a £20 cost rarely deserve the same multiplier.

## In DUMA

DUMA shows the cost and margin of every product with a recipe, worked out from its ingredients, with VAT taken out of the selling price when you are VAT-registered — so you set prices against the money you keep. More in [gross profit margin](/glossary/gross-profit-margin).

Try it on a real dish: the free [menu margin calculator](/tools/margin-calculator) shows the margin after VAT and the price you need for the one you want.
`,
    faq: [
      {
        question: 'Can margin be more than 100%?',
        answer: 'No. Margin is a share of the price, so it can approach 100% but never pass it. Markup has no upper limit: a 300% markup is common for drinks.',
      },
      {
        question: 'Which should I use to price my menu?',
        answer: 'Margin. It tells you directly how much of each pound you keep, and it is what your accountant and your food cost percentage are measured against.',
      },
      {
        question: 'Is keystone pricing a margin or a markup?',
        answer: 'Keystone — doubling the cost — is a 100% markup, which is a 50% margin.',
      },
    ],
  },
  {
    slug: 'prime-cost',
    title: 'What is prime cost?',
    term: 'Prime cost',
    short: 'Your cost of goods sold plus your total labour cost — the biggest controllable cost in a restaurant.',
    updated: '2026-10-31',
    related: ['food-cost-percentage', 'labour-cost-percentage', 'gross-profit-margin'],
    seeIt: { path: '/solutions/cafes', label: 'Food and staff cost against sales for cafés and restaurants' },
    body: `
Rent is fixed for years. Energy you can only nudge. But what you spend on ingredients and on people changes every single week — and together they are usually well over half of what a restaurant takes. That pair is prime cost.

## The formula

> Prime cost = cost of goods sold + total labour cost

> Prime cost % = prime cost ÷ net sales × 100

Total labour means everything a person costs you, not only their hourly rate: employer's National Insurance, pension contributions and holiday pay too.

## A worked example

In a month you take £40,000 before VAT. Food and drink used cost £11,600, and labour cost £13,200.

Prime cost is £24,800, which is **62%** of sales.

## What is a good prime cost?

A common rule of thumb is to keep prime cost at or below about 60–65% of sales. Above that, there is little left for rent, bills and profit.

## Why it matters

- Food and labour pull against each other. Cutting a chef's hours can push food cost up through waste and mistakes; one combined number shows the real effect.
- It is the number to check when a busy month somehow did not make money.

## Common mistakes

1. **Using wages only.** Leaving out employer's NI, pension and holiday pay understates labour.
2. **Using purchases instead of usage.** A big delivery on the 30th is not this month's food cost — the [stocktake](/glossary/stocktake) is what makes it accurate.
3. **Looking at it once a quarter.** By then the money is gone. Weekly is better.

## Tracking it in DUMA

The **Prime cost** report shows food and labour as a share of sales for any period. Food cost comes from your recipes and stock, labour from the rota and the hours your team clocked — see [labour cost percentage](/glossary/labour-cost-percentage).
`,
    faq: [
      {
        question: 'Does prime cost include the owner’s salary?',
        answer: 'If you pay yourself a wage for working in the business, include it — otherwise your prime cost looks healthier than it is.',
      },
      {
        question: 'Is prime cost only for restaurants?',
        answer: 'It is a hospitality term, but any business that makes what it sells — a bakery, a coffee roaster — can use it the same way.',
      },
      {
        question: 'How can I lower my prime cost?',
        answer: 'Rota to your sales by hour, cut waste, re-cost recipes when suppliers change prices, and rework dishes that are slow to make and low in margin.',
      },
    ],
  },
  {
    slug: 'labour-cost-percentage',
    title: 'What is labour cost percentage?',
    term: 'Labour cost percentage',
    short: 'What your team cost as a share of your sales — the number to rota against.',
    updated: '2026-10-31',
    related: ['prime-cost', 'average-order-value', 'food-cost-percentage'],
    seeIt: { path: '/solutions/bars', label: 'Staff cost against the night’s takings for bars and pubs' },
    body: `
A quiet Tuesday with four people on the floor and a Saturday rush with three both cost you money — one in wages, the other in lost sales and tired staff. Labour cost percentage is how you see it.

## The formula

> Labour cost % = total labour cost ÷ net sales × 100

As with [prime cost](/glossary/prime-cost), "total labour" includes employer's National Insurance, pension contributions and holiday pay — not only hourly wages.

A second number tells you how productive those hours were:

> Sales per labour hour = net sales ÷ hours worked

## A worked example

On a Friday you take £3,200 before VAT. Your team worked 48 hours at an average total cost of £14.50 an hour: £696.

Labour is **21.8%** of sales, and each hour worked brought in **£66.67**.

## What is a good labour cost?

Many restaurants and cafés aim for roughly 25–35%; counter-service businesses often run lower than full table service. Your own trend matters most.

## Why it matters

- It shows which shifts are overstaffed and which are stretched.
- It turns the rota from a habit into a decision based on when you actually trade.

## Common mistakes

1. **Rota by habit.** If Monday lunch has been dead for a month, the rota should know.
2. **Leaving out the extras.** Employer's NI, pension and holiday pay add a real share on top of wages.
3. **Only looking at the week.** A good week can hide two bad days. Look by day and by hour.

## Tracking it in DUMA

The **Labour vs sales** report shows labour cost, labour % and sales per labour hour, from the rota and the hours your team clocked. **Sales by hour** shows when in the day you trade, so you can build the rota around it.
`,
    faq: [
      {
        question: 'Should I use scheduled or actual hours?',
        answer: 'Actual hours — what people clocked. Comparing the two is useful in itself: a gap means shifts are running long.',
      },
      {
        question: 'Does labour cost include agency staff?',
        answer: 'Yes. Anyone you pay to work in the business counts, however they are paid.',
      },
      {
        question: 'What is sales per labour hour?',
        answer: 'Net sales divided by hours worked. It shows how much each hour of work brings in, and is a good way to compare shifts of different lengths.',
      },
    ],
  },
  {
    slug: 'menu-engineering',
    title: 'What is menu engineering?',
    term: 'Menu engineering',
    short: 'Sorting every dish by how often it sells and how much it earns, to decide what to promote, re-cost or cut.',
    updated: '2026-11-03',
    related: ['gross-profit-margin', 'food-cost-percentage', 'average-order-value'],
    seeIt: { path: '/solutions/cafes', label: 'Menu margins and top sellers for cafés and restaurants' },
    body: `
Your best-seller might be your least profitable dish. Your most profitable one might be hidden at the bottom of the menu. Menu engineering puts both numbers side by side so you can see it.

## How it works

Every item gets two scores: how often it sells, and the margin it makes. Split each at the middle of your menu, and every dish lands in one of four groups:

| | Higher margin | Lower margin |
| --- | --- | --- |
| **Sells more** | Star | Workhorse |
| **Sells less** | Opportunity | Low performer |

The idea comes from a 1982 study by Michael Kasavana and Donald Smith, who called the groups stars, plowhorses, puzzles and dogs.

## What to do with each group

- **Stars** — popular and profitable. Keep them prominent and consistent; do not tinker.
- **Workhorses** — popular, thinner margin. Check the recipe cost, the portion and the price. A small change here moves a lot of money.
- **Opportunities** — profitable but slow. Move them up the menu, describe them better, or have staff recommend them.
- **Low performers** — neither. Rework them or retire them, and free up the kitchen.

## Why it matters

A menu is a sales tool. Most businesses grow by selling more of the right things, not by adding dishes — and every extra dish adds stock, prep and [wastage](/glossary/wastage).

## Common mistakes

1. **Engineering without costed recipes.** Without an accurate [food cost](/glossary/food-cost-percentage) for each dish, the margin axis is fiction.
2. **Using too short a period.** One week of a special or a bank holiday skews it. Use at least a month.
3. **Cutting every low performer.** A dish a few loyal customers come in for can earn its place.

## Tracking it in DUMA

The **Menu engineering** report places every costed item in one of four groups — Stars, Workhorses, Opportunities and Low performers — by setting its margin against how many it sold, split at the menu's median for each. Items without a complete recipe cost are left out rather than guessed.

To find a dish's margin before you place it, use the free [menu margin calculator](/tools/margin-calculator).
`,
    faq: [
      {
        question: 'How often should I do menu engineering?',
        answer: 'Every time you change the menu, and at least every season. Run it after re-costing recipes, so the margins are current.',
      },
      {
        question: 'Does menu engineering work for shops?',
        answer: 'Yes — sort products by units sold and margin the same way. The groups tell you what to reorder, promote or discount out.',
      },
      {
        question: 'Should I use margin percentage or cash margin?',
        answer: 'Both are used. The original method uses cash margin per dish; margin percentage is easier to compare across cheap and expensive items. DUMA uses margin percentage.',
      },
    ],
  },
  {
    slug: 'average-order-value',
    title: 'What is average order value (AOV)?',
    term: 'Average order value (AOV)',
    short: 'How much a customer spends in one order, on average — also called average spend or average transaction value.',
    updated: '2026-10-31',
    related: ['customer-retention', 'menu-engineering', 'labour-cost-percentage'],
    seeIt: { path: '/solutions/cafes', label: 'Average order and takings reports for cafés and restaurants' },
    body: `
There are only two ways to sell more: more orders, or bigger ones. Average order value measures the second. In restaurants you will also hear **average spend per head**, which divides by guests instead of orders.

## The formula

> Average order value = net sales ÷ number of orders

> Average spend per head = net sales ÷ number of guests (covers)

## A worked example

On Saturday you took £2,640 before VAT across 220 orders.

£2,640 ÷ 220 = **£12.00** per order.

If one in five customers added a £3 side, AOV would rise to £12.60 — £132 more on the day without one extra customer.

## Why it matters

- Raising AOV is usually cheaper than finding new customers.
- It shows whether upselling, bundles and menu changes are working.
- Compared by channel, it shows where customers spend more — at the till or ordering by QR code.

## How to raise it

1. Suggest a side, a drink or a dessert — at the till, and on the menu.
2. Offer bundles that are better value for the customer and better margin for you.
3. Use [menu engineering](/glossary/menu-engineering) to put high-margin items where people look first.

## Common mistakes

1. **Raising AOV with discounts.** A bigger order at a lower margin can earn you less.
2. **Mixing channels.** A delivery order and a takeaway coffee are different businesses; compare like with like.
3. **Ignoring refunds.** Use net sales, after refunds and VAT.

## Tracking it in DUMA

The **Sales summary** report shows gross and net sales, refunds, orders and average order, day by day. **Sales by channel** sets till, QR code and mobile orders side by side.
`,
    faq: [
      {
        question: 'Is AOV the same as average spend per head?',
        answer: 'Not quite. AOV divides sales by orders; spend per head divides by guests. A table of four on one bill is one order but four covers.',
      },
      {
        question: 'Should AOV include VAT?',
        answer: 'Use net sales — after VAT, discounts and refunds — so it reflects money the business keeps.',
      },
      {
        question: 'Why did my AOV drop when sales went up?',
        answer: 'More small orders — morning coffees, say — can grow sales while pulling the average down. Look at orders and AOV together.',
      },
    ],
  },
  {
    slug: 'stocktake',
    title: 'What is a stocktake?',
    term: 'Stocktake',
    short: 'Counting everything you have on the shelves, so your records — and your costs — match reality.',
    updated: '2026-10-31',
    related: ['par-level', 'wastage', 'food-cost-percentage'],
    seeIt: { path: '/solutions/retail', label: 'Stocktakes across every shop with the retail EPOS' },
    body: `
Your system says there are 24 bottles of oat milk. The shelf says 17. A stocktake is how you find out — and every cost figure you rely on, from [food cost](/glossary/food-cost-percentage) to [gross profit](/glossary/gross-profit-margin), is only as good as the last one.

## What a stocktake involves

1. Pick a quiet time — before opening or after close — so nothing moves while you count.
2. Count every item in the unit you buy and use it in, location by location.
3. Compare what you counted with what your records expected.
4. Investigate the differences, then correct the records.

## Variance

The gap between expected and counted is the **variance**:

> Variance = counted − expected

A negative variance — less on the shelf than expected — usually means waste that was not recorded, over-portioning, mistakes at delivery, or theft.

## How often?

Many kitchens count weekly, or count their highest-value lines (meat, fish, spirits) weekly and everything else monthly. Shops often do a full count once or twice a year with regular spot checks between.

## Why it matters

- It is the only way to get a true cost of goods sold for a period.
- Regular variance on the same item points straight at a problem.
- It keeps [par levels](/glossary/par-level) and reordering honest.

## Common mistakes

1. **Counting while trading.** Sales during the count make the numbers impossible to reconcile.
2. **Mixing units.** Counting a case as one when the records hold single bottles.
3. **Correcting the records without asking why.** The variance is the useful part.

## Tracking it in DUMA

DUMA has **stocktakes**: count by location, see what was expected next to what you counted, and the stock records are updated from the count. The **Stock usage** report shows what was used, received and adjusted, item by item.
`,
    faq: [
      {
        question: 'What is the difference between a stocktake and a stock check?',
        answer: 'People use both for the same thing. Some use "stock check" for a quick count of a few lines and "stocktake" for a full count.',
      },
      {
        question: 'Should I count at cost price or selling price?',
        answer: 'At cost price. It is what you paid that goes into your cost of goods sold.',
      },
      {
        question: 'How long should a stocktake take?',
        answer: 'For a small café, often under an hour once a routine is set. Counting in the same order every time makes it much faster.',
      },
    ],
  },
  {
    slug: 'par-level',
    title: 'What is a par level?',
    term: 'Par level',
    short: 'The amount of an item you want on hand to get through until the next delivery, with a little to spare.',
    updated: '2026-10-31',
    related: ['stocktake', 'wastage'],
    seeIt: { path: '/solutions/bakeries', label: 'Low-stock flags and supplier orders for bakeries' },
    body: `
Run out of oat milk at 10am and you lose sales and annoy regulars. Order twice what you need and it goes off in the fridge. A par level is the line between the two: how much should be on the shelf, so ordering becomes a sum instead of a guess.

## The formula

> Par level = average usage per day × days until the next delivery + safety stock

Safety stock covers a busier-than-usual day or a late delivery — often 10–20% of the usage.

## A worked example

You use about 12 litres of milk a day and get deliveries every 3 days.

12 × 3 = 36 litres, plus 20% safety stock = **about 43 litres**.

If you count 15 litres on delivery day, you order 28.

## Par level vs reorder point

They are often used to mean the same thing, but strictly:

- **Par level** — how much you want on hand after a delivery.
- **Reorder point** — the level at which you place the next order.

Either way, the point is that the number is decided once, and the order follows from the count.

## Why it matters

- Fewer stock-outs on what sells.
- Less cash tied up in stock, and less [wastage](/glossary/wastage) on what goes off.
- Anyone can place the order, not only the person who "just knows".

## Common mistakes

1. **Setting it once and forgetting it.** Usage changes with the season and the menu.
2. **One par for every day.** A weekend may need a higher par than midweek.
3. **Ignoring shelf life.** Fresh produce needs a lower par and more frequent orders.

## Tracking it in DUMA

Each stock item can have a **reorder level** for each location. DUMA flags items that fall below it, so low stock shows up before you run out, and the latest [stocktake](/glossary/stocktake) keeps the counts honest.
`,
    faq: [
      {
        question: 'How do I find my average daily usage?',
        answer: 'Take what you used over a few weeks — opening stock plus deliveries minus closing stock — and divide by the days. Stock usage reports do this for you.',
      },
      {
        question: 'Should par levels change for events?',
        answer: 'Yes. Raise them before a known busy period, then bring them back down so the extra stock does not sit and spoil.',
      },
      {
        question: 'Do shops use par levels?',
        answer: 'Yes, often called minimum stock or reorder level. The idea is the same: decide the level, and let the count trigger the order.',
      },
    ],
  },
  {
    slug: 'wastage',
    title: 'What is wastage?',
    term: 'Wastage',
    short: 'Stock you paid for but never sold — spoiled, dropped, over-produced, returned or missing.',
    updated: '2026-10-31',
    related: ['food-cost-percentage', 'stocktake', 'par-level'],
    seeIt: { path: '/solutions/bakeries', label: 'Waste tracking for bakeries' },
    body: `
Every tray of unsold pastries in the bin was bought, prepared and paid for in staff time. Wastage is the cost of stock that never turned into a sale, and in food businesses it is often the largest cost nobody measures.

## The formula

> Wastage % = value of stock wasted ÷ value of stock used × 100

Count waste at cost price — what you paid, not what you would have charged.

## A worked example

In a week your kitchen used £2,700 of food and wrote off £189: out-of-date dairy, a dropped tray, prep that was not used.

£189 ÷ £2,700 = **7%**. That is £9,800 a year at the same rate.

## Where it comes from

- **Spoilage** — food that goes out of date before it is used.
- **Over-production** — more prepped than sold.
- **Preparation** — trimmings and peelings beyond what the recipe expects.
- **Mistakes** — wrong orders, returned dishes, breakages.
- **Unexplained loss** — the gap a [stocktake](/glossary/stocktake) finds and nobody recorded.

## Why it matters

Waste raises your [food cost percentage](/glossary/food-cost-percentage) without a single price changing. Recording it, with a reason, is what turns it into something you can fix.

## How to reduce it

1. Record every write-off with a reason, every time.
2. Set [par levels](/glossary/par-level) so you are not over-ordering.
3. Prep to forecast, using your sales by hour and by day.
4. Rotate stock — first in, first out.

## Tracking it in DUMA

Write stock off with a reason as it happens. The **Waste & loss** report shows what was written off, by reason and by item, so the same problem showing up week after week is easy to spot.
`,
    faq: [
      {
        question: 'Is staff food counted as waste?',
        answer: 'Record it separately. It is a real cost, but mixing it with waste hides the waste you can prevent.',
      },
      {
        question: 'What is an acceptable level of food waste?',
        answer: 'There is no universal figure. Measure your own for a month, then aim to bring it down — most kitchens find easy wins in the first few weeks.',
      },
      {
        question: 'Does waste include customer plate waste?',
        answer: 'It can, but it is usually tracked separately because the fix is different — portion size rather than stock control.',
      },
    ],
  },
  {
    slug: 'cash-up',
    title: 'What is a cash-up?',
    term: 'Cash-up (end-of-day report)',
    short: 'Closing the till at the end of the day: counting what is there and checking it against what the sales say should be.',
    updated: '2026-11-03',
    related: ['average-order-value', 'stocktake'],
    seeIt: { path: '/solutions/bars', label: 'Nightly cash-up for bars and pubs' },
    body: `
At the end of the day someone counts the drawer. The till says there should be £412.50 in cash; the drawer has £402.50. Cashing up is how that £10 gets noticed tonight rather than at the year-end.

## How a cash-up works

1. Count the cash in the drawer, leaving the float — the change you start each day with — to one side.
2. Compare the counted cash with the cash sales the till recorded.
3. Check card takings against the card machine's own end-of-day total.
4. Record the difference, and a reason if you know it.

## Over and short

> Difference = counted − expected

A small difference either way is usually a counting or change-giving mistake. A pattern — always short on the same shift — is worth a closer look.

## X and Z reports

On traditional tills you will hear:

- **X report** — a reading of the day so far, which does not reset anything. Useful at a shift change.
- **Z report** — the end-of-day report that closes the day's totals and starts a fresh day.

## Why it matters

- It catches mistakes while people still remember the day.
- It gives your bookkeeper a clean daily record of cash and card.
- It is part of keeping accurate records for VAT and tax.

## Common mistakes

1. **Counting the float as takings.** Take it out first, every time.
2. **Only checking cash.** Card differences happen too — a payment taken on the wrong machine, or a refund not put through the till.
3. **Writing off differences without a note.** The reason is what helps next time.

## Tracking it in DUMA

Cash up the till at the end of the day: DUMA works out what should be there and records what you counted. The **End of day** report shows each day's cash-up — expected against counted, cash and card — and **Payment methods** shows card, cash and other tenders, net of refunds.

Count a drawer note by note, and see if it is over or short and what to bank, with the free [cash-up calculator](/tools/cash-up-calculator).
`,
    faq: [
      {
        question: 'How much float should a till have?',
        answer: 'Enough change for a typical morning — often £100–£200 in a mix of coins and small notes. Keep it the same every day so it is easy to take out.',
      },
      {
        question: 'Who should do the cash-up?',
        answer: 'Ideally a manager, or two people together. The same person every night makes differences easier to trace.',
      },
      {
        question: 'Do I still need to cash up if I am mostly card?',
        answer: 'Yes — card totals should still be checked against your card machine, and the few cash payments are the ones most likely to go wrong.',
      },
    ],
  },
  {
    slug: 'customer-retention',
    title: 'What is customer retention?',
    term: 'Customer retention',
    short: 'How many of your customers come back — usually measured as the repeat customer rate.',
    updated: '2026-10-31',
    related: ['average-order-value', 'menu-engineering'],
    seeIt: { path: '/solutions/shops', label: 'Loyalty and repeat customers for clothing shops and online stores' },
    body: `
A regular who comes in three times a week is worth more than any marketing campaign. Customer retention measures how many customers come back, and the most practical way to measure it is the repeat customer rate.

## The formula

> Repeat customer rate = customers who ordered more than once ÷ all customers in the period × 100

## A worked example

In a month, 600 customers you can identify ordered from you. 210 of them ordered more than once.

210 ÷ 600 = **35%**.

## Why it matters

- Returning customers cost nothing to find again.
- They tend to spend more over time, and they bring friends.
- A falling repeat rate is an early warning — about quality, service or a competitor — before sales start to drop.

## You can only measure who you know

Retention needs to recognise a customer when they come back. That means a loyalty account, an email on a QR-code order, or a phone number on a booking. Anonymous card and cash sales cannot be counted.

## How to improve it

1. Give people a reason to be recognised — a loyalty reward, a receipt by email.
2. Follow up: a thank-you, a birthday offer, news of a new menu — only to people who agreed to hear from you.
3. Watch which first orders turn into second ones; that is your best product.

## Common mistakes

1. **Counting visits, not customers.** Ten visits from one regular is one customer.
2. **Too short a window.** A monthly repeat rate suits a café; a clothing shop needs a longer one.
3. **Messaging people who did not consent.** It costs trust and breaks the rules.

## Tracking it in DUMA

The **Customer retention** report shows new and returning customers and the repeat rate. Loyalty, customer records and marketing consent live in the same place, so you can follow up with the people who agreed to hear from you.
`,
    faq: [
      {
        question: 'What is a good repeat customer rate?',
        answer: 'It depends heavily on what you sell and how often people need it. A neighbourhood café can see far higher repeat rates than a gift shop. Track your own trend.',
      },
      {
        question: 'Is retention the same as loyalty?',
        answer: 'Retention is the measurement — did they come back. Loyalty programmes are one way to improve it.',
      },
      {
        question: 'How can I measure retention without a loyalty scheme?',
        answer: 'Any way of recognising a returning customer works: an email on online orders, a phone number on bookings. Without one, retention cannot be measured.',
      },
    ],
  },
  {
    slug: 'cost-of-goods-sold',
    title: 'What is cost of goods sold (COGS)?',
    term: 'Cost of goods sold (COGS)',
    short: 'What the stock you actually sold cost you to buy or make — the cost that sits against your sales.',
    updated: '2026-10-31',
    related: ['gross-profit-margin', 'food-cost-percentage', 'stocktake', 'prime-cost'],
    seeIt: { path: '/solutions/retail', label: 'Stock, stocktakes and supplier orders for retail shops' },
    body: `
Your accountant, your bank and every margin you calculate start from the same figure: what the things you sold cost you. Not what you bought this month — what you used up making the sales. That is cost of goods sold, or COGS.

## The formula

> COGS = opening stock + purchases − closing stock

For one item, COGS is simply what it cost you: the ingredients in a dish, or the price you paid your supplier for a T-shirt.

## A worked example

A clothing shop starts the month with £8,000 of stock at cost, buys £5,000 more, and counts £7,500 left at the end.

£8,000 + £5,000 − £7,500 = **£5,500** of goods sold.

If sales for the month were £13,750 before VAT, gross profit was £8,250 — a 60% margin.

## Purchases are not COGS

A big delivery on the last day of the month is not this month's cost: most of it is still on the shelf. Using purchases instead of usage makes good months look bad and bad months look good. The closing [stocktake](/glossary/stocktake) is what makes COGS honest.

## What goes in it

- The ingredients or products themselves, at the price you paid.
- Packaging that leaves with the customer — takeaway cups, boxes, bags.
- Delivery charges from suppliers, if you pay them per order.

Wages, rent and energy do not go in COGS; they are operating costs. In restaurants, COGS plus labour is [prime cost](/glossary/prime-cost).

## Common mistakes

1. **Using purchases instead of usage.** Always adjust for opening and closing stock.
2. **Counting stock at selling price.** Stock is valued at what you paid.
3. **Forgetting waste and staff food.** They are used up too — record them so the gap is explained, see [wastage](/glossary/wastage).

## Tracking it in DUMA

Every menu item with a recipe has its ingredient cost worked out, so each sale carries its own cost. The **Stock usage** report shows what was used, received and adjusted item by item, and stocktakes correct the counts that COGS depends on.
`,
    faq: [
      {
        question: 'Is COGS the same as food cost?',
        answer: 'In a kitchen, food cost is the food part of COGS. Food cost percentage is COGS for food divided by food sales.',
      },
      {
        question: 'Does COGS include VAT?',
        answer: 'If you are VAT-registered and reclaim the VAT on purchases, use costs without VAT. If you are not registered, the VAT you pay is part of your cost.',
      },
      {
        question: 'Do I need COGS if I do not do stocktakes?',
        answer: 'You can estimate it from recipe costs and sales, but without a count you will not see waste, theft or mistakes. A regular stocktake is what makes it real.',
      },
    ],
  },
  {
    slug: 'recipe-costing',
    title: 'What is recipe costing?',
    term: 'Recipe costing',
    short: 'Working out exactly what one portion of a dish costs from the quantity and price of every ingredient in it.',
    updated: '2026-11-03',
    related: ['food-cost-percentage', 'gross-profit-margin', 'modifiers', 'menu-engineering'],
    seeIt: { path: '/solutions/cafes', label: 'Recipe costing for cafés and restaurants' },
    body: `
"About £3" is not a cost. Recipe costing turns a dish into a list — 150g of beef, one brioche bun, 20g of cheese, 15ml of sauce — and prices each line, so you know to the penny what a portion costs and whether its price still works.

## How to cost a recipe

1. List every ingredient in one portion, including garnish, oil and sauce.
2. Write the quantity used, in the unit you buy it in or one you can convert.
3. Work out the cost per unit from what you pay: a £9.60 5kg bag of flour is about £0.0019 per gram.
4. Multiply and add up.

> Portion cost = Σ (quantity used × cost per unit)

## A worked example

| Ingredient | Used | Cost per unit | Cost |
| --- | --- | --- | --- |
| Beef mince | 150g | £10.00 / kg | £1.50 |
| Brioche bun | 1 | £0.45 each | £0.45 |
| Cheddar | 20g | £8.50 / kg | £0.17 |
| Sauce and garnish | — | — | £0.18 |
| **Total** | | | **£2.30** |

At £11 including VAT — £9.17 before VAT at 20% — the burger has a [food cost](/glossary/food-cost-percentage) of 25%.

## Yield matters

Trimming, peeling and cooking all lose weight. If a 1kg piece of salmon gives 820g you can serve, the real cost per gram is a fifth higher than the invoice says. Cost from the usable weight.

## Why it matters

- It shows which dishes earn their place, before a month of sales tells you the hard way.
- When a supplier raises a price, you can see every dish it affects.
- It is the foundation of [menu engineering](/glossary/menu-engineering) and of an accurate margin.

## Common mistakes

1. **Leaving out the small things.** Oil, butter, garnish and sauces add up across hundreds of portions.
2. **Costing once.** A recipe card from last year is costed at last year's prices.
3. **Ignoring extras.** A dish with an added topping has a different cost — see [modifiers](/glossary/modifiers).

## Tracking it in DUMA

Give a menu item a recipe from your stock items and DUMA works out its cost, and its margin with VAT taken out of the price when you are VAT-registered. Modifiers can carry their own recipes, so an extra shot or a swapped milk is costed too. Sales then use up stock from the same recipes.

Cost a single recipe now, and see its margin after VAT, in the free [menu margin calculator](/tools/margin-calculator).
`,
    faq: [
      {
        question: 'How often should I re-cost recipes?',
        answer: 'Whenever a supplier changes a price on a main ingredient, and at least every few months. Prices rarely move only once.',
      },
      {
        question: 'Should labour be included in recipe cost?',
        answer: 'Usually not — recipe cost is ingredients only, and labour is tracked across the whole business. But note dishes that are slow to make: they cost more than the card says.',
      },
      {
        question: 'Can I cost drinks the same way?',
        answer: 'Yes. A latte is espresso, milk and a cup; a cocktail is its measures. Drinks are often where the best margins are hiding.',
      },
    ],
  },
  {
    slug: 'modifiers',
    title: 'What are modifiers?',
    term: 'Modifiers',
    short: 'The options a customer can add to or change in an item — oat milk, an extra shot, no onions, a size — and the price and cost that come with them.',
    updated: '2026-10-31',
    related: ['recipe-costing', 'average-order-value', 'epos'],
    seeIt: { path: '/solutions/cafes', label: 'The café and restaurant EPOS, with options on every item' },
    body: `
"Large oat latte, extra shot, no sugar." One item, three modifiers. Modifiers are how a till records the choices customers make, so the kitchen gets the order right, the price is right, and the cost is right.

## Kinds of modifier

- **Additions** — an extra shot, a side of fries, a topping. Usually priced.
- **Swaps** — oat milk for dairy, gluten-free bread. Sometimes priced.
- **Removals** — no onions, no ice. Usually free, but they still matter to the kitchen.
- **Choices** — a size, how a steak is cooked, a flavour. Often required before the item can be added.

## Why they matter

- **Price.** A 50p extra shot on a third of your coffees adds up to real money — and only if the till charges it every time.
- **Cost.** Oat milk costs more than dairy. If the swap is free, your margin on that drink falls; you should know by how much.
- **Accuracy.** A modifier prints on the ticket or shows on the kitchen screen, so allergies and preferences are not passed on by memory.
- **Upselling.** Offering the addition at the moment of ordering is the easiest way to raise [average order value](/glossary/average-order-value).

## Setting them up well

1. Group them: "Milk", "Extras", "Size".
2. Mark the required choices as required, so the order cannot be sent without them.
3. Price every addition — even 20p.
4. Cost them, so a modifier does not quietly eat the margin.

## Common mistakes

1. **Free text instead of modifiers.** A typed note cannot be priced, costed or counted.
2. **Too many options.** A long list slows down the queue. Keep the common ones one tap away.
3. **Not costing swaps.** Every plant milk swap given away changes the dish's real cost — see [recipe costing](/glossary/recipe-costing).

## In DUMA

Modifiers are set up once and attached to items on the till, the QR code menu and the kitchen display. A modifier can have its own price and its own recipe, so DUMA uses up the right stock and works out the real margin of each combination.
`,
    faq: [
      {
        question: 'Should I charge for plant-based milk?',
        answer: 'That is a business decision. Either way, cost it, so you know what the choice is worth to you.',
      },
      {
        question: 'Do modifiers work for shops?',
        answer: 'Shops usually use variants — size and colour — for things that are separate stock. Modifiers suit additions like gift wrap or engraving.',
      },
      {
        question: 'How do modifiers help with allergies?',
        answer: 'A recorded "no nuts" reaches the kitchen exactly as entered, instead of relying on someone remembering a spoken request.',
      },
    ],
  },
  {
    slug: 'net-sales',
    title: 'What is the difference between gross and net sales?',
    term: 'Net sales (vs gross sales)',
    short: 'Gross sales are everything rung up; net sales are what is left after refunds, discounts and VAT — the money that is actually yours.',
    updated: '2026-10-31',
    related: ['vat-inclusive-pricing', 'discounts-and-voids', 'gross-profit-margin', 'average-order-value'],
    seeIt: { path: '/solutions/bars', label: 'Takings and cash-up for bars and pubs' },
    body: `
Your till says you took £5,000 on Saturday. Some of that went back as refunds, some was knocked off as discounts, and a sixth of it belongs to HMRC if you are VAT-registered. Net sales is what is left once all of that comes out.

## The formulas

> Gross sales = the total value of everything sold, at full price

> Net sales = gross sales − refunds − discounts − VAT

Businesses that are not VAT-registered do not take VAT out — they do not charge it.

## A worked example

| | |
| --- | --- |
| Gross sales (including VAT) | £5,000 |
| Refunds | − £120 |
| Discounts | − £280 |
| Sales after refunds and discounts | £4,600 |
| VAT at 20% (£4,600 ÷ 6) | − £766.67 |
| **Net sales** | **£3,833.33** |

## Which one to use

- **Net sales** for anything about profit: margins, [food cost](/glossary/food-cost-percentage), labour %, prime cost.
- **Gross sales** for the size of the trade — and next to net sales, the gap shows how much refunds and discounts are costing.

## Why it matters

Every ratio you run your business on divides by sales. Divide by gross sales and every cost looks smaller than it is: a 30% food cost on net sales can look like 24% on gross.

## Common mistakes

1. **Comparing gross to someone else's net.** Always check which one a benchmark uses.
2. **Forgetting refunds.** A refund given on Monday for Saturday's sale belongs in the numbers.
3. **Mixing VAT-inclusive and VAT-exclusive figures.** Pick one and use it everywhere — net, without VAT, is the safe choice. See [VAT-inclusive pricing](/glossary/vat-inclusive-pricing).

## Tracking it in DUMA

The **Sales summary** report shows gross and net sales, refunds, orders and average order, day by day. **Discounts & voids** shows what discounts cost you, and the **VAT** report shows the VAT in your sales, split by rate.
`,
    faq: [
      {
        question: 'Is net sales the same as profit?',
        answer: 'No. Net sales is revenue after refunds, discounts and VAT. Profit is what is left after your costs are taken off that.',
      },
      {
        question: 'Do tips count as sales?',
        answer: 'Tips usually belong to staff rather than the business and are kept out of sales. How they are handled for tax is worth checking with your accountant.',
      },
      {
        question: 'Do card fees come off net sales?',
        answer: 'No. Card processing fees are a cost of the business, not a reduction in sales. Track them as an expense.',
      },
    ],
  },
  {
    slug: 'vat-inclusive-pricing',
    title: 'What is VAT-inclusive pricing?',
    term: 'VAT-inclusive pricing',
    short: 'Showing customers prices with VAT already included — and knowing how much of each price is really yours.',
    updated: '2026-11-03',
    related: ['net-sales', 'gross-profit-margin', 'margin-vs-markup'],
    seeIt: { path: '/solutions/bakeries', label: 'Recipe costing with the right VAT on every bake' },
    metaTitle: 'What is VAT-Inclusive Pricing? A UK Guide | DUMA',
    body: `
UK consumers expect the price on the menu or the tag to be the price they pay. So if you are VAT-registered, the VAT is inside the price — and part of every £4 coffee is not yours. VAT-inclusive pricing is simple for customers and easy to get wrong in your own numbers.

## Taking VAT out of a price

At the 20% standard rate:

> Price before VAT = price including VAT ÷ 1.2

> VAT in the price = price including VAT ÷ 6

A £4.20 flat white is £3.50 before VAT, with £0.70 of VAT in it.

For any rate:

> VAT in the price = price × rate ÷ (100 + rate)

## Which rate applies?

UK VAT on food and drink depends on what you sell and how — for example, many cold takeaway foods are zero-rated while hot takeaway food and food eaten in are standard-rated. The rules have detail and exceptions, so check HMRC's guidance for your products, or ask your accountant.

## Why it matters

- **Margins.** A dish's margin must be worked out from the price before VAT, or it is overstated by the whole VAT fraction.
- **Pricing.** Decide the price you need before VAT, then add VAT to get the menu price — not the other way round.
- **Your return.** The VAT you charge has to be reported and paid, split by rate.

## A worked example

You want a 70% margin on a dish costing £2.40. The price before VAT is £2.40 ÷ 0.30 = £8.00. Add 20% VAT and the menu price is **£9.60**. Price it at £8 including VAT by mistake and your margin falls to 64%.

## Common mistakes

1. **Working margins from the menu price.** See [margin vs markup](/glossary/margin-vs-markup) and [gross profit margin](/glossary/gross-profit-margin).
2. **One rate for everything.** Mixed menus can carry more than one rate.
3. **Rounding before adding VAT.** Set the menu price you want, then check what is left after VAT.

## Tracking it in DUMA

DUMA takes VAT out of the selling price when it works out an item's margin, if your business is VAT-registered — so the margin matches what you keep. The **VAT** report shows the VAT charged on your sales, split by rate, for your return.

See what the VAT does to one dish's margin in the free [menu margin calculator](/tools/margin-calculator): switch between VAT in the price, on top, and not registered.
`,
    faq: [
      {
        question: 'Do I have to show prices including VAT?',
        answer: 'Prices shown to consumers in the UK should be the full price they will pay, including VAT. Business-to-business prices are often shown without VAT.',
      },
      {
        question: 'What if I am not VAT-registered?',
        answer: 'Then you do not charge VAT, and the whole price is yours. Watch your turnover: once it passes the registration threshold you must register.',
      },
      {
        question: 'Is service charge subject to VAT?',
        answer: 'It depends on whether it is optional. The rules are specific, so check HMRC guidance or ask your accountant.',
      },
    ],
  },
  {
    slug: 'discounts-and-voids',
    title: 'What are discounts and voids?',
    term: 'Discounts and voids',
    short: 'Money knocked off a sale, and items or orders cancelled before they were paid — both worth tracking by reason.',
    updated: '2026-10-31',
    related: ['net-sales', 'cash-up', 'gross-profit-margin'],
    seeIt: { path: '/solutions/bars', label: 'Cash-up against expected cash and card for bars and pubs' },
    body: `
A free coffee for a regular. Ten percent off for staff. A pint poured and then cancelled. Each one is small, and each one is money. Discounts and voids are where takings quietly go missing — sometimes by policy, sometimes by mistake, occasionally on purpose.

## What is the difference?

- **Discount** — the sale happened, at a lower price. The customer paid less than the menu price.
- **Void** — an item or an order was cancelled before payment, so it never became a sale.
- **Refund** — the sale was paid, then money went back to the customer.

## Why they matter

> Discount rate = discounts ÷ gross sales × 100

A 3% discount rate on £400,000 of sales is £12,000 a year. Some of that is worth it — loyalty, staff meals, a recovered complaint. Some of it is habit. And voids are one of the classic ways cash goes missing at a till: ring up, take the cash, void the item.

## Track them by reason

A reason on every discount and void turns a single number into something you can act on:

- "Staff meal" and "manager comp" are policy — check they match the policy.
- "Wrong order" points at the till, the menu or training.
- "Customer complaint" points at the kitchen or the service.
- Lots of voids on one person's shifts is worth a quiet look.

## Common mistakes

1. **Free-text reasons.** "misc" tells you nothing. Use a short fixed list.
2. **Anyone can void anything.** Limit voids after an order is sent, or after payment, to people who should be able to.
3. **Leaving discounts out of margins.** A discounted sale has the same cost and a smaller price — see [net sales](/glossary/net-sales).

## Tracking it in DUMA

The till asks for a reason when an item or order is voided. The **Discounts & voids** report shows discounts given and orders voided, by reason, and **Refunds** shows every refund, its reason and who gave it.
`,
    faq: [
      {
        question: 'Are staff meals discounts?',
        answer: 'If they go through the till at a reduced price, yes. Recording them with their own reason keeps them separate from customer discounts.',
      },
      {
        question: 'Is a high void count always a problem?',
        answer: 'Not always — a new menu or a new team makes more mistakes. A sudden rise, or voids concentrated on one person or shift, is worth investigating.',
      },
      {
        question: 'Should discounts show on the receipt?',
        answer: 'Yes. It shows the customer what they saved and keeps the sale and the discount clear in your records.',
      },
    ],
  },
  {
    slug: 'staff-rota',
    title: 'What is a staff rota?',
    term: 'Staff rota',
    short: 'The schedule of who works when — built around when you actually trade, and shared with the team in advance.',
    updated: '2026-10-31',
    related: ['labour-cost-percentage', 'prime-cost', 'average-order-value'],
    seeIt: { path: '/solutions/cafes', label: 'Staff rotas on your team’s phones for cafés and restaurants' },
    body: `
A good rota has the right people in at the right times: enough for the rush, not a crowd for the quiet hour after. Get it wrong one way and service suffers; the other way and [labour cost](/glossary/labour-cost-percentage) eats the day's profit.

## Building one

1. **Start from your sales by hour.** Your busiest hours, not your opening hours, decide who you need.
2. **Set the shape of the day.** Opening, the rush, the lull, close. Each needs a different team.
3. **Fill the key roles first.** A shift without someone who can open, cash up or lead the kitchen is not a full shift.
4. **Check the cost.** Hours × rates against the sales you expect.
5. **Publish it early.** People have lives; a rota shared a week or more ahead is a rota people turn up for.

## Labour budget

> Labour budget = expected sales × target labour %

If you expect £18,000 of sales next week and aim for 28% labour, you have about £5,040 to spend on the rota, including employer's National Insurance, pension and holiday pay.

## Why it matters

- It is the biggest cost you set each week.
- It is what staff feel most: fair shifts and early notice keep people.
- Compared with clocked hours, it shows where shifts run long.

## Common mistakes

1. **Copying last week.** Sales change with the weather, the season and the school holidays.
2. **Rota by availability only.** Who can work matters; who is needed matters more.
3. **No record of actual hours.** Without clock-ins, you cannot compare the plan with what happened.

## Tracking it in DUMA

Build the week's rota and publish it to the team, with open shifts for people to pick up. Staff clock in and out on the device, so planned and worked hours sit side by side. The **Sales by hour** report shows when you trade, and **Labour vs sales** shows labour %, and sales per labour hour, against what you took.
`,
    faq: [
      {
        question: 'How far ahead should I publish the rota?',
        answer: 'At least a week is good practice, and two is better. Late changes are a common reason people leave hospitality jobs.',
      },
      {
        question: 'What is an open shift?',
        answer: 'A shift that needs covering but has no one assigned. Team members can pick it up, instead of a manager ringing round.',
      },
      {
        question: 'Should the rota include break times?',
        answer: 'Yes. Breaks change who is on the floor at any moment, and staff are entitled to rest breaks by law.',
      },
    ],
  },
  {
    slug: 'epos',
    title: 'What is EPOS?',
    term: 'EPOS (electronic point of sale)',
    short: 'The till system where sales are taken and paid — and, in a modern one, where stock, staff and reports are connected to them.',
    updated: '2026-10-31',
    related: ['kitchen-display-system', 'modifiers', 'cash-up', 'qr-code-ordering'],
    seeIt: { path: '/solutions/cafes', label: 'The EPOS for UK cafés and restaurants that works offline' },
    metaTitle: 'What is EPOS? A UK Guide for Small Businesses | DUMA',
    body: `
The cash register rang up a price and kept the money. An EPOS — electronic point of sale — does that and remembers everything about the sale: what was sold, to whom, by whom, how it was paid, and what stock it used.

## What an EPOS does

- **Takes orders** — items, [modifiers](/glossary/modifiers), tables or names.
- **Takes payment** — cash, card, or split between them.
- **Sends orders on** — to a kitchen printer or a [kitchen display](/glossary/kitchen-display-system).
- **Keeps records** — every sale, refund, discount and void, for the [cash-up](/glossary/cash-up) and for your accountant.
- **Feeds the rest of the business** — stock goes down, customer history builds up, reports fill in.

## Hardware or browser?

Older systems run on dedicated terminals with software installed on them. Newer ones run in a web browser on a tablet, laptop or phone you already own. Either way, the question to ask is what happens when the internet drops.

## Questions to ask before you choose

1. **Does it keep selling offline?** And what happens to sales taken while it was offline?
2. **Which card machines work with it?**
3. **Does it do stock and recipes,** or only sales?
4. **What does it cost** — per month, per terminal, and per transaction?
5. **Can you get your data out** if you leave?

## Common mistakes

1. **Choosing on the till screen alone.** Most of the value is in what happens after the sale.
2. **Paying for features in five separate apps** that should be one system.
3. **No plan for the internet going down** on a Saturday night.

## In DUMA

DUMA's till runs in the browser on any device and can be installed like an app. It keeps taking orders offline; a sale that cannot be sent is kept for you to check, never dropped. Square, SumUp and Stripe card machines connect directly, and any other card machine works with the amount keyed in. Receipts print from the browser; dedicated printer and cash drawer support is coming.
`,
    faq: [
      {
        question: 'What is the difference between POS and EPOS?',
        answer: 'In practice, nothing — EPOS is the term more common in the UK, and stresses that the system is electronic rather than a cash register.',
      },
      {
        question: 'Do I need special hardware?',
        answer: 'Not for a browser-based system. A tablet or laptop and your card machine are often enough to start.',
      },
      {
        question: 'Can an EPOS work without internet?',
        answer: 'Some can and some cannot. Ask specifically what happens to sales taken offline, and when they are sent.',
      },
    ],
  },
  {
    slug: 'kitchen-display-system',
    title: 'What is a kitchen display system (KDS)?',
    term: 'Kitchen display system (KDS)',
    short: 'A screen in the kitchen that shows orders as they come in from the till and online, instead of paper tickets.',
    updated: '2026-10-31',
    related: ['epos', 'modifiers', 'qr-code-ordering'],
    seeIt: { path: '/solutions/cafes', label: 'The kitchen screen for cafés and restaurants' },
    body: `
Paper tickets get lost, get splashed and get read wrong. A kitchen display system puts every order on a screen the moment it is placed, in order, with every [modifier](/glossary/modifiers) on it — and the chef marks it done with a tap.

## How it works

1. An order is taken at the till, by QR code or online.
2. It appears on the kitchen screen as a ticket, with its time.
3. The kitchen works through the tickets; older ones stand out.
4. When it is ready, the chef **bumps** it — marks it done — and it leaves the screen.

## Why kitchens switch

- **No lost tickets.** Every order is on the screen until it is done.
- **Clear modifiers.** "No onions" is printed in the same place every time, not scribbled.
- **Timing.** Each ticket shows how long it has been waiting, so a slow order is obvious before the customer complains.
- **One queue.** Till, QR code and online orders arrive in the same place.

## What to look for

1. Orders from every channel on one screen.
2. Clear ticket times and colours as they age.
3. A simple bump, with a way to bring back one bumped by mistake.
4. A screen that keeps working if the connection is patchy.

## Common mistakes

1. **A screen nobody can see.** Mount it where the person plating can read it without stopping.
2. **Too much on one ticket.** Keep the layout readable at a glance.
3. **Keeping paper "just in case".** Two systems means the one that matters is never quite trusted.

## In DUMA

DUMA's kitchen display shows tickets from the till and from QR code orders as they are placed, with their modifiers and how long they have been waiting. Bump a ticket when it is ready. It runs in the browser on any screen — a tablet on the pass is enough.
`,
    faq: [
      {
        question: 'Do I need a special screen for a KDS?',
        answer: 'Not for a browser-based one — a tablet or any screen with a browser will do. Pick one that is bright and easy to read from a step away.',
      },
      {
        question: 'Can a KDS replace a kitchen printer?',
        answer: 'For most kitchens, yes. Some keep a printer for the pass or for delivery bags.',
      },
      {
        question: 'What does bumping an order mean?',
        answer: 'Marking it done on the screen. The ticket disappears, and the order can be called or served.',
      },
    ],
  },
  {
    slug: 'qr-code-ordering',
    title: 'What is QR code ordering?',
    term: 'QR code ordering',
    short: 'Customers scan a code with their phone, see the menu and place their order — no app, and no waiting to be served.',
    updated: '2026-10-31',
    related: ['epos', 'kitchen-display-system', 'average-order-value', 'customer-retention'],
    seeIt: { path: '/solutions/cafes', label: 'QR ordering for cafés and restaurants' },
    body: `
A customer sits down, scans a code on the table or the counter, and the menu opens on their phone. They choose, add their extras, and send the order. It goes straight to the kitchen. That is QR code ordering — and for busy counters and small teams, it can feel like an extra member of staff.

## How it works

1. You print a QR code linked to your menu.
2. The customer scans it with their phone camera — no app to download.
3. They browse, choose [modifiers](/glossary/modifiers), and place the order.
4. They pay, or choose to pay at the counter, and the order reaches the [kitchen display](/glossary/kitchen-display-system).

## Why businesses use it

- **Shorter queues.** Customers order while they wait.
- **Bigger orders.** Photos and suggested extras raise [average order value](/glossary/average-order-value) — people browse longer on their own phone.
- **Fewer mistakes.** The customer writes the order; no one mishears it.
- **A way to know your customers.** An optional email links orders to a loyalty account, which helps [customer retention](/glossary/customer-retention).

## What makes it work

1. A short, fast menu — people are on mobile data.
2. Photos for the dishes you most want to sell.
3. A clear collection time, so customers know when to come back.
4. Staff who still say hello. QR ordering replaces the queue, not the welcome.

## Common mistakes

1. **Forcing an account or an app.** Every extra step loses orders.
2. **A menu that does not match the till.** Out-of-stock items must disappear everywhere at once.
3. **Hiding it.** Put the code where people stand and sit, at eye level.

## In DUMA

Guests scan your code and order without an account, choosing a collection time. They pay as you allow, including at the counter, and the order arrives on the kitchen display next to the till's. They can add an email to link the order to their loyalty account. The menu is the same one the till uses, so changes and sold-out items show everywhere.
`,
    faq: [
      {
        question: 'Do customers need an app?',
        answer: 'No. A QR code opens a web page in the phone camera’s browser.',
      },
      {
        question: 'Is QR ordering only for table service?',
        answer: 'No. It works well at counters and for collection, where it takes the queue off the till.',
      },
      {
        question: 'What if a customer does not have a smartphone?',
        answer: 'Keep the till open for them. QR ordering works best as an extra way to order, not the only one.',
      },
    ],
  },
  {
    slug: 'stock-variance',
    title: 'What is stock variance?',
    term: 'Stock variance (shrinkage)',
    short: 'The gap between the stock your records say you have and the stock you count — in retail, often called shrinkage.',
    updated: '2026-10-31',
    related: ['stocktake', 'wastage', 'cost-of-goods-sold', 'par-level'],
    seeIt: { path: '/solutions/retail', label: 'Stocktake differences for retail shops' },
    body: `
Your records say 40 bottles of gin. You count 36. Those four bottles are stock variance. In retail the same gap is called **shrinkage**: stock that left without being sold or recorded.

## The formulas

> Variance = counted stock − expected stock

> Variance % = variance ÷ expected stock × 100

Value it at cost price. A negative variance means stock is missing; a positive one usually means something was received without being recorded.

## A worked example

| Item | Expected | Counted | Variance | Cost each | Value |
| --- | --- | --- | --- | --- | --- |
| Gin, 70cl | 40 | 36 | −4 | £14.00 | −£56.00 |
| Oat milk, 1L | 24 | 17 | −7 | £1.60 | −£11.20 |
| Napkins, pack | 10 | 11 | +1 | £3.00 | +£3.00 |

The gin is the line to look at first: the fewest units and the most money.

## Where variance comes from

- **Unrecorded waste** — spoiled, dropped, sent back. See [wastage](/glossary/wastage).
- **Over-pouring and over-portioning** — the recipe says 25ml; the hand says otherwise.
- **Delivery mistakes** — short deliveries signed for in full.
- **Counting and unit errors** — a case counted as one bottle.
- **Theft** — by staff or customers. Less common than the others, but real.

## Why it matters

Variance is profit you paid for and never sold. A few percent on a busy bar or shop is thousands a year — and the same items showing up count after count tell you exactly where to look.

## Common mistakes

1. **Only looking at the total.** A small total can hide one big loss behind several small gains.
2. **Correcting without investigating.** The reason is the useful part.
3. **Counting too rarely.** Monthly variance has a month of possible causes.

## Tracking it in DUMA

A [stocktake](/glossary/stocktake) in DUMA shows what was expected next to what you counted for each item, and updates the records from the count. Stock written off with a reason appears in the **Waste & loss** report, so the gap you cannot explain gets smaller.
`,
    faq: [
      {
        question: 'What is an acceptable stock variance?',
        answer: 'It depends on the product — fresh food will always vary more than bottled drinks. Watch your trend and your highest-value lines.',
      },
      {
        question: 'Is shrinkage the same as theft?',
        answer: 'No. Shrinkage includes theft but also waste, damage, admin errors and supplier mistakes.',
      },
      {
        question: 'How do I reduce variance on spirits?',
        answer: 'Use measures, count your highest-value bottles more often, and check deliveries against the invoice before signing.',
      },
    ],
  },
  {
    slug: 'purchase-order',
    title: 'What is a purchase order?',
    term: 'Purchase order (PO)',
    short: 'A written order to a supplier for what you want delivered, at what price — and the record you check the delivery against.',
    updated: '2026-10-31',
    related: ['par-level', 'stock-variance', 'cost-of-goods-sold'],
    seeIt: { path: '/solutions/retail', label: 'Supplier orders checked in against deliveries, for retail shops' },
    body: `
"Can you send the usual?" works until the usual changes, the price goes up, or half of it does not arrive. A purchase order writes down what you asked for, so you can check what came.

## What a purchase order includes

- The supplier.
- Each item, the quantity and the agreed price.
- The delivery date and where it should go.
- A reference number to match against the delivery note and the invoice.

## The purchase-to-pay flow

1. **Count** — check what you have against your [par levels](/glossary/par-level).
2. **Order** — raise a purchase order for the difference.
3. **Receive** — when it arrives, check it against the order: items, quantities, condition.
4. **Record** — put the delivery into stock, noting anything short or damaged.
5. **Pay** — match the invoice to the order and what was received before paying.

## Why it matters

- **Fewer short deliveries signed for in full** — one of the quiet causes of [stock variance](/glossary/stock-variance).
- **Price checks.** If the invoice does not match the agreed price, you see it.
- **Accurate stock.** Deliveries received against an order go into your stock records properly.
- **Spending you can see** — by supplier and by week.

## Common mistakes

1. **Ordering by phone with no record.** Then there is nothing to check against.
2. **Receiving without checking.** Count it while the driver is still there.
3. **Paying the invoice, not the order.** Pay for what you ordered and received.

## Tracking it in DUMA

Raise purchase orders to your suppliers in DUMA and receive deliveries against them, so stock goes up by what actually arrived. The **Purchasing** report shows purchase orders raised and received, by supplier.
`,
    faq: [
      {
        question: 'Do small businesses need purchase orders?',
        answer: 'Even a one-person café benefits from a written order — it is the easiest way to catch a short delivery or a price change.',
      },
      {
        question: 'What is the difference between a purchase order and an invoice?',
        answer: 'You send the purchase order to say what you want. The supplier sends the invoice to say what you owe. Matching the two is how you catch mistakes.',
      },
      {
        question: 'What happens if a delivery is short?',
        answer: 'Record what was actually received, so your stock is right, and raise it with the supplier for a credit or a redelivery.',
      },
    ],
  },
  {
    slug: 'loyalty-programme',
    title: 'What is a loyalty programme?',
    term: 'Loyalty programme',
    short: 'A way to reward customers for coming back — points, tiers or a free tenth coffee — and to know who your regulars are.',
    updated: '2026-10-31',
    related: ['customer-retention', 'customer-lifetime-value', 'average-order-value'],
    seeIt: { path: '/solutions/shops', label: 'Loyalty, promotions and referrals for clothing shops and online stores' },
    body: `
The paper stamp card has kept coffee shops' regulars coming back for decades. A loyalty programme does the same job with more information: it rewards people for returning, and it tells you who they are.

## Common kinds

- **Stamps** — buy nine, get the tenth free. Simple and understood by everyone.
- **Points** — earn points for every pound spent, spend them on rewards.
- **Tiers** — the more a customer spends, the higher their tier and the better their rewards.
- **Referrals** — reward a customer for bringing a friend.

## Why it matters

- It gives people a reason to choose you again, and to be recognised when they do.
- It turns anonymous sales into a customer history, which is what makes [customer retention](/glossary/customer-retention) and [lifetime value](/glossary/customer-lifetime-value) measurable.
- It gives you people to tell about a new menu — if they have agreed to hear from you.

## What a reward costs

A free £3.50 coffee costs you its [ingredient cost](/glossary/recipe-costing) — perhaps 60p — not £3.50. Plan rewards at cost, and the programme is cheaper than it looks.

> Cost of rewards = rewards redeemed × cost of each reward

## Designing one that works

1. **Make the first reward reachable.** If it takes a year, people give up.
2. **Keep the rules short.** One sentence a customer can repeat.
3. **Recognise people at the till,** not only in an app.
4. **Ask for consent before marketing.** Joining a loyalty scheme is not agreeing to emails.

## Common mistakes

1. **Rewards that cost more than they bring back.** Track redemptions against repeat visits.
2. **Too much to sign up.** A phone number or an email is enough.
3. **Never using the data.** The list of your regulars is the most valuable thing the programme makes.

## In DUMA

DUMA has loyalty built into customer records: points, tiers and referral codes, with each customer's order history and marketing consent in the same place. Guests ordering by QR code can link an order to their loyalty account with their email.
`,
    faq: [
      {
        question: 'Are loyalty programmes worth it for small cafés?',
        answer: 'Usually, yes — they are cheap to run at cost price and they tell you who your regulars are. Keep them simple.',
      },
      {
        question: 'Points or stamps?',
        answer: 'Stamps are easier to explain; points are more flexible when people buy different things. Many small businesses start with one simple reward.',
      },
      {
        question: 'Can I email loyalty members?',
        answer: 'Only those who agreed to marketing. Record consent separately from loyalty membership.',
      },
    ],
  },
  {
    slug: 'customer-lifetime-value',
    title: 'What is customer lifetime value (CLV)?',
    term: 'Customer lifetime value (CLV)',
    short: 'How much a typical customer spends with you over the whole time they keep coming back.',
    updated: '2026-10-31',
    related: ['customer-retention', 'loyalty-programme', 'average-order-value'],
    seeIt: { path: '/solutions/shops', label: 'Repeat customers for clothing shops and online stores' },
    body: `
A regular who buys a £3.50 coffee five days a week for two years spends about £1,800. Knowing that changes how you think about a free coffee on a bad day. Customer lifetime value — CLV — is that number for a typical customer.

## The formula

A simple version that works for most small businesses:

> CLV = average order value × orders per year × years as a customer

To value it in profit rather than sales, multiply by your gross margin:

> CLV (profit) = CLV × gross profit margin

## A worked example

Your average order is £8.40, a typical regular orders 30 times a year, and they stay about 2 years.

£8.40 × 30 × 2 = **£504** in sales. At a 70% gross margin, that is **£352.80** of gross profit.

## Why it matters

- **It tells you what a customer is worth keeping.** Spending £5 to win back a regular worth £350 is easy maths.
- **It shows what to improve.** CLV rises with [average order value](/glossary/average-order-value), with visits per year and with how long people stay — three different levers.
- **It puts complaints in perspective.** Fixing a problem for a regular is rarely too expensive.

## How to raise it

1. Bring people back sooner — a [loyalty programme](/glossary/loyalty-programme), a reason to return.
2. Raise each order a little — suggest the side, the pastry, the larger size.
3. Keep them longer — consistent quality is the cheapest retention there is.

## Common mistakes

1. **Using revenue as profit.** Multiply by margin before deciding what a customer is worth spending on.
2. **Averaging everyone together.** Regulars and one-off visitors have very different values — look at them separately.
3. **Measuring only who you can identify.** CLV needs a customer record; anonymous sales cannot be followed.

## Tracking it in DUMA

Each customer record in DUMA holds their order history and loyalty, so you can see what a regular spends with you. The **Customer retention** report shows new and returning customers and the repeat rate, and **Sales summary** gives you average order.
`,
    faq: [
      {
        question: 'Is CLV useful for a café?',
        answer: 'Yes — cafés live on regulars, and CLV shows how much each one is worth keeping.',
      },
      {
        question: 'How do I know how long customers stay?',
        answer: 'From customer records over time. Until you have a year of data, use a cautious estimate and update it.',
      },
      {
        question: 'What is a good CLV?',
        answer: 'There is no standard figure. What matters is that it is well above what it costs you to win and keep a customer.',
      },
    ],
  },
  {
    slug: 'sku',
    title: 'What is an SKU?',
    term: 'SKU (stock keeping unit)',
    short: 'A unique code for each product you sell — down to each size and colour — so every one can be counted and tracked.',
    updated: '2026-10-31',
    related: ['stocktake', 'stock-variance', 'par-level', 'purchase-order'],
    seeIt: { path: '/solutions/shops', label: 'Stock by size and colour for clothing shops' },
    body: `
A shop selling a T-shirt in three colours and four sizes is not selling one product — it is selling twelve. Each of those twelve needs its own stock count, because a rail full of smalls does not help the customer who wants a large. That is what an SKU, or stock keeping unit, is for.

## SKU vs barcode

- An **SKU** is your own code, chosen by you, usually readable: \`TEE-BLK-M\`.
- A **barcode** (such as an EAN or UPC) is a standard number printed on the product, often by the manufacturer, for scanning.

One product can have both: the barcode to scan, and the SKU to make sense of it.

## A good SKU scheme

1. **Short and readable** — category, product, variant: \`TEE-BLK-M\`.
2. **Same order every time** — so similar products sort together.
3. **No ambiguous characters** — avoid O and 0, I and 1.
4. **Never reused** — a discontinued SKU stays retired, so old reports still make sense.

## Why it matters

- **Accurate stock** — counted and reordered per size and colour, not per product.
- **Clear reports** — which sizes sell, which colours sit on the shelf.
- **Easier ordering** — a [purchase order](/glossary/purchase-order) by SKU leaves no room for "the blue one".
- **Cleaner stocktakes** — see [stocktake](/glossary/stocktake).

## Common mistakes

1. **One SKU for every variant.** Then you never know which size to reorder.
2. **Meaningless codes.** A random number cannot be read at a glance on the shop floor.
3. **Changing the scheme halfway.** Pick one and stick to it.

## In DUMA

Products can have variants — size, colour or anything else — and each variant can have its own SKU, price and stock, so you can count, sell and reorder every one separately.
`,
    faq: [
      {
        question: 'Do cafés need SKUs?',
        answer: 'Not usually for dishes. They are most useful for retail stock and for anything sold in sizes or colours.',
      },
      {
        question: 'Is an SKU the same as a product code?',
        answer: 'Often, yes. Some businesses use "product code" for the product and "SKU" for each variant of it.',
      },
      {
        question: 'Should my SKU match my supplier’s code?',
        answer: 'It does not have to. Keep your own scheme, and record the supplier’s code alongside it for ordering.',
      },
    ],
  },
];

export function glossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((term) => term.slug === slug);
}

/** The index, A–Z: one group per first letter that has a term. */
export function glossaryByLetter(): { letter: string; terms: GlossaryTerm[] }[] {
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'en-GB'));
  const groups = new Map<string, GlossaryTerm[]>();
  for (const term of sorted) {
    const letter = term.term[0]!.toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), term]);
  }
  return [...groups].map(([letter, terms]) => ({ letter, terms }));
}

/** Slugs of the /glossary/<slug> links in a body, for checking they all resolve. */
export function glossaryLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(\/glossary\/([a-z0-9-]+)\)/g)].map((match) => match[1]!);
}
