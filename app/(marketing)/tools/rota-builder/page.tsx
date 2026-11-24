import type { Metadata } from 'next';

import { BarChart3, CalendarClock, Clock, Smartphone } from '@/components/icons';
import { RotaBuilder } from '@/components/marketing/tools/RotaBuilder';
import { ToolPage, type ToolStep } from '@/components/marketing/tools/ToolPage';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { DEFAULT_RULES, costPence, formatHours, formatRotaMoney, shiftSpan } from '@/lib/utils/rota-builder';

const PATH = '/tools/rota-builder';

const DESCRIPTION =
  'Free staff rota builder: plan shifts, calculate hours and staff costs, check breaks and rest, then print or save your weekly rota. No sign-up needed.';

export const metadata: Metadata = marketingMetadata({
  title: 'Free Staff Rota Builder & Printable Shift Planner | DUMA',
  description: DESCRIPTION,
  path: PATH,
});

// The worked example is one of the builder's own shifts, computed, so the page can never disagree with it.
const OPEN = { start: '07:00', end: '15:00', breakMinutes: 30 };
const OPEN_SPAN = shiftSpan(OPEN)!;
const CLOSE = { start: '14:00', end: '22:00', breakMinutes: 30 };
/** Rest from a close to the next day's open: the rest of the day after the close, plus the morning before the open. */
const REST_MINUTES = 24 * 60 - shiftSpan(CLOSE)!.end + OPEN_SPAN.start;
const RATE_PENCE = 1250;
const SHIFT_COST = costPence(OPEN_SPAN.paidMinutes, RATE_PENCE);
/** The worked example is in pounds; the builder takes any currency. */
const gbp = (pence: number) => formatRotaMoney(pence, 'GBP');

const STEPS: readonly ToolStep[] = [
  {
    title: 'Start from when you trade',
    body: 'Your busiest hours decide who you need, not your opening hours. Put the strongest people on the rush.',
    formula: 'Open 07–15 · Middle 10–18 · Close 14–22',
  },
  {
    title: 'Fill the key shifts first',
    body: 'Someone who can open, someone who can cash up and close, and the kitchen lead. Then fill in around them.',
  },
  {
    title: 'Take out the unpaid breaks',
    body: 'Paid time is the shift less any unpaid break.',
    formula: `${OPEN.start}–${OPEN.end} − ${OPEN.breakMinutes} min = ${formatHours(OPEN_SPAN.paidMinutes)} paid`,
  },
  {
    title: 'Check the cost against sales',
    body: 'Hours × rate for each shift, added up for the week, as a share of the sales you expect: your labour %.',
    formula: `${formatHours(OPEN_SPAN.paidMinutes)} × ${gbp(RATE_PENCE)} = ${gbp(SHIFT_COST)}`,
  },
  {
    title: 'Check the rest, then share it',
    body: `Most countries set a minimum rest between shifts — ${formatHours(DEFAULT_RULES.restMinutes ?? 0)} in the EU and UK, so a close followed by an open is a problem — and a weekly limit. Then print it or send the image.`,
    formula: `Close at ${CLOSE.end}, open at ${OPEN.start} = ${formatHours(REST_MINUTES)} rest`,
  },
];

/** What DUMA's rotas add to a one-week builder — each line as the staff-scheduling feature page states it. */
const IN_DUMA = [
  {
    icon: CalendarClock,
    tone: 'reference',
    title: 'Draft, then publish',
    body: 'Plan without the team watching it change, and repeat regular shifts weekly for up to 12 weeks.',
  },
  {
    icon: Smartphone,
    tone: 'orders',
    title: 'On their phone',
    body: 'Each person sees their week, their next shift and their approved leave in My work.',
  },
  {
    icon: Clock,
    tone: 'stock',
    title: 'Planned against worked',
    body: 'Staff clock in on their phone or at the till, and each shift sits beside the hours actually worked.',
  },
  {
    icon: BarChart3,
    tone: 'action',
    title: 'Labour next to sales',
    body: 'Labour vs sales shows staff cost as a share of what you actually took, not what you expected.',
  },
] as const;

const FAQS = [
  {
    question: 'How do I make a staff rota?',
    answer:
      'List your team, then go day by day: put your key people on the opening, the busiest hours and the close, and fill in around them. Add unpaid breaks, check the hours and cost against the sales you expect, and share it at least a week ahead. This builder does the totals and the checks as you go.',
  },
  {
    question: 'How do I work out staff cost for the week?',
    answer: `For each shift, take the paid hours — the shift less any unpaid break — and multiply by the hourly rate, then add up the week. A ${OPEN.start}–${OPEN.end} shift with a ${OPEN.breakMinutes}-minute break is ${formatHours(OPEN_SPAN.paidMinutes)} paid; at ${gbp(RATE_PENCE)} an hour that is ${gbp(SHIFT_COST)}. Employer taxes, pension and holiday pay come on top.`,
  },
  {
    question: 'Does the rota builder work outside the UK?',
    answer:
      'Yes. Choose your currency, whether your week starts on Monday or Sunday, and the working-time limits where you are — or switch the checks off. It starts with the EU and UK limits.',
  },
  {
    question: 'What breaks and rest are staff entitled to?',
    answer:
      'It depends on the country. In the EU and UK, an adult working more than six hours is entitled to a 20-minute break and 11 hours’ rest between working days, and young workers get more. In the US there is no federal rule on breaks for adults, but several states have their own. Set your limits in the builder’s settings, and check your local rules.',
  },
  {
    question: 'How many hours can someone work in a week?',
    answer:
      'In the EU and UK, no more than 48 hours a week on average, and in the UK a worker can choose to opt out. In the US there is no federal limit, but most hourly staff are paid overtime after 40 hours. The builder flags anyone over the weekly limit you set.',
  },
  {
    question: 'Can I print the rota or save it as a PDF?',
    answer:
      'Yes. Print or PDF opens your browser’s print window with just the rota on a landscape page; choose Save as PDF there for a file. Download image saves a PNG you can send to the team group chat.',
  },
  {
    question: 'Is my rota saved? Is it sent anywhere?',
    answer:
      'It is kept in this browser on this device, so it is still there when you come back. Nothing you type is sent to DUMA. To share it, print it or download the image.',
  },
];

/**
 * /tools/rota-builder — the free staff rota builder. The page is
 * server-rendered and explains how to build a rota; the builder is a client
 * island (components/marketing/tools/RotaBuilder.tsx). Every figure comes from
 * lib/utils/rota-builder.ts. No related links: it is the one tool without them.
 */
export default function RotaBuilderPage() {
  return (
    <ToolPage
      path={PATH}
      description={DESCRIPTION}
      features={[
        'Weekly staff rota for a team',
        'Paid hours less unpaid breaks',
        'Staff cost and labour % of expected sales',
        'Any currency, Monday- or Sunday-first weeks',
        'Working-time checks you set: breaks, rest between shifts, weekly hours',
        'Print, save as PDF or download as an image',
      ]}
      curveId="rota"
      hero={{
        lead: 'Free staff rota builder,',
        mark: 'ready to print',
        subtitle: 'Plan the week’s shifts, see the hours and what they cost, and catch missing breaks. Print it, save a PDF or send it as an image.',
        ticks: ['Free, no sign-up', 'Any currency, any country', 'Nothing leaves your browser'],
      }}
      tool={{ node: <RotaBuilder />, label: 'Build your weekly rota', headingId: 'rota-builder-heading' }}
      how={{
        id: 'how-to-rota',
        title: 'How to write a staff rota',
        muted: 'Five steps, once a week.',
        intro: <p>Worked through for an opening shift at a café, for a barista on {gbp(RATE_PENCE)} an hour. The builder works in any currency.</p>,
        steps: STEPS,
      }}
      inDuma={{ title: 'Every week, not just this one.', points: IN_DUMA }}
      faqTitle="Questions about rotas"
      faqs={FAQS}
      closing={{ title: 'This builder plans one week.', muted: 'DUMA runs every one.' }}
    />
  );
}
