import { Check, WifiOff } from '@/components/icons';
import { TONE_FILL } from '@/components/marketing/sections';

import { EXAMPLE_DISH } from '@/lib/marketing/cafes';
import { SALE_TRAIL } from '@/lib/marketing/home';
import { computeCosting } from '@/lib/menu/costing';
import { cn } from '@/lib/utils/cn';
import { fmtGbpExact } from '@/lib/utils/format';

/**
 * Small pieces of the product, drawn in HTML for the feature cards: each one
 * shows the mechanism its card describes. All the data is an example — names,
 * figures and times are made up — and the home page says so once, near the top
 * of the cards. Nothing here claims a feature the product does not have.
 */

const label = 'text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--mkt-ink-3)]';

/** Placed at the bottom of a card, offset so it runs off the card's edge. */
export function Bleed({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mkt-mock relative -mb-px ml-6 rounded-b-none border-b-0 sm:ml-10', className)}>{children}</div>;
}

export function OfflineQueueMock() {
  const rows = [
    { order: 'Order 1043', waiting: true },
    { order: 'Order 1042', waiting: true },
    { order: 'Order 1041', waiting: false },
  ];
  return (
    <Bleed>
      <div className="flex items-center gap-2.5 border-b border-[var(--mkt-line)] px-4 py-3 text-[13px] font-semibold">
        <WifiOff className="size-4 text-stock" aria-hidden="true" />
        Offline — 2 orders waiting to send
      </div>
      <ul className="divide-y divide-[var(--mkt-line)] text-[13px]">
        {rows.map((row) => (
          <li key={row.order} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className="font-mono font-semibold tabular-nums">{row.order}</span>
            <span className="flex items-center gap-2 text-[var(--mkt-ink-2)]">
              {row.waiting ? <span className="queue-wait size-2 rounded-[2px] bg-stock" aria-hidden="true" /> : <Check className="size-3.5 text-primary" aria-hidden="true" />}
              {row.waiting ? 'Saved on this device' : 'Sent'}
            </span>
          </li>
        ))}
      </ul>
    </Bleed>
  );
}

export function SaleTrailMock() {
  return (
    <Bleed>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <div>
          <p className="font-mono text-[11px] text-[var(--mkt-ink-3)]">Till · 08:42</p>
          <p className="text-[13px] font-semibold">Oat flat white + almond croissant</p>
        </div>
        <p className="font-mono text-base font-semibold tabular-nums">£4.85</p>
      </div>
      <ul className="divide-y divide-[var(--mkt-line)]">
        {SALE_TRAIL.slice(0, 4).map((step) => (
          <li key={step.where} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[13px]">
            <span className="flex items-center gap-2 font-semibold">
              <span className={cn('size-2 rounded-[2px]', TONE_FILL[step.tone])} aria-hidden="true" />
              {step.where}
            </span>
            <span className="text-[var(--mkt-ink-2)]">{step.what}</span>
          </li>
        ))}
      </ul>
    </Bleed>
  );
}

const KITCHEN = [
  { lane: 'New', tone: 'orders' as const, tickets: [{ id: '#52', items: '2 × Flat white, 1 × Banana bread', age: '0:40' }] },
  { lane: 'Preparing', tone: 'stock' as const, tickets: [{ id: '#51', items: 'Full breakfast, Latte', age: '4:12' }, { id: '#50', items: '3 × Croissant', age: '5:03' }] },
  { lane: 'Ready', tone: 'team' as const, tickets: [{ id: '#49', items: 'Iced mocha', age: '6:30' }] },
];

export function KitchenMock() {
  return (
    <Bleed className="grid grid-cols-3 gap-px bg-[var(--mkt-line)]">
      {KITCHEN.map((lane) => (
        <div key={lane.lane} className="bg-[var(--mkt-card)] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold">
            <span className={cn('size-2 rounded-[2px]', TONE_FILL[lane.tone])} aria-hidden="true" />
            {lane.lane}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {lane.tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-[5px] border border-[var(--mkt-line)] px-2 py-1.5 text-[11px] shadow-sm">
                <span className="flex justify-between font-mono font-semibold tabular-nums">
                  {ticket.id}
                  <span className="text-[var(--mkt-ink-3)]">{ticket.age}</span>
                </span>
                <span className="mt-0.5 block leading-snug text-[var(--mkt-ink-2)]">{ticket.items}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Bleed>
  );
}

export type CostedItem = {
  name: string;
  price: number;
  /** The item's own VAT rate, in %; omitted means the standard 20%. Bread is zero-rated: 0. */
  vatRate?: number;
  ingredients: readonly { name: string; quantity: string; cost: number }[];
};

function costItem(item: CostedItem) {
  return computeCosting({
    price: item.price,
    cogs: item.ingredients.reduce((sum, ingredient) => sum + ingredient.cost, 0),
    itemVatRate: item.vatRate,
    ctx: { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: true },
  });
}

/** An example item, costed by lib/menu/costing.ts — the product's own margin calculation. */
export function MarginMock({ bleed = true, item = EXAMPLE_DISH }: { bleed?: boolean; item?: CostedItem }) {
  const costing = costItem(item);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <p className="text-[13px] font-semibold">{item.name}</p>
        <p className="font-mono text-sm font-semibold tabular-nums">{fmtGbpExact(costing.price)}</p>
      </div>
      <dl className="divide-y divide-[var(--mkt-line)] text-[13px]">
        {item.ingredients.map((ingredient) => (
          <div key={ingredient.name} className="flex justify-between gap-4 px-4 py-2">
            <dt>
              {ingredient.name} <span className="text-[11px] text-[var(--mkt-ink-3)]">{ingredient.quantity}</span>
            </dt>
            <dd className="font-mono tabular-nums">{fmtGbpExact(ingredient.cost)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 px-4 py-2 text-[var(--mkt-ink-2)]">
          <dt>VAT in the price ({costing.vatRate}%)</dt>
          <dd className="font-mono tabular-nums">{fmtGbpExact(costing.vat)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="font-semibold">You keep</dt>
          <dd className="text-right">
            <span className="mkt-mark font-mono text-base font-semibold tabular-nums">{fmtGbpExact(costing.margin)}</span>
            <span className="ml-2 text-[12px] text-[var(--mkt-ink-2)]">{Math.round(costing.marginPct)}% margin</span>
          </dd>
        </div>
      </dl>
    </>
  );
  return bleed ? <Bleed>{body}</Bleed> : <div className="mkt-mock overflow-hidden">{body}</div>;
}

const ROTA = [
  { name: 'Amira', shifts: ['07–15', '07–15', '', '07–15', '07–15'] },
  { name: 'Josh', shifts: ['', '12–20', '12–20', '12–20', ''] },
  { name: 'Lena', shifts: ['10–16', '', '07–15', '', '10–18'] },
];

export function RotaMock() {
  return (
    <Bleed>
      <div className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))] border-b border-[var(--mkt-line)] px-3 py-2 text-center">
        <span />
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
          <span key={day} className={label}>
            {day}
          </span>
        ))}
      </div>
      {ROTA.map((person) => (
        <div key={person.name} className="grid grid-cols-[4rem_repeat(5,minmax(0,1fr))] items-center gap-1 px-3 py-1.5">
          <span className="text-[12px] font-semibold">{person.name}</span>
          {person.shifts.map((shift, index) => (
            <span
              key={index}
              className={cn(
                'h-6 rounded-[4px] text-center font-mono text-[10px] leading-6 tabular-nums',
                shift ? 'bg-success/12 text-success ring-1 ring-success/25' : 'bg-transparent',
              )}
            >
              {shift}
            </span>
          ))}
        </div>
      ))}
      <p className="border-t border-[var(--mkt-line)] px-3 py-2 text-[12px] text-[var(--mkt-ink-2)]">
        Staff cost this week <span className="font-mono font-semibold text-foreground tabular-nums">24%</span> of takings
      </p>
    </Bleed>
  );
}

export function CustomerMock() {
  return (
    <div className="relative h-48">
      <div className="mkt-mock absolute top-6 left-6 w-60 -rotate-3 p-4 sm:left-10">
        <p className="flex items-center gap-2 text-sm font-semibold">
          Priya Shah <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        </p>
        <p className="text-[12px] text-[var(--mkt-ink-2)]">4 visits · usually a chai latte</p>
      </div>
      <div className="mkt-mock absolute top-2 right-4 w-64 p-4 sm:right-8">
        <p className="flex items-center gap-2 text-sm font-semibold">
          Sam Taylor <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        </p>
        <p className="text-[12px] text-[var(--mkt-ink-2)]">12 visits · usually an oat flat white</p>
        <p className={cn(label, 'mt-3')}>Loyalty</p>
        <div className="mt-1.5 flex gap-1" aria-label="12 of 13 stamps">
          {Array.from({ length: 13 }, (_, index) => (
            <span key={index} className={cn('size-3.5 rounded-full', index < 12 ? 'bg-measured' : 'ring-1 ring-measured/50')} aria-hidden="true" />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[var(--mkt-ink-2)]">One more visit unlocks a free drink</p>
      </div>
    </div>
  );
}

const STOCK = [
  { item: 'Oat milk', left: '4 L', share: 0.18, low: true },
  { item: 'Espresso beans', left: '2.1 kg', share: 0.42, low: false },
  { item: 'Almond croissants', left: '6', share: 0.24, low: true },
  { item: 'Takeaway cups 12oz', left: '310', share: 0.7, low: false },
];

export function StockMock() {
  return (
    <Bleed>
      <ul className="divide-y divide-[var(--mkt-line)] text-[13px]">
        {STOCK.map((row) => (
          <li key={row.item} className="grid grid-cols-[minmax(0,1fr)_5rem_3.5rem] items-center gap-3 px-4 py-2.5">
            <span className="font-medium">{row.item}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[var(--mkt-line)]" aria-hidden="true">
              <span className={cn('block h-full rounded-full', row.low ? 'bg-stock' : 'bg-primary/60')} style={{ width: `${row.share * 100}%` }} />
            </span>
            <span className={cn('text-right font-mono tabular-nums', row.low && 'font-semibold text-stock')}>{row.left}</span>
          </li>
        ))}
      </ul>
    </Bleed>
  );
}

export function QrMock() {
  return (
    <div className="flex justify-center pt-2">
      <div className="mkt-mock w-52 rounded-b-none border-b-0 px-3 pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--mkt-line)]" aria-hidden="true" />
        <p className="text-[13px] font-semibold">Bridge Street Café</p>
        <p className="text-[11px] text-[var(--mkt-ink-2)]">Order and pay from your phone</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-[12px]">
          {[
            ['Flat white', '£3.40'],
            ['Banana bread', '£2.90'],
          ].map(([item, price]) => (
            <li key={item} className="flex justify-between rounded-[5px] border border-[var(--mkt-line)] px-2 py-1.5">
              {item}
              <span className="font-mono tabular-nums">{price}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 mb-3 rounded-full bg-primary py-2 text-center text-[12px] font-semibold text-primary-foreground">Pay £6.30</p>
      </div>
    </div>
  );
}

export function LocationsMock() {
  const bars = [0.34, 0.5, 0.42, 0.66, 0.58, 0.8, 0.72, 0.9];
  return (
    <div className="px-6 pb-6 sm:px-10">
      <div className="flex flex-wrap gap-2">
        <span className="mkt-mock inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium">
          Location is <span className="font-semibold">Bridge Street</span>
        </span>
        <span className="inline-flex h-7 items-center rounded-[6px] px-2.5 text-[12px] text-[var(--mkt-ink-2)] ring-1 ring-[var(--mkt-line)]">All locations</span>
      </div>
      <div className="mkt-mock mt-3 p-4">
        <p className="flex items-baseline justify-between text-[12px] font-semibold">
          Takings, last 8 weeks <span className="font-mono text-[var(--mkt-ink-2)] tabular-nums">Bridge Street</span>
        </p>
        <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden="true">
          {bars.map((height, index) => (
            <span key={index} className="flex-1 rounded-t-[3px] bg-measured/80" style={{ height: `${height * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A full product screen for the hero tabs, at the screenshots' own proportions. */
function ScreenFrame({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <div className="flex aspect-[3662/2548] flex-col overflow-hidden bg-[var(--mkt-ground)]">
      <div className="flex items-center justify-between border-b border-[var(--mkt-line)] bg-[var(--mkt-card)] px-5 py-3 sm:px-8 sm:py-4">
        <p className="text-sm font-semibold sm:text-base">{title}</p>
        <p className="text-[11px] text-[var(--mkt-ink-3)] sm:text-xs">{meta}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-6">{children}</div>
    </div>
  );
}

const ORDERS = [
  { id: '#1058', time: '08:42', channel: 'Till', items: 'Oat flat white, almond croissant', total: '£4.85', status: 'Paid', tone: 'team' as const },
  { id: '#1057', time: '08:39', channel: 'QR', items: 'Iced latte, banana bread', total: '£6.70', status: 'Preparing', tone: 'stock' as const },
  { id: '#1056', time: '08:31', channel: 'Till', items: 'Full breakfast, English breakfast tea', total: '£12.40', status: 'Ready', tone: 'reference' as const },
  { id: '#1055', time: '08:24', channel: 'Phone', items: '6 × Pain au chocolat', total: '£15.60', status: 'Paid', tone: 'team' as const },
  { id: '#1054', time: '08:12', channel: 'QR', items: 'Chai latte', total: '£3.60', status: 'Paid', tone: 'team' as const },
  { id: '#1053', time: '07:58', channel: 'Till', items: 'Flat white', total: '£3.40', status: 'Refunded', tone: 'orders' as const },
  { id: '#1052', time: '07:46', channel: 'Till', items: 'Americano, cheese toastie', total: '£8.20', status: 'Paid', tone: 'team' as const },
  { id: '#1051', time: '07:41', channel: 'QR', items: '2 × Cappuccino, cinnamon bun', total: '£9.70', status: 'Paid', tone: 'team' as const },
  { id: '#1050', time: '07:33', channel: 'Till', items: 'Hot chocolate', total: '£3.50', status: 'Paid', tone: 'team' as const },
  { id: '#1049', time: '07:25', channel: 'Phone', items: 'Sourdough loaf, 4 × Croissant', total: '£14.20', status: 'Ready', tone: 'reference' as const },
  { id: '#1048', time: '07:18', channel: 'Till', items: 'Oat latte, granola pot', total: '£7.90', status: 'Paid', tone: 'team' as const },
  { id: '#1047', time: '07:09', channel: 'Till', items: 'Espresso', total: '£2.40', status: 'Paid', tone: 'team' as const },
];

/** Stand-in for the Orders screen until orders.png exists. Example data. */
export function OrdersScreen() {
  return (
    <ScreenFrame title="Orders" meta="Today · Bridge Street">
      <div className="flex flex-wrap gap-1.5 pb-3">
        {['All channels', 'Till', 'QR', 'Phone'].map((chip, index) => (
          <span key={chip} className={cn('rounded-[6px] px-2.5 py-1 text-[11px] sm:text-xs', index === 0 ? 'bg-[var(--mkt-card)] font-semibold shadow-sm ring-1 ring-[var(--mkt-line)]' : 'text-[var(--mkt-ink-2)]')}>
            {chip}
          </span>
        ))}
      </div>
      <div className="mkt-mock overflow-hidden">
        <div className={cn(label, 'grid grid-cols-[3.5rem_3rem_minmax(0,1fr)_4.5rem] gap-3 border-b border-[var(--mkt-line)] px-4 py-2 sm:grid-cols-[4rem_3.5rem_4rem_minmax(0,1fr)_5rem_6rem]')}>
          <span>Order</span>
          <span>Time</span>
          <span className="hidden sm:block">Channel</span>
          <span>Items</span>
          <span className="text-right">Total</span>
          <span className="hidden sm:block">Status</span>
        </div>
        <ul className="divide-y divide-[var(--mkt-line)] text-[12px] sm:text-[13px]">
          {ORDERS.map((order) => (
            <li key={order.id} className="grid grid-cols-[3.5rem_3rem_minmax(0,1fr)_4.5rem] items-center gap-3 px-4 py-2 sm:grid-cols-[4rem_3.5rem_4rem_minmax(0,1fr)_5rem_6rem] sm:py-2.5">
              <span className="font-mono font-semibold tabular-nums">{order.id}</span>
              <span className="font-mono text-[var(--mkt-ink-2)] tabular-nums">{order.time}</span>
              <span className="hidden text-[var(--mkt-ink-2)] sm:block">{order.channel}</span>
              <span className="truncate">{order.items}</span>
              <span className="text-right font-mono tabular-nums">{order.total}</span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className={cn('size-2 rounded-[2px]', TONE_FILL[order.tone])} aria-hidden="true" />
                {order.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ScreenFrame>
  );
}

const CUSTOMERS = [
  { name: 'Sam Taylor', visits: 12, last: 'Today', spend: '£58.20' },
  { name: 'Priya Shah', visits: 4, last: 'Yesterday', spend: '£19.80' },
  { name: 'Tom Ellis', visits: 9, last: 'Mon', spend: '£71.35' },
  { name: 'Ana Costa', visits: 21, last: 'Today', spend: '£96.10' },
  { name: 'Leo Grant', visits: 2, last: 'Last week', spend: '£7.40' },
  { name: 'Mia Ward', visits: 6, last: 'Sat', spend: '£33.90' },
  { name: 'Oliver Hart', visits: 15, last: 'Fri', spend: '£64.75' },
  { name: 'Zara Khan', visits: 3, last: 'Thu', spend: '£12.60' },
  { name: 'Ben Fox', visits: 8, last: 'Today', spend: '£41.20' },
  { name: 'Chloe Reid', visits: 11, last: 'Wed', spend: '£52.30' },
  { name: 'Isaac Moss', visits: 5, last: 'Tue', spend: '£22.15' },
];

/** Stand-in for the Customers screen until customers.png exists. Example data. */
export function CustomersScreen() {
  return (
    <ScreenFrame title="Customers" meta="All locations">
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:gap-5">
        <div className="mkt-mock overflow-hidden">
          <div className={cn(label, 'grid grid-cols-[minmax(0,1fr)_3rem_4.5rem_4rem] gap-3 border-b border-[var(--mkt-line)] px-4 py-2')}>
            <span>Name</span>
            <span className="text-right">Visits</span>
            <span>Last visit</span>
            <span className="text-right">Spend</span>
          </div>
          <ul className="divide-y divide-[var(--mkt-line)] text-[12px] sm:text-[13px]">
            {CUSTOMERS.map((customer, index) => (
              <li key={customer.name} className={cn('grid grid-cols-[minmax(0,1fr)_3rem_4.5rem_4rem] items-center gap-3 px-4 py-2 sm:py-2.5', index === 0 && 'bg-[var(--mkt-marker)]/50')}>
                <span className="truncate font-medium">{customer.name}</span>
                <span className="text-right font-mono tabular-nums">{customer.visits}</span>
                <span className="text-[var(--mkt-ink-2)]">{customer.last}</span>
                <span className="text-right font-mono tabular-nums">{customer.spend}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mkt-mock hidden flex-col p-5 sm:flex">
          <p className="flex items-center gap-2 text-base font-semibold">
            Sam Taylor <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          </p>
          <p className="text-[12px] text-[var(--mkt-ink-2)]">Regular since March · usually an oat flat white</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
            {[
              ['Visits', '12'],
              ['Spent', '£58.20'],
              ['Average order', '£4.85'],
              ['Email', 'Opted in'],
            ].map(([term, value]) => (
              <div key={term} className="rounded-[6px] bg-[var(--mkt-ground)] px-3 py-2">
                <dt className={label}>{term}</dt>
                <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className={cn(label, 'mt-4')}>Loyalty</p>
          <div className="mt-1.5 flex flex-wrap gap-1" aria-label="12 of 13 stamps">
            {Array.from({ length: 13 }, (_, index) => (
              <span key={index} className={cn('size-3.5 rounded-full', index < 12 ? 'bg-measured' : 'ring-1 ring-measured/50')} aria-hidden="true" />
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--mkt-ink-2)]">One more visit unlocks a free drink</p>
        </div>
      </div>
    </ScreenFrame>
  );
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const VARIANT_STOCK = [
  { colour: 'Oat', swatch: '#d9cbb3', counts: [3, 8, 12, 6, 0] },
  { colour: 'Forest', swatch: '#2b5a45', counts: [0, 4, 9, 7, 2] },
  { colour: 'Black', swatch: '#1d1d1b', counts: [5, 11, 14, 10, 4] },
];

/** Stock for one product, by colour and size — the grid a clothing shop actually counts. Example data. */
export function VariantStockMock({ bleed = true }: { bleed?: boolean }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <p className="text-[13px] font-semibold">Linen overshirt</p>
        <p className="text-[11px] text-[var(--mkt-ink-3)]">Shop + online</p>
      </div>
      <div className="px-4 py-3">
        <div className={cn(label, 'grid grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] gap-1.5 pb-2 text-center')}>
          <span />
          {SIZES.map((size) => (
            <span key={size}>{size}</span>
          ))}
        </div>
        {VARIANT_STOCK.map((row) => (
          <div key={row.colour} className="grid grid-cols-[4.5rem_repeat(5,minmax(0,1fr))] items-center gap-1.5 py-1">
            <span className="flex items-center gap-1.5 text-[12px] font-medium">
              <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: row.swatch }} aria-hidden="true" />
              {row.colour}
            </span>
            {row.counts.map((count, index) => (
              <span
                key={index}
                className={cn(
                  'rounded-[4px] py-1 text-center font-mono text-[11px] tabular-nums',
                  count === 0 ? 'bg-destructive/10 text-destructive' : count < 4 ? 'bg-stock/15 font-semibold text-stock' : 'bg-[var(--mkt-ground)]',
                )}
              >
                {count}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
  return bleed ? <Bleed>{body}</Bleed> : <div className="mkt-mock overflow-hidden">{body}</div>;
}

/**
 * A storefront API call and the product it returns, in the real response's
 * shape (duma-api lib/storefront.ts shopperVariant) — the same stock and price
 * the till sells from.
 */
export function StorefrontApiMock() {
  return (
    <Bleed className="overflow-hidden bg-[#14211c] text-[#d9e6df]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 font-mono text-[11px]">
        <span className="rounded-[4px] bg-white/10 px-1.5 py-0.5 font-semibold text-[#9fe0bd]">GET</span>
        <span className="text-white/70">/v1/store/products/linen-overshirt</span>
      </div>
      <pre className="overflow-hidden px-4 py-3 font-mono text-[11px] leading-[1.6]">
        {`{
  "name": "Linen overshirt",
  "variants": [{
    "options": { "Colour": "Forest", "Size": "M" },
    "price": "48.00",
    "available": true,
    "stock": 9
  }, …]
}`}
      </pre>
    </Bleed>
  );
}

/** The content editor: a post with its fields, languages and publish state. Example data. */
export function ContentEditorMock({ bleed = true }: { bleed?: boolean }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          Blog post <span className="rounded-[4px] bg-success-highlight px-1.5 py-0.5 text-[10px] font-semibold text-success">Published</span>
        </p>
        <div className="flex gap-1 text-[11px]">
          {['EN', 'UK', 'PL'].map((locale, index) => (
            <span key={locale} className={cn('rounded-[4px] px-1.5 py-0.5', index === 0 ? 'bg-foreground font-semibold text-background' : 'bg-[var(--mkt-ground)] text-[var(--mkt-ink-2)]')}>
              {locale}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4 text-[12px]">
        <div>
          <p className={label}>Title</p>
          <p className="mt-1 text-[15px] font-semibold">A morning in the bakery</p>
        </div>
        <div>
          <p className={label}>Slug</p>
          <p className="mt-1 font-mono text-[var(--mkt-ink-2)]">/blog/a-morning-in-the-bakery</p>
        </div>
        <div>
          <p className={label}>Cover image</p>
          <div className="mt-1.5 h-14 rounded-[6px] bg-[linear-gradient(135deg,#e9dcc4,#c9a77c)]" aria-hidden="true" />
        </div>
        <div className="rounded-[6px] border border-[var(--mkt-line)] px-3 py-2">
          <p className={label}>Search preview</p>
          <p className="mt-1 text-[13px] text-reference">A morning in the bakery — Bridge Street</p>
          <p className="text-[11px] text-[var(--mkt-ink-2)]">How the first loaf goes in at five, and what sells out by nine.</p>
        </div>
      </div>
    </>
  );
  return bleed ? <Bleed>{body}</Bleed> : <div className="mkt-mock overflow-hidden">{body}</div>;
}

/** A public form and the customer its response becomes. Example data. */
export function FormMock() {
  return (
    <div className="relative h-52">
      <div className="mkt-mock absolute top-2 left-6 w-60 -rotate-2 p-4 sm:left-10">
        <p className="text-sm font-semibold">Join the waiting list</p>
        <div className="mt-3 flex flex-col gap-2 text-[12px]">
          <span className="rounded-[5px] border border-[var(--mkt-line)] px-2.5 py-1.5 text-[var(--mkt-ink-2)]">Ana Costa</span>
          <span className="rounded-[5px] border border-[var(--mkt-line)] px-2.5 py-1.5 text-[var(--mkt-ink-2)]">ana@example.com</span>
          <span className="rounded-full bg-primary py-1.5 text-center font-semibold text-primary-foreground">Send</span>
        </div>
      </div>
      <div className="mkt-mock absolute top-16 right-4 w-56 rotate-1 p-4 sm:right-8">
        <p className="flex items-center gap-2 text-sm font-semibold">
          Ana Costa <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        </p>
        <p className="text-[12px] text-[var(--mkt-ink-2)]">New customer · from “Join the waiting list”</p>
      </div>
    </div>
  );
}

const BOOKINGS = [
  { time: '18:30', name: 'Hart, 4', table: 'T3', status: 'Seated', tone: 'team' as const },
  { time: '19:00', name: 'Khan, 2', table: 'B1', status: 'Booked', tone: 'reference' as const },
  { time: '19:15', name: 'Reid, 6', table: 'T7', status: 'Booked', tone: 'reference' as const },
  { time: '19:45', name: 'Moss, 3', table: '—', status: 'Waitlist', tone: 'stock' as const },
];

/** Tonight's bookings and the walk-in waitlist. Example data. */
export function BookingsMock() {
  return (
    <Bleed>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <p className="text-[13px] font-semibold">Tonight</p>
        <p className="text-[11px] text-[var(--mkt-ink-3)]">3 booked · 1 waiting</p>
      </div>
      <ul className="divide-y divide-[var(--mkt-line)] text-[13px]">
        {BOOKINGS.map((row) => (
          <li key={row.time + row.name} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem_5rem] items-center gap-3 px-4 py-2.5">
            <span className="font-mono text-[var(--mkt-ink-2)] tabular-nums">{row.time}</span>
            <span className="truncate font-medium">{row.name}</span>
            <span className="font-mono text-[12px] text-[var(--mkt-ink-2)]">{row.table}</span>
            <span className="flex items-center gap-1.5 text-[12px]">
              <span className={cn('size-2 rounded-[2px]', TONE_FILL[row.tone])} aria-hidden="true" />
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </Bleed>
  );
}

const WASTE = [
  { item: 'Croissants', qty: '6', reason: 'End of day', cost: '£2.10' },
  { item: 'Sourdough loaf', qty: '2', reason: 'End of day', cost: '£0.90' },
  { item: 'Cream', qty: '1 L', reason: 'Out of date', cost: '£3.40' },
];

/** Today's logged waste, valued at cost. Example data. */
export function WasteMock() {
  return (
    <Bleed>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--mkt-line)] px-4 py-3">
        <p className="text-[13px] font-semibold">Waste today</p>
        <p className="font-mono text-[12px] font-semibold text-destructive tabular-nums">£6.40</p>
      </div>
      <ul className="divide-y divide-[var(--mkt-line)] text-[13px]">
        {WASTE.map((row) => (
          <li key={row.item} className="grid grid-cols-[minmax(0,1fr)_3rem_6rem_3.5rem] items-center gap-3 px-4 py-2.5">
            <span className="truncate font-medium">{row.item}</span>
            <span className="font-mono text-[var(--mkt-ink-2)] tabular-nums">{row.qty}</span>
            <span className="text-[12px] text-[var(--mkt-ink-2)]">{row.reason}</span>
            <span className="text-right font-mono tabular-nums">{row.cost}</span>
          </li>
        ))}
      </ul>
    </Bleed>
  );
}
