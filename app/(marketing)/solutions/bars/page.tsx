import { BarChart3, CalendarDays, CreditCard, Gift, Layers, LineChart, Star, Trash2, Users, Wallet, WifiOff } from '@/components/icons';
import { BookingsMock, type CostedItem, MarginMock, OfflineQueueMock, RotaMock } from '@/components/marketing/mocks';
import { Mark } from '@/components/marketing/sections';
import { SolutionPage, type SolutionContent, solutionMetadata } from '@/components/marketing/SolutionPage';

/**
 * /solutions/bars — DUMA for bars and pubs. Claims checked against duma-api:
 * table bookings with floor plan, waitlist, guest booking page and self-service
 * changes (reservations.ts); cash-up against expected cash and card
 * (cash-ups.ts); recipes and VAT-aware margin; rotas; the offline till.
 */

const GIN_AND_TONIC: CostedItem = {
  name: 'Gin and tonic',
  price: 8.5,
  ingredients: [
    { name: 'Gin', quantity: '50 ml', cost: 1.1 },
    { name: 'Tonic', quantity: '200 ml', cost: 0.65 },
    { name: 'Lime and ice', quantity: '1', cost: 0.1 },
  ],
};

const content: SolutionContent = {
  path: '/solutions/bars',
  breadcrumb: 'Bars and pubs',
  metaTitle: 'Bar & Pub POS with Table Bookings, Free to Start | DUMA',
  description:
    'Bar and pub software: a fast till that works offline, drinks costed by recipe, table bookings with a waitlist, rotas and cash-up. Keep your card machine. Free plan, no card needed.',
  hero: {
    lead: 'Bar and pub software that keeps up with',
    mark: 'the Friday rush',
    subtitle: 'A fast till, drinks costed by recipe, table bookings with a waitlist, rotas and cash-up — in one place, on the tablet and card machine you already have.',
    ticks: ['Free plan, forever', 'Table bookings included', 'Works offline'],
    tabs: ['pos', 'orders', 'dashboard', 'customers'],
  },
  teaser: {
    title: 'Know what every drink makes you.',
    intro: (
      <p>
        Cost each drink from its measures. DUMA takes VAT out of the price and shows the margin you <Mark>really keep</Mark> on every pint, glass and cocktail.
      </p>
    ),
    visual: <MarginMock bleed={false} item={GIN_AND_TONIC} />,
    caption: 'An example drink for a VAT-registered bar, worked out by DUMA’s own costing.',
  },
  mistakes: {
    title: 'Five things that quietly cost a bar money',
    items: [
      { title: 'Pricing drinks by habit.', body: 'When spirits go up, an old price eats the margin without anyone noticing. DUMA costs every drink from its measures, VAT included.' },
      { title: 'Keeping bookings in a paper diary.', body: 'Double bookings, lost numbers and empty tables on busy nights. DUMA has a floor plan, a guest booking page and a waitlist for walk-ins.' },
      { title: 'Seeing staff cost at the end of the month.', body: 'By then the rota has already eaten the profit. In DUMA staff cost sits next to the night’s takings, while you can still change it.' },
      { title: 'A cash-up that never balances.', body: 'Counting the drawer against a guess. DUMA compares what you count with the cash and card it expected, so differences show up the same night.' },
      { title: 'Letting the till stop with the Wi-Fi.', body: 'A dropped connection on a Friday shouldn’t mean a queue at the bar. The DUMA till keeps taking orders and sends them when it’s back.' },
    ],
  },
  how: {
    title: 'How DUMA runs a bar',
    intro: (
      <p>
        One workspace for the bar, the floor and the back office: <Mark>a till that never stops</Mark>, bookings and a waitlist, drinks with real margin, rotas and a
        cash-up that adds up.
      </p>
    ),
    cards: [
      { icon: CalendarDays, tone: 'reference', tag: 'included', title: 'Table bookings and waitlist', body: 'A floor plan of your tables, a booking page for guests, and a waitlist that seats walk-ins when a table frees up.', visual: <BookingsMock /> },
      { icon: BarChart3, tone: 'reference', tag: 'free in full', title: 'Drinks costed by recipe', body: 'Cost every drink from its measures and see what you keep after VAT, on the menu and in the reports.', visual: <MarginMock item={GIN_AND_TONIC} /> },
      { icon: Users, tone: 'team', tag: 'free in full', title: 'Rotas and time', body: 'Your team sees the rota on their phone and clocks in there — with staff cost next to the night’s takings.', visual: <RotaMock /> },
      { icon: WifiOff, tone: 'stock', tag: 'free in full', title: 'A till that works offline', body: 'Sell on any tablet or phone. When the Wi-Fi drops, orders queue on the device and send themselves later.', visual: <OfflineQueueMock /> },
    ],
  },
  useCases: {
    title: 'Four things bars do with DUMA every week',
    lead: [
      'Whether you run a pub, a cocktail bar or a wine bar, these are the jobs DUMA takes off the end of the night.',
      'Start with the one you need most. The rest is already in the same workspace, with nothing to move when you’re ready.',
    ],
    items: [
      { title: 'Price drinks with confidence', body: 'See the margin on every drink, VAT included, and spot the ones to reprice before the next menu.' },
      { title: 'Fill the tables on busy nights', body: 'Guests book online and can change or cancel their own booking. Walk-ins join the waitlist and are seated when a table frees up.' },
      { title: 'Cash up in minutes', body: 'Count the drawer and DUMA shows what it expected in cash and card, so a difference is found the same night.' },
      { title: 'Keep the regulars coming back', body: 'Every visit builds the customer’s profile. Points or stamps reward the regulars, and email reaches only those who opted in.' },
    ],
    icons: [BarChart3, CalendarDays, Wallet, Gift],
  },
  explainer: {
    title: 'What bar software should do, and how to set it up',
    intro: (
      <p>
        Bar software should connect the till to the bookings, the rota and the cash drawer. If you only look at takings, you can’t see the margin. If you only look at
        bookings, you can’t see the staff cost behind them.
      </p>
    ),
    setupTitle: 'How to set up DUMA in a bar',
    steps: [
      { title: 'Tell DUMA what you run.', body: 'Bar or pub, with or without food — answer a few questions at sign-up and DUMA switches on the parts that fit.' },
      { title: 'Bring in your drinks, tables and team.', body: 'Add your drinks and their measures, draw your floor plan and invite your staff. We’ll help you do it, for free.' },
      { title: 'Open the till.', body: 'Use any tablet or phone, keep your card machine, and take your first order. Bookings, stock and reports update from then on.' },
    ],
    metricsTitle: 'Bar numbers worth watching',
    metrics: [
      { title: 'Margin per drink', body: 'What each drink makes after its measures and VAT. The number that tells you what to push and what to reprice.' },
      { title: 'Takings against a typical night', body: 'Tonight compared with the same weekday in past weeks, so a quiet Monday is told apart from a bad one.' },
      { title: 'Staff cost against takings', body: 'Labour as a share of sales — the quickest sign the rota and the trade are out of step.' },
      { title: 'Top sellers', body: 'What sold, by quantity and value. Useful for the menu, the specials and the stock order.' },
      { title: 'Waste and breakage', body: 'Logged spills, breakage and out-of-date stock, so stock and margin reflect what really left the bar.' },
      { title: 'Cash-up difference', body: 'What you counted against what DUMA expected in cash and card, every night.' },
    ],
    metricIcons: [BarChart3, LineChart, Users, Star, Trash2, Wallet],
    comparisonTitle: 'A card-reader app, separate apps,',
    comparisonHighlight: 'or one system',
    comparisonLead: 'Three ways most bars run. Here is what each one covers.',
    comparison: [
      {
        title: 'A card-reader till app',
        summary: 'Good at taking payments. Bookings, recipe margin and rotas usually live somewhere else.',
        bestFor: 'Taking payments, and not much more',
        rows: [
          { job: 'Fast till and payments', mark: 'yes' },
          { job: 'Drinks costed by recipe', mark: 'part', note: 'Often an add-on' },
          { job: 'Table bookings and waitlist', mark: 'no' },
          { job: 'Rotas and cash-up', mark: 'part', note: 'Cash-up only, often' },
          { job: 'Everything in one place', mark: 'no' },
        ],
      },
      {
        title: 'Separate apps for each job',
        summary: 'A till, a booking app and a rota app can each be strong, but none of them share data.',
        bestFor: 'Teams happy to run several logins and bills',
        rows: [
          { job: 'Fast till and payments', mark: 'yes', note: 'One app' },
          { job: 'Drinks costed by recipe', mark: 'part', note: 'Usually a spreadsheet' },
          { job: 'Table bookings and waitlist', mark: 'yes', note: 'Another app' },
          { job: 'Rotas and cash-up', mark: 'yes', note: 'Another app' },
          { job: 'Everything in one place', mark: 'no', note: 'Numbers copied between apps' },
        ],
      },
      {
        title: 'DUMA',
        summary: 'Till, bookings and waitlist, drinks with margin, rotas, cash-up and reports in one workspace.',
        bestFor: 'Bars that want one place and one bill — free to start',
        rows: [
          { job: 'Fast till and payments', mark: 'yes', note: 'Keep your card machine' },
          { job: 'Drinks costed by recipe', mark: 'yes', note: 'VAT-aware' },
          { job: 'Table bookings and waitlist', mark: 'yes', note: 'Guest booking page' },
          { job: 'Rotas and cash-up', mark: 'yes' },
          { job: 'Everything in one place', mark: 'yes', note: 'One login, one bill' },
        ],
      },
    ],
    comparisonIcons: [CreditCard, Layers],
  },
  setupBand: { title: 'Open tonight on DUMA.', body: 'Bring your drinks, tables and team across — we’ll help you set it up, for free.' },
  faqTitle: 'Questions bars ask',
  faqs: [
    { question: 'Can guests book a table online?', answer: 'Yes. Each location has a guest booking page with your booking rules. Guests pick a time and party size, and can change or cancel their own booking.' },
    { question: 'Is there a waitlist for walk-ins?', answer: 'Yes. Add a party to the waitlist, and seat them when a table on your floor plan frees up.' },
    { question: 'Can I cost drinks by the measure?', answer: 'Yes. Add a recipe with the measures and what each costs. DUMA takes VAT out of the price if you are registered and shows the margin you keep.' },
    { question: 'How does cash-up work?', answer: 'Count the drawer at close, and DUMA shows what it expected in cash and card from the day’s sales, so any difference shows up the same night.' },
    { question: 'Can I keep my card machine?', answer: 'Yes. Square and SumUp connect to DUMA directly. With any other card machine, key the amount in and mark the sale as card — it still lands in your reports.' },
    { question: 'What happens if the Wi-Fi goes down?', answer: 'The till keeps taking orders. They are saved on the device and sent when the connection is back, and a sale that cannot be sent is kept for you to check.' },
  ],
  closing: { title: 'The one place to run your bar.', muted: 'One simple bill, or none at all.', body: 'Get started in minutes, completely free. No card required, and we’re here to help you every step of the way.' },
};

export const metadata = solutionMetadata(content);

export default function BarsPage() {
  return <SolutionPage content={content} />;
}
