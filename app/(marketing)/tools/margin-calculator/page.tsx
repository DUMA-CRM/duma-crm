import type { Metadata } from 'next';

import { BarChart3, Check, Layers, Receipt, Truck } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { RelatedSection } from '@/components/marketing/RelatedLinks';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { ClosingCta, FaqSection, FeatureCard, Mark, Section, SectionHeading } from '@/components/marketing/sections';
import { NumberDot } from '@/components/marketing/solution';
import { MarginCalculator } from '@/components/marketing/tools/MarginCalculator';
import { ToolBreadcrumb } from '@/components/marketing/tools/ToolBreadcrumb';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema, webApplicationSchema } from '@/lib/marketing/schema';
import { TOOLS_INDEX, freeTool, otherTools } from '@/lib/marketing/tools';
import { computeCosting } from '@/lib/menu/costing';
import { fmtGbpExact } from '@/lib/utils/format';
import { foodCostPct, priceForTargetMargin } from '@/lib/utils/margin-calculator';

const PATH = '/tools/margin-calculator';

// "GP" is how UK kitchens say gross profit, and what most of them search for.
const DESCRIPTION =
  'Free UK menu margin and GP calculator. See a dish’s gross profit and food cost after VAT, and what to charge for your target margin. No sign-up.';

export const metadata: Metadata = marketingMetadata({
  title: 'Free Menu Margin & GP Calculator with VAT (UK) | DUMA',
  description: DESCRIPTION,
  path: PATH,
});

// The worked example is computed, not typed, so it can never disagree with the calculator.
const PRICE = 3.2;
const COGS = 0.6;
const TARGET = 70;
const INCLUSIVE = { pricesIncludeTax: true, defaultVatRate: 20, vatRegistered: true };
const REGISTERED = computeCosting({ price: PRICE, cogs: COGS, ctx: INCLUSIVE });
const TARGET_PRICE = priceForTargetMargin({ cogs: COGS, targetPct: TARGET, ctx: INCLUSIVE });
const TARGET_NET = computeCosting({ price: TARGET_PRICE ?? 0, cogs: COGS, ctx: INCLUSIVE }).netRevenue;
const pct = (n: number | null) => (n === null ? '–' : `${n.toFixed(1)}%`);
const gbp = fmtGbpExact;

/** Each step of the sum, with its formula worked through on the flat white. */
const STEPS = [
  {
    title: 'Take the VAT out of the price',
    body: 'If you are VAT-registered, part of every price belongs to HMRC. At 20% it is one sixth of a VAT-inclusive price.',
    formula: `${gbp(PRICE)} × 20 ÷ 120 = ${gbp(REGISTERED.vat)}`,
  },
  {
    title: 'Subtract the ingredients',
    body: 'What is left after VAT, less the cost of everything in one portion, is what the dish earns you.',
    formula: `${gbp(REGISTERED.netRevenue)} − ${gbp(COGS)} = ${gbp(REGISTERED.margin)}`,
  },
  {
    title: 'Divide by the price after VAT',
    body: `That is your margin as a percentage. Food cost is the rest: ${pct(foodCostPct(REGISTERED))} here.`,
    formula: `${gbp(REGISTERED.margin)} ÷ ${gbp(REGISTERED.netRevenue)} = ${pct(REGISTERED.marginPct)}`,
  },
  {
    title: 'Work backwards to a price',
    body: `For a ${TARGET}% margin, divide the ingredient cost by what is left of each pound, then put the VAT back on.`,
    formula: `${gbp(COGS)} ÷ (1 − ${TARGET}%) = ${gbp(TARGET_NET)}, + 20% VAT = ${TARGET_PRICE === null ? '–' : gbp(TARGET_PRICE)}`,
  },
] as const;

/** Where the flat white's price goes, for the bar beside the steps. */
const SPLIT = [
  { label: 'VAT', amount: REGISTERED.vat, fill: 'bg-[var(--mkt-ink-3)]/35' },
  { label: 'Ingredients', amount: COGS, fill: 'bg-stock' },
  { label: 'You keep', amount: REGISTERED.margin, fill: 'bg-primary' },
] as const;

/** What DUMA's recipe costing adds to this one-dish calculator — each line as the products-catalog feature page states it. */
const IN_DUMA = [
  {
    icon: Receipt,
    tone: 'reference',
    title: 'Every recipe, saved',
    body: 'Cost each dish from your own stock items, and come back to it.',
  },
  {
    icon: Truck,
    tone: 'stock',
    title: 'Costs that keep up',
    body: 'Receiving a delivery updates what each ingredient costs, so the margin follows your suppliers.',
  },
  {
    icon: Layers,
    tone: 'orders',
    title: 'Every size and option',
    body: 'A large latte or a swap to oat milk changes the cost, exactly as the till sells it.',
  },
  {
    icon: BarChart3,
    tone: 'action',
    title: 'Your whole menu, ranked',
    body: 'Menu engineering sorts dishes by popularity and margin, with what to do about each.',
  },
] as const;

const FAQS = [
  {
    question: 'What is GP on food, and how do I work it out?',
    answer: `GP is gross profit: what a dish leaves you after its ingredients, usually as a percentage of the price after VAT. It is the margin this calculator shows. A ${gbp(PRICE)} flat white with ${gbp(COGS)} of ingredients at 20% VAT leaves ${gbp(REGISTERED.margin)}, a ${pct(REGISTERED.marginPct)} GP.`,
  },
  {
    question: 'What GP should a café or restaurant aim for?',
    answer:
      'There is no single right figure. Many kitchens aim for a GP of around 65–75% on food, the other side of a 25–35% food cost, and drinks often run higher. Set a target for each part of the menu and check every dish against it, because one popular item below target can cost more than the rest earn.',
  },
  {
    question: 'How do I set a menu price from food cost?',
    answer: `Divide the ingredient cost by what is left of each pound at your target margin, then add VAT if your prices include it. ${gbp(COGS)} at ${TARGET}% is ${gbp(COGS)} ÷ ${(1 - TARGET / 100).toFixed(1)} = ${gbp(TARGET_NET)}, or ${TARGET_PRICE === null ? '–' : gbp(TARGET_PRICE)} with 20% VAT. The calculator does this and rounds up to the next 10p.`,
  },
  {
    question: 'How do I calculate the margin on a menu item?',
    answer:
      'Take VAT out of the price if you are VAT-registered, then subtract the cost of the ingredients in one portion. Margin percentage is that amount divided by the price after VAT. For a £3.20 flat white with 60p of ingredients at 20% VAT, that is £2.07, or about 77.5%.',
  },
  {
    question: 'What is food cost percentage?',
    answer:
      'Ingredient cost as a share of what you keep from the price after VAT. It is the other side of margin: a 77.5% margin is a 22.5% food cost. The right figure depends on your menu and your prices, so watch it per dish.',
  },
  {
    question: 'Should I include VAT when I work out margin?',
    answer:
      'Only take it out if you are VAT-registered. The VAT in your price belongs to HMRC, so comparing ingredient cost with the full price overstates your margin. If you are not registered, there is no VAT to take out.',
  },
  {
    question: 'Which VAT rate applies to my food?',
    answer:
      'It depends on the item and how it is sold: hot food and drinks, eating in and some cold takeaway items are treated differently. The calculator lets you pick 20%, 5% or 0% per item; check HMRC’s guidance or ask your accountant which one applies.',
  },
  {
    question: 'Is this calculator the same maths DUMA uses?',
    answer:
      'Yes. It runs the same costing function as DUMA’s recipe costing, so a margin here matches the one DUMA shows on a recipe, to the penny. Nothing you type here is sent anywhere.',
  },
];

/**
 * /tools/margin-calculator — the free menu margin calculator. The page is
 * server-rendered and explains the sum; the calculator itself is a client
 * island (components/marketing/tools/MarginCalculator.tsx). Every figure,
 * including the worked example here, comes from lib/menu/costing.ts.
 */
export default function MarginCalculatorPage() {
  return (
    <>
      <JsonLd
        data={webApplicationSchema({
          name: 'Menu margin & GP calculator',
          path: PATH,
          description: DESCRIPTION,
          features: ['Margin and GP after VAT', 'Food cost percentage', 'Menu price for a target margin', 'UK VAT at 20%, 5% or 0%'],
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: TOOLS_INDEX.name, path: TOOLS_INDEX.path },
          { name: freeTool(PATH).name, path: PATH },
        ])}
      />
      <JsonLd data={faqSchema(FAQS)} />

      {/* The curves sit on a wrapper round the hero and the calculator: the hero
          alone is too short, and clipped to it they were cut off mid-stroke. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="calc-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="calc-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <section className="relative px-4 pt-30 pb-6 sm:px-6 sm:pt-40">
          <div className="relative z-10 mx-auto w-full max-w-5xl">
            <ToolBreadcrumb path={PATH} />
            <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              Free menu margin &amp; GP calculator, <span className="mkt-mark mkt-mark-green rounded-md px-2">with VAT</span>
            </h1>
            <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
              Work out the gross profit (GP) and food cost of any dish or drink after VAT, and what to charge for the margin you want.
            </p>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free, no sign-up', 'UK VAT rates', 'Nothing leaves your browser'].map((fact) => (
                <span key={fact} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {fact}
                </span>
              ))}
            </p>
          </div>
        </section>

        <Section spacing="snug" aria-label="Margin calculator">
          <MarginCalculator />
        </Section>
      </div>

      <Section spacing="normal" aria-labelledby="how-it-works">
        <SectionHeading
          id="how-it-works"
          title="How to calculate menu margin"
          muted="Four lines of arithmetic."
          intro={
            <p>
              Worked through for a {gbp(PRICE)} flat white with {gbp(COGS)} of ingredients, at a café that is VAT-registered and prices with
              VAT included.
            </p>
          }
        />
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
          <ol className="flex flex-col gap-8">
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

          <figure className="mkt-card px-5 py-5 lg:sticky lg:top-24" data-reveal="">
            <figcaption className="text-sm font-semibold text-[var(--mkt-heading)]">Where the {gbp(PRICE)} goes</figcaption>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
              {SPLIT.map((part) => (
                <span key={part.label} className={part.fill} style={{ width: `${(part.amount / PRICE) * 100}%` }} />
              ))}
            </div>
            <dl className="mt-4 flex flex-col gap-2 text-[0.9375rem]">
              {SPLIT.map((part) => (
                <div key={part.label} className="flex items-center justify-between gap-4">
                  <dt className="flex items-center gap-2 text-[var(--mkt-ink-2)]">
                    <span className={`size-2.5 rounded-[3px] ${part.fill}`} aria-hidden="true" />
                    {part.label}
                  </dt>
                  <dd className={part.label === 'You keep' ? 'font-mono font-semibold tabular-nums' : 'font-mono tabular-nums'}>
                    {part.label === 'You keep' ? <Mark>{gbp(part.amount)}</Mark> : gbp(part.amount)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 border-t border-[var(--mkt-line)] pt-4 text-sm leading-relaxed text-[var(--mkt-ink-2)]">
              Ignore the VAT and it looks like you keep <span className="font-mono text-foreground tabular-nums">{gbp(PRICE - COGS)}</span>,
              a margin of {pct(((PRICE - COGS) / PRICE) * 100)}. That is only true if you are not VAT-registered.
            </p>
          </figure>
        </div>
      </Section>

      {/* ── What DUMA adds to the calculator: claims as the recipe costing feature page states them ── */}
      <Section spacing="snug" aria-labelledby="in-duma">
        <SectionHeading id="in-duma" title="Every dish, not just one." muted="Free in DUMA." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {IN_DUMA.map((point, index) => (
            <FeatureCard key={point.title} icon={point.icon} tone={point.tone} title={point.title} body={point.body} delay={index * 60} />
          ))}
        </div>
      </Section>

      <FaqSection items={FAQS} title="Questions about menu margin" />

      <RelatedSection
        id="related"
        audiences={[...otherTools(PATH), { path: TOOLS_INDEX.path, label: 'Every free tool' }]}
        audiencesTitle="More free tools"
        terms={freeTool(PATH).terms}
      />

      <ClosingCta
        title="This calculator does one dish."
        muted="DUMA does your whole menu."
        body="Join DUMA for free and cost every dish from your own stock, with the same VAT sums as this page — saved, and kept up to date as your supplier prices change. No card needed."
        aside={<RisingLines id="calc-cta" />}
      />
    </>
  );
}
