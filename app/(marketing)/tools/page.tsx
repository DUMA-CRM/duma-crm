import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowUpRight, Banknote, BookOpen, Calculator, Check } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { COLUMN, ClosingCta, FaqSection, TONE_TEXT } from '@/components/marketing/sections';

import type { Tone } from '@/lib/marketing/home';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema, toolCollectionSchema } from '@/lib/marketing/schema';
import { FREE_TOOLS, TOOLS_INDEX, freeTool } from '@/lib/marketing/tools';
import { cn } from '@/lib/utils/cn';

const DESCRIPTION =
  'Free calculators for UK cafés, restaurants and shops: menu margin and GP after VAT, and a till cash-up count. No sign-up, nothing leaves your browser.';

export const metadata: Metadata = marketingMetadata({
  title: 'Free Tools for Cafés, Restaurants and Shops (UK) | DUMA',
  description: DESCRIPTION,
  path: '/tools',
});

type Icon = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

/**
 * One drifting line in a card's wave band. `period` must divide WAVE_WIDTH,
 * so the line is the same at both ends and the drift loops without a seam.
 */
type Wave = { stroke: string; y: number; amp: number; period: number; seconds: number };

type Tool = {
  path: string;
  icon: Icon;
  tone: Tone;
  /** Who it's for, in the card's corner. */
  tag: string;
  title: string;
  body: string;
  /** What it does, as three ticks. */
  does: readonly string[];
  waves: readonly Wave[];
};

/**
 * The band's viewBox width; each wave is drawn twice as wide and slides one
 * width left, forever. The viewBox is stretched to the band (no cropping), so
 * the top crest (y − amp) sits 28 units down and the hover's 1.12 growth from
 * the bottom still leaves it clear of the band's top edge.
 */
const WAVE_WIDTH = 400;

/** A sine-like wave across two band widths: one quadratic hump, then smooth reflections of it. */
function wavePath({ y, amp, period }: Wave): string {
  const half = period / 2;
  let d = `M0 ${y} Q${half / 2} ${y - amp * 2} ${half} ${y}`;
  for (let x = half * 2; x <= WAVE_WIDTH * 2; x += half) d += ` T${x} ${y}`;
  return d;
}

/**
 * The bottom of a tool card: hand-drawn waves in the tool's colours that draw
 * themselves in, then drift slowly, each at its own pace, while the card is
 * hovered. CSS only — no client JavaScript — and still under
 * prefers-reduced-motion (marketing.css .mkt-wave).
 */
function WaveBand({ id, waves }: { id: string; waves: readonly Wave[] }) {
  return (
    <div
      className="relative mt-auto h-32 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${WAVE_WIDTH} 128`}
        preserveAspectRatio="none"
        className="absolute inset-0 size-full origin-bottom transition-transform duration-500 ease-out group-hover:scale-y-[1.12]"
        fill="none"
      >
        <defs>
          <filter id={`${id}-crayon`} x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="4" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.7" result="grain" />
            <feComposite in="SourceGraphic" in2="grain" operator="in" />
          </filter>
        </defs>
        <g filter={`url(#${id}-crayon)`} strokeWidth="4" strokeLinecap="round">
          {waves.map((wave, index) => (
            <g
              key={wave.stroke + wave.y}
              className="mkt-wave"
              style={{ '--wave-seconds': `${wave.seconds}s`, '--wave-delay': `${0.2 + index * 0.25}s` } as React.CSSProperties}
            >
              <path d={wavePath(wave)} stroke={wave.stroke} pathLength={1} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

const TOOLS: readonly Tool[] = [
  {
    path: '/tools/margin-calculator',
    icon: Calculator,
    tone: 'action',
    tag: 'Cafés & restaurants',
    title: freeTool('/tools/margin-calculator').name,
    body: 'The gross profit and food cost of any dish or drink after VAT, and what to charge for the margin you want.',
    does: ['Margin and GP after VAT', 'Price for a target margin', 'UK VAT at 20%, 5% or 0%'],
    waves: [
      { stroke: 'var(--brand)', y: 50, amp: 22, period: 200, seconds: 36 },
      { stroke: 'var(--stock)', y: 76, amp: 14, period: 400 / 3, seconds: 24 },
      { stroke: 'var(--reference)', y: 96, amp: 10, period: 400, seconds: 48 },
    ],
  },
  {
    path: '/tools/cash-up-calculator',
    icon: Banknote,
    tone: 'stock',
    tag: 'Any till',
    title: freeTool('/tools/cash-up-calculator').name,
    body: 'Count the drawer note by note, see whether it is over or short against the float and cash sales, and what to bank.',
    does: ['Every UK note and coin', 'Over or short, to the penny', 'What to bank, what to keep'],
    waves: [
      { stroke: 'var(--stock)', y: 50, amp: 20, period: 400 / 3, seconds: 32 },
      { stroke: 'var(--measured)', y: 76, amp: 16, period: 200, seconds: 42 },
      { stroke: 'var(--brand)', y: 96, amp: 9, period: 100, seconds: 22 },
    ],
  },
];

const FAQS = [
  {
    question: 'What free tools does DUMA have?',
    answer:
      'Two calculators for UK cafés, restaurants and shops. The menu margin and GP calculator works out the gross profit and food cost of a dish or drink after VAT, and the price for a target margin. The cash-up calculator counts the till drawer note by note, shows whether it is over or short, and what to bank.',
  },
  {
    question: 'Are these tools really free?',
    answer:
      'Yes. There is no sign-up, no trial and no limit on how often you use them. They are free because they are useful, and because they show the sums DUMA does for you every day.',
  },
  {
    question: 'Is anything I type sent anywhere?',
    answer: 'No. Every calculation runs in your browser. Nothing you enter is stored or sent to DUMA.',
  },
  {
    question: 'Do the tools use the same maths as DUMA?',
    answer:
      'Yes. Each tool calls the same code as the part of DUMA it comes from — recipe costing for margin, the till cash-up for the drawer — so a figure here matches the one DUMA would show, to the penny.',
  },
];

/** One tool as a large card: icon and tag, what it does, and a band of drifting waves at the foot. */
function ToolCard({ tool, delay }: { tool: Tool; delay: number }) {
  const Icon = tool.icon;
  return (
    <Link
      href={tool.path}
      className="mkt-card group flex h-full flex-col overflow-hidden transition-colors hover:border-primary/40"
      data-reveal=""
      data-reveal-delay={delay}
    >
      <span className="block px-6 pt-6">
        <span className="flex items-start justify-between gap-4">
          <Icon className={cn('size-6', TONE_TEXT[tool.tone])} aria-hidden="true" />
          <span className="mkt-tag">{tool.tag}</span>
        </span>
        <h2 className="mt-3 flex items-center gap-2 text-xl font-semibold tracking-display text-[var(--mkt-heading)] group-hover:text-primary">
          {tool.title}
          <ArrowUpRight
            className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </h2>
        <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{tool.body}</p>
        <ul className="mt-4 flex flex-col gap-1.5 text-[0.9375rem] text-[var(--mkt-ink-2)]">
          {tool.does.map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </span>
      <WaveBand id={tool.path.slice('/tools/'.length)} waves={tool.waves} />
    </Link>
  );
}

/**
 * /tools — every free tool, as a card with drifting waves at its foot, under
 * the /features hero. A new tool goes in TOOLS here and everywhere
 * lib/marketing/tools.ts lists.
 */
export default function ToolsIndexPage() {
  return (
    <>
      <JsonLd
        data={toolCollectionSchema({
          path: TOOLS_INDEX.path,
          name: 'Free tools for cafés, restaurants and shops',
          description: DESCRIPTION,
          tools: FREE_TOOLS,
        })}
      />
      <JsonLd data={breadcrumbSchema([{ name: TOOLS_INDEX.name, path: TOOLS_INDEX.path }])} />
      <JsonLd data={faqSchema(FAQS)} />

      {/* The curves sit on a wrapper round the hero and the cards, so they are not cut off mid-stroke. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="tools-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="tools-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <section className="relative px-4 pt-30 pb-6 sm:px-6 sm:pt-40">
          <div className={cn(COLUMN, 'relative z-10')}>
            <h1 className="text-[2.75rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              Free calculators for the <span className="mkt-mark mkt-mark-green rounded-md px-2">numbers that matter</span>
            </h1>
            <p className="mt-6 max-w-[48rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
              Free business calculators for UK cafés, restaurants and shops: menu margin and GP after VAT, and a till cash-up — worked out
              with the same code DUMA runs on.
            </p>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free, no sign-up', 'UK VAT and currency', 'Nothing leaves your browser'].map((fact) => (
                <span key={fact} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {fact}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section className="relative px-4 pt-8 pb-16 sm:px-6 sm:pb-20" aria-label="Tools">
          <div className={cn(COLUMN, 'relative z-10')}>
            <ul className="grid gap-4 md:grid-cols-2">
              {TOOLS.map((tool, index) => (
                <li key={tool.path}>
                  <ToolCard tool={tool} delay={index * 60} />
                </li>
              ))}
            </ul>

            {/* More is coming; meanwhile the glossary explains the sums behind every tool. */}
            <Link
              href="/glossary"
              className="group mt-4 flex items-center gap-4 rounded-[14px] border border-dashed border-[var(--mkt-line)] px-6 py-5 transition-colors hover:border-primary/40 hover:bg-[var(--mkt-card)] focus-visible:bg-[var(--mkt-card)]"
              data-reveal=""
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-reference/16 text-reference" aria-hidden="true">
                <BookOpen className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-[var(--mkt-heading)] group-hover:text-primary">More tools on the way</span>
                <span className="mt-0.5 block text-pretty text-[0.9375rem] text-[var(--mkt-ink-2)]">
                  Until then, the terms &amp; definitions explain food cost, prime cost, labour % and the rest — with the sums.
                </span>
              </span>
              <ArrowUpRight className="ml-auto size-4 shrink-0 text-primary" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <FaqSection items={FAQS} title="Questions about the tools" />

      <ClosingCta
        title="These tools do one sum at a time."
        muted="DUMA does them all, every day."
        body="Join DUMA for free: every dish costed from your own stock, every till cashed up and every report built from the sales you are already taking. No card needed."
        aside={<RisingLines id="tools-cta" />}
      />
    </>
  );
}
