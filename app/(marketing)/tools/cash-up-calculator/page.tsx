import type { Metadata } from 'next';

import { Banknote, Check, ClipboardList, CreditCard, EyeOff } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { RelatedSection } from '@/components/marketing/RelatedLinks';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { ClosingCta, FaqSection, FeatureCard, Section, SectionHeading } from '@/components/marketing/sections';
import { NumberDot } from '@/components/marketing/solution';
import { CashUpCalculator } from '@/components/marketing/tools/CashUpCalculator';
import { ToolBreadcrumb } from '@/components/marketing/tools/ToolBreadcrumb';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema, webApplicationSchema } from '@/lib/marketing/schema';
import { TOOLS_INDEX, freeTool, otherTools } from '@/lib/marketing/tools';
import { balanceOf } from '@/lib/utils/cash-count';
import { bankingMinor, expectedCashMinor } from '@/lib/utils/cash-up-calculator';
import { fmtGbpExact } from '@/lib/utils/format';

const PATH = '/tools/cash-up-calculator';

const DESCRIPTION =
  'Free till cash-up calculator: count the drawer note by note, see if it is over or short against the float and cash sales, and what to bank. No sign-up.';

export const metadata: Metadata = marketingMetadata({
  title: 'Free Cash-Up Calculator for Your Till (UK) | DUMA',
  description: DESCRIPTION,
  path: PATH,
});

// The worked example is the calculator's own example drawer — the glossary's
// £412.50 expected, £402.50 counted — computed, so the page can never disagree with it.
const FLOAT = 15000;
const CASH_SALES = 26250;
const COUNTED = 40250;
const EXPECTED = expectedCashMinor({ floatMinor: FLOAT, cashSalesMinor: CASH_SALES });
const CASH = balanceOf(COUNTED, EXPECTED);
const gbp = (minor: number) => fmtGbpExact(minor / 100);

const STEPS = [
  {
    title: 'Count everything in the drawer',
    body: 'Notes and coins, float included. Counting the float in, then taking it out at the end, means it is never mistaken for takings.',
    formula: `${gbp(COUNTED)} counted`,
  },
  {
    title: 'Work out what should be there',
    body: 'The float you started with, plus the cash sales on the till’s end-of-day (Z) report, less any cash paid out of the drawer.',
    formula: `${gbp(FLOAT)} + ${gbp(CASH_SALES)} − £0.00 = ${gbp(EXPECTED)}`,
  },
  {
    title: 'Compare the two',
    body: 'More than expected is over; less is short. A pound or more either way is worth a note while the day is fresh.',
    formula: `${gbp(COUNTED)} − ${gbp(EXPECTED)} = −${gbp(Math.abs(CASH.difference))}, short`,
  },
  {
    title: 'Check the card machine too',
    body: 'Its end-of-day total should match the card sales on the till. A payment on the wrong machine shows up here.',
    formula: 'Card machine − card sales on the till = £0.00',
  },
  {
    title: 'Bank the takings, keep the float',
    body: 'Take out tomorrow’s float in small notes and coins, and bank the rest.',
    formula: `${gbp(COUNTED)} − ${gbp(FLOAT)} = ${gbp(bankingMinor(COUNTED, FLOAT))} to bank`,
  },
] as const;

/** What DUMA's till cash-up adds to a one-night calculator — each line as components/cash-up/TillCashUp.tsx does it. */
const IN_DUMA = [
  {
    icon: Banknote,
    tone: 'stock',
    title: 'A float to start the day',
    body: 'Count the float into the drawer when you open, so the close has a fixed starting point.',
  },
  {
    icon: EyeOff,
    tone: 'reference',
    title: 'A blind count',
    body: 'The drawer is counted before DUMA shows what should be there, so the number isn’t nudged.',
  },
  {
    icon: CreditCard,
    tone: 'orders',
    title: 'Card checked too',
    body: 'Read the card machine’s total, and DUMA checks it against the card sales on the till.',
  },
  {
    icon: ClipboardList,
    tone: 'action',
    title: 'A reason when it’s out',
    body: 'A difference of £1 or more needs a note before the day closes. The End of day report keeps every cash-up.',
  },
] as const;

const FAQS = [
  {
    question: 'How do I cash up a till?',
    answer: `Count everything in the drawer, float included. Work out what should be there: the opening float plus cash sales, less any cash paid out. The difference is over or short. A ${gbp(FLOAT)} float and ${gbp(CASH_SALES)} of cash sales should leave ${gbp(EXPECTED)}; a drawer holding ${gbp(COUNTED)} is ${gbp(Math.abs(CASH.difference))} short.`,
  },
  {
    question: 'What is a till float?',
    answer:
      'The notes and coins you start the day with, so you can give change from the first sale. It is not takings: count it in when you open, and leave it in the drawer for tomorrow when you bank the rest.',
  },
  {
    question: 'How much float should I keep?',
    answer:
      'Enough small notes and coins to give change through your busiest first hour. It depends on how many customers pay in cash and what your prices are. Keep it the same every day, so a cash-up always starts from a known figure.',
  },
  {
    question: 'What does it mean when the till is over or short?',
    answer:
      'Short means less cash than the till says there should be; over means more. A small difference is usually change given wrongly or a miscount. The same shift short again and again is worth a closer look. Write down a reason each time, so the pattern shows.',
  },
  {
    question: 'What is the difference between an X report and a Z report?',
    answer:
      'An X report is a reading of the day so far that resets nothing, useful at a shift change. A Z report is the end-of-day report: it closes the day’s totals, and its cash figure is the one to cash up against.',
  },
  {
    question: 'Is this the same sum DUMA uses?',
    answer:
      'Yes. The counting and the over or short come from the same code as DUMA’s till cash-up, so a drawer counted here gives the figure DUMA would.',
  },
];

/**
 * /tools/cash-up-calculator — the free till cash-up calculator. The page is
 * server-rendered and explains the sum; the calculator is a client island
 * (components/marketing/tools/CashUpCalculator.tsx). Every figure comes from
 * lib/utils/cash-count.ts and lib/utils/cash-up-calculator.ts.
 */
export default function CashUpCalculatorPage() {
  return (
    <>
      <JsonLd
        data={webApplicationSchema({
          name: 'Cash-up calculator',
          path: PATH,
          description: DESCRIPTION,
          features: [
            'Count UK notes and coins, £50 to 1p',
            'Expected cash from the float, cash sales and paid-outs',
            'Over or short',
            'Card machine check',
            'How much to bank',
          ],
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: TOOLS_INDEX.name, path: TOOLS_INDEX.path },
          { name: freeTool(PATH).name, path: PATH },
        ])}
      />
      <JsonLd data={faqSchema(FAQS)} />

      {/* The curves sit on a wrapper round the hero and the calculator: the hero alone is too short to hold them. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="cashup-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="cashup-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <section className="relative px-4 pt-30 pb-6 sm:px-6 sm:pt-40">
          <div className="relative z-10 mx-auto w-full max-w-5xl">
            <ToolBreadcrumb path={PATH} />
            <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              Free cash-up calculator, <span className="mkt-mark mkt-mark-green rounded-md px-2">for your till</span>
            </h1>
            <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
              Count the drawer, check it against the float and cash sales, and see what to bank. Over, short or spot on, in a minute.
            </p>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free, no sign-up', 'Every UK note and coin', 'Nothing leaves your browser'].map((fact) => (
                <span key={fact} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {fact}
                </span>
              ))}
            </p>
          </div>
        </section>

        <Section spacing="snug" aria-label="Cash-up calculator">
          <CashUpCalculator />
        </Section>
      </div>

      <Section spacing="normal" aria-labelledby="how-to-cash-up">
        <SectionHeading
          id="how-to-cash-up"
          title="How to cash up a till"
          muted="Five steps at closing."
          intro={
            <p>
              Worked through for the example drawer above: a {gbp(FLOAT)} float and {gbp(CASH_SALES)} of cash sales.
            </p>
          }
        />
        <ol className="mt-10 flex max-w-3xl flex-col gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4" data-reveal="" data-reveal-delay={index * 60}>
              <NumberDot n={index + 1} />
              <div className="min-w-0">
                <p className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">{step.title}</p>
                <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{step.body}</p>
                <p className="mt-3 inline-block rounded-md border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-3 py-1.5 font-mono text-sm text-foreground tabular-nums">
                  {step.formula}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section spacing="snug" aria-labelledby="in-duma">
        <SectionHeading id="in-duma" title="Every night, not just tonight." muted="Free in DUMA." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {IN_DUMA.map((point, index) => (
            <FeatureCard key={point.title} icon={point.icon} tone={point.tone} title={point.title} body={point.body} delay={index * 60} />
          ))}
        </div>
      </Section>

      <FaqSection items={FAQS} title="Questions about cashing up" />

      <RelatedSection
        id="related"
        audiences={[...otherTools(PATH), { path: TOOLS_INDEX.path, label: 'Every free tool' }]}
        audiencesTitle="More free tools"
        terms={freeTool(PATH).terms}
      />

      <ClosingCta
        title="This calculator does one night."
        muted="DUMA does every one."
        aside={<RisingLines id="cashup-cta" />}
      />
    </>
  );
}
