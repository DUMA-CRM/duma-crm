import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import {
  ArrowRight,
  Building2,
  Calculator,
  Check,
  Clock,
  Code,
  CreditCard,
  Info,
  Layers,
  LifeBuoy,
  Receipt,
  Repeat,
  ShoppingBag,
  Smartphone,
  Store,
  Users,
  Wallet,
  WifiOff,
} from '@/components/icons';
import { COMPARE_LABEL, CompareLegend, CompareMark, type CompareVerdict } from '@/components/marketing/CompareMark';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { ConnectionBeams } from '@/components/marketing/compare/ConnectionBeams';
import {
  ClosingCta,
  FaqSection,
  FeatureCard,
  SecondaryButton,
  Section,
  SectionHeading,
  SignUpButton,
} from '@/components/marketing/sections';
import { NumberDot } from '@/components/marketing/solution';
import { Logo } from '@/components/shared/Logo';

import type { Comparison, DifferentIcon, StrongerIcon } from '@/lib/marketing/compare';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema } from '@/lib/marketing/schema';
import { linkTo } from '@/lib/marketing/site';

export function compareMetadata(content: Comparison): Metadata {
  return marketingMetadata({ title: content.metaTitle, description: content.description, path: content.path });
}

function sourceHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** A small "source" link beside a competitor figure, so every number can be checked. */
function Source({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-[13px] text-[var(--mkt-ink-3)] underline decoration-dotted underline-offset-2 hover:text-primary"
    >
      Source: {sourceHost(href)}
    </a>
  );
}

type IconComponent = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

const STRONGER_ICON: Record<StrongerIcon, IconComponent> = {
  payments: CreditCard,
  hardware: Smartphone,
  offline: WifiOff,
  till: Receipt,
  scale: Building2,
  store: ShoppingBag,
  apps: Layers,
  sync: Repeat,
};

const DIFFERENT_ICON: Record<DifferentIcon, IconComponent> = {
  bill: Wallet,
  margin: Calculator,
  team: Clock,
  sync: Repeat,
  api: Code,
  help: LifeBuoy,
  till: Receipt,
  apps: Layers,
  customers: Users,
  card: CreditCard,
};

/** A table cell: its disc, when the row has one, beside the words that justify it. */
function Verdict({ mark, children }: { mark?: CompareVerdict; children: React.ReactNode }) {
  return (
    <span className="flex gap-3 text-sm leading-relaxed text-pretty">
      {mark && (
        <>
          <CompareMark mark={mark} />
          <span className="sr-only">{COMPARE_LABEL[mark]}:</span>
        </>
      )}
      <span className={mark ? undefined : 'pl-[34px]'}>{children}</span>
    </span>
  );
}

/** Shown beside every block of competitor figures. */
function AsOfNote({ content }: { content: Comparison }) {
  return (
    <p className="flex items-start gap-2 text-sm text-[var(--mkt-ink-2)]">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        {content.competitor}’s prices and features as of {content.asOf}, read on {content.competitor}’s own UK website on{' '}
        <time dateTime={content.checked}>
          {new Date(`${content.checked}T12:00:00Z`).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </time>
        . Prices change, so check the linked source before you decide.
      </span>
    </p>
  );
}

/**
 * One /compare/duma-vs-… page from its content: a hero that says plainly what
 * each product is for, the short answer, the home page's comparison table with
 * a source on every competitor figure, their monthly bill against DUMA's £0,
 * where the competitor is stronger, where DUMA is different, how to use both
 * (with a picture of what connects), FAQ and a closing card. The words, and the rules for them, are in lib/marketing/compare.ts.
 */
export function ComparePage({ content }: { content: Comparison }) {
  const { hero } = content;
  const key = content.slug;
  const billTotal = content.pricing.bill.lines.reduce((sum, line) => sum + line.pounds, 0);

  return (
    <>
      {/* No /compare index exists yet, so the trail is Home → this page. */}
      <JsonLd data={breadcrumbSchema([{ name: content.breadcrumb, path: content.path }])} />
      <JsonLd data={faqSchema(content.faqs)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id={`${key}-left`} className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <h1 className="text-[2.4rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-[3.4rem]">
            {hero.lead} <span className="mkt-mark mkt-mark-green rounded-md px-2">{hero.mark}</span>
          </h1>
          <p className="mt-6 text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">{hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <SignUpButton />
            <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
            {hero.ticks.map((fact) => (
              <span key={fact} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" aria-hidden="true" />
                {fact}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* ── The short answer ── */}
      <Section spacing="snug" aria-labelledby={`${key}-verdict`}>
        <div className="mkt-card px-6 py-7 sm:px-8" data-reveal="">
          <h2 id={`${key}-verdict`} className="text-2xl font-semibold tracking-display">
            {content.verdict.title}
          </h2>
          <div className="mt-4 grid gap-5 text-pretty leading-relaxed text-[var(--mkt-ink-2)] md:grid-cols-2 md:gap-10">
            {content.verdict.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Side by side, in the home page's table: DUMA's column picked out, a disc per row ── */}
      <Section spacing="normal" aria-labelledby={`${key}-table`}>
        <SectionHeading id={`${key}-table`} title={content.table.title} intro={<p>{content.table.intro}</p>} />
        <div className="mt-6">
          <AsOfNote content={content} />
        </div>
        <div className="mt-10 overflow-x-auto" data-reveal="">
          <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-[0.9375rem]">
            <caption className="sr-only">
              DUMA compared with {content.competitor}, {content.competitor}’s figures as of {content.asOf}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[24%] p-3 text-left font-normal">
                  <span className="sr-only">Job</span>
                </th>
                <th
                  scope="col"
                  className="w-[38%] rounded-t-lg border-x-2 border-t-2 border-primary/60 bg-[var(--mkt-marker)]/40 px-4 pt-5 pb-3 font-semibold"
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <Mascot size={32} state="idle" expression="neutre" />
                    DUMA
                  </span>
                </th>
                <th scope="col" className="w-[38%] px-4 pt-5 pb-3 font-semibold">
                  <span className="flex flex-col items-center gap-1.5">
                    <Store className="size-6 text-[var(--mkt-ink-3)]" aria-hidden="true" />
                    {content.competitor}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {content.table.rows.map((row) => (
                <tr key={row.job}>
                  <th
                    scope="row"
                    className="border-t border-[var(--mkt-line)] p-4 text-left align-top font-medium text-[var(--mkt-heading)]"
                  >
                    {row.job}
                  </th>
                  <td className="border-x-2 border-t border-x-primary/60 border-t-[var(--mkt-line)] bg-[var(--mkt-marker)]/40 px-4 py-4 align-top">
                    <Verdict mark={row.marks?.duma}>{row.duma}</Verdict>
                  </td>
                  <td className="border-t border-[var(--mkt-line)] px-4 py-4 align-top text-[var(--mkt-ink-2)]">
                    <Verdict mark={row.marks?.them}>
                      {row.them}
                      {row.source && (
                        <span className="mt-1 block">
                          <Source href={row.source} />
                        </span>
                      )}
                    </Verdict>
                  </td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="rounded-b-lg border-x-2 border-t border-b-2 border-x-primary/60 border-t-[var(--mkt-line)] border-b-primary/60 bg-[var(--mkt-marker)]/40 px-4 py-5 text-center">
                  <SignUpButton />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <CompareLegend className="mt-6" />
      </Section>

      {/* ── Prices: their bill, line by line, against DUMA's ── */}
      <Section spacing="normal" aria-labelledby={`${key}-pricing`}>
        <SectionHeading id={`${key}-pricing`} title={content.pricing.title} intro={<p>{content.pricing.intro}</p>} />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="mkt-card flex flex-col px-6 py-6 sm:px-7" data-reveal="">
            <h3 className="text-lg font-semibold tracking-display">{content.pricing.bill.title}</h3>
            <dl className="mt-4 flex flex-col">
              {content.pricing.bill.lines.map((line) => (
                <div key={line.label} className="flex items-start justify-between gap-4 border-b border-[var(--mkt-line)] py-3">
                  <dt>
                    <span className="block text-[0.9375rem]">{line.label}</span>
                    <Source href={line.source} />
                  </dt>
                  <dd className="font-mono tabular-nums">£{line.pounds}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 pt-4">
                <dt className="font-semibold">Each month</dt>
                <dd className="font-mono text-3xl font-semibold tabular-nums">£{billTotal}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-pretty text-[var(--mkt-ink-2)]">{content.pricing.bill.note}</p>
          </article>

          <article
            className="mkt-card flex flex-col border-2 border-primary/60 bg-[var(--mkt-marker)]/25 px-6 py-6 sm:px-7"
            data-reveal=""
            data-reveal-delay={80}
          >
            <h3 className="text-lg font-semibold tracking-display">{content.pricing.dumaBill.title}</h3>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-5xl font-semibold tabular-nums">£0</span>
              <span className="text-[var(--mkt-ink-2)]">a month, forever</span>
            </p>
            <p className="mt-2 text-sm text-pretty text-[var(--mkt-ink-2)]">{content.pricing.dumaBill.note}</p>
            <ul className="mt-5 flex flex-col gap-3 border-t border-[var(--mkt-line)] pt-5 text-[0.9375rem] text-pretty text-[var(--mkt-ink-2)]">
              {content.pricing.duma.map((line) => (
                <li key={line} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
          </article>
        </div>

        <h3 className="mt-12 text-sm font-semibold text-[var(--mkt-heading)]">{content.competitor}’s UK price list</h3>
        <ul className="mt-4 grid gap-x-10 gap-y-4 md:grid-cols-2">
          {content.pricing.facts.map((fact) => (
            <li key={fact.text} className="border-l-2 border-[var(--mkt-line)] pl-4 text-[0.9375rem]">
              <p className="text-pretty">{fact.text}</p>
              <Source href={fact.source} />
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Where the competitor is stronger, and where DUMA is different ── */}
      <Section spacing="normal" aria-labelledby={`${key}-stronger`}>
        <SectionHeading id={`${key}-stronger`} title={content.stronger.title} intro={<p>{content.stronger.intro}</p>} />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.stronger.items.map((item, index) => {
            const Icon = STRONGER_ICON[item.icon];
            return (
              <article
                key={item.title}
                className="mkt-card flex flex-col overflow-hidden"
                data-reveal=""
                data-reveal-delay={(index % 3) * 60}
              >
                <div className="px-6 pt-6 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Their colour, not ours: the card is about the competitor. */}
                    <Icon className="size-6 text-[var(--mkt-ink-2)]" aria-hidden="true" />
                    <span className="mkt-tag">{content.competitor}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-display">{item.title}</h3>
                  <p className="mt-2 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{item.them}</p>
                </div>
                {/* DUMA's answer, as the card's footer: a band of its own under a hairline. */}
                <div className="mt-auto border-t border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-6 py-4">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] text-[var(--mkt-heading)] uppercase">
                    <Logo size={16} className="rounded-[19.4%]" />
                    On DUMA
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-pretty text-[var(--mkt-ink-2)]">{item.duma}</p>
                </div>
              </article>
            );
          })}
          {/* The sixth tile: when the competitor alone is enough, and when DUMA earns its place beside it. */}
          <article
            className="flex flex-col justify-between rounded-[14px] bg-sidebar px-6 py-6 text-sidebar-foreground"
            data-reveal=""
            data-reveal-delay={120}
          >
            <div>
              <p className="text-lg leading-snug font-semibold tracking-display">{content.stronger.verdict.alone}</p>
              <p className="mt-3 text-pretty leading-relaxed text-sidebar-foreground/75">{content.stronger.verdict.addDuma}</p>
            </div>
            <a
              href={`#${key}-together`}
              className="mt-5 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-white hover:underline"
            >
              How they work together
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </article>
        </div>
      </Section>

      <Section spacing="normal" aria-labelledby={`${key}-different`}>
        <SectionHeading id={`${key}-different`} title={content.different.title} intro={<p>{content.different.intro}</p>} />
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {content.different.items.map((item, index) => (
            <FeatureCard
              key={item.title}
              icon={DIFFERENT_ICON[item.icon]}
              tone={item.tone}
              title={item.title}
              body={item.body}
              delay={(index % 3) * 60}
            />
          ))}
        </div>
      </Section>

      {/* ── Using both: a picture of what connects, in a row of its own, then the steps ── */}
      <Section spacing="normal" aria-labelledby={`${key}-together`}>
        <SectionHeading id={`${key}-together`} title={content.together.title} intro={<p>{content.together.intro}</p>} />
        <figure className="mx-auto mt-12 max-w-4xl" data-reveal="">
          <ConnectionBeams connections={content.together.connections} />
          <figcaption className="mt-6 text-center text-sm text-[var(--mkt-ink-2)]">
            What connects to DUMA, and what a sale updates.
          </figcaption>
        </figure>
        <ol className="mt-14 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {content.together.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4" data-reveal="" data-reveal-delay={index * 60}>
              <NumberDot n={index + 1} />
              <div>
                <p className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">{step.title}</p>
                <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <FaqSection items={content.faqs} title={content.faqTitle} />

      <ClosingCta
        title={content.closing.title}
        muted={content.closing.muted}
        body={content.closing.body}
        aside={<RisingLines id={`${key}-cta`} />}
      />
    </>
  );
}
