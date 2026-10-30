import { ShapeShiftingMascot } from '@/components/marketing/ShapeShiftingMascot';
import { Check, Minus, X } from '@/components/icons';
import { SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { CornerStrokes } from '@/components/marketing/Strokes';
import { Logo } from '@/components/shared/Logo';

import { linkTo } from '@/lib/marketing/site';
import type { ComparisonOption, CoverMark, ListItem } from '@/lib/marketing/solutions';
import { cn } from '@/lib/utils/cn';

/**
 * The sections every /solutions page shares, after seline.com/for-ecommerce:
 * a numbered list of costly habits, a grid of use cases, the explainer (setup
 * steps, numbers worth watching, three ways to run it) and the CTA band. Each
 * page supplies the words; the layout lives here once.
 */

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

/** Circled step and list numbers, in the brand green. */
export function NumberDot({ n }: { n: number }) {
  return (
    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground tabular-nums" aria-hidden="true">
      {n}
    </span>
  );
}

/** "Five things that quietly cost a … money": a numbered list of habits and what DUMA does about each. */
export function MistakesSection({ id, title, items }: { id: string; title: string; items: readonly ListItem[] }) {
  return (
    <Section spacing="normal" aria-labelledby={id}>
      <SectionHeading id={id} title={title} />
      <ol className="mt-10 flex max-w-3xl flex-col gap-7">
        {items.map((item, index) => (
          <li key={item.title} className="flex gap-4" data-reveal="" data-reveal-delay={index * 60}>
            <NumberDot n={index + 1} />
            <div>
              <p className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">{item.title}</p>
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{item.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** A two-paragraph lead, then the use cases as icon cards. `icons` follows `items` in order. */
export function UseCasesSection({ id, title, lead, items, icons }: { id: string; title: string; lead: [string, string]; items: readonly ListItem[]; icons: readonly IconType[] }) {
  return (
    <Section spacing="normal" aria-labelledby={id}>
      <SectionHeading id={id} title={title} />
      <div className="mt-6 grid gap-6 text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)] md:grid-cols-2 md:gap-10">
        <p>{lead[0]}</p>
        <p>{lead[1]}</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.title} className="mkt-card px-6 py-6" data-reveal="" data-reveal-delay={index * 60}>
              <h3 className="flex items-center gap-2.5 text-lg font-semibold">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                {item.title}
              </h3>
              <p className="mt-3 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{item.body}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * The explainer: a heading and intro, setup in numbered steps, a card of the
 * numbers worth watching (each with an icon), and the three-way comparison.
 */
export function ExplainerSection({
  id,
  title,
  intro,
  setupTitle,
  steps,
  metricsTitle,
  metrics,
  metricIcons,
  comparisonTitle,
  comparisonHighlight,
  comparisonLead,
  comparison,
  comparisonIcons,
}: {
  id: string;
  title: string;
  intro: React.ReactNode;
  setupTitle: string;
  steps: readonly ListItem[];
  metricsTitle: string;
  metrics: readonly ListItem[];
  metricIcons: readonly IconType[];
  comparisonTitle: string;
  /** The last words of the comparison heading, set in the green highlight. */
  comparisonHighlight: string;
  comparisonLead: string;
  comparison: readonly ComparisonOption[];
  /** One per non-DUMA column; DUMA's own column shows the logo. */
  comparisonIcons: readonly IconType[];
}) {
  return (
    <Section spacing="normal" aria-labelledby={id}>
      <SectionHeading id={id} title={title} intro={intro} />

      <h3 className="mt-14 text-lg font-semibold text-[var(--mkt-heading)]">{setupTitle}</h3>
      <ol className="mt-6 flex flex-col gap-6">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-4" data-reveal="" data-reveal-delay={index * 60}>
            <NumberDot n={index + 1} />
            <div>
              <p className="font-semibold text-[var(--mkt-heading)]">{step.title}</p>
              <p className="mt-1 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mkt-card mt-14 px-6 py-7 sm:px-8" data-reveal="">
        <h3 className="text-lg font-semibold text-[var(--mkt-heading)]">{metricsTitle}</h3>
        <dl className="mt-6 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {metrics.map((metric, index) => {
            const Icon = metricIcons[index];
            return (
              <div key={metric.title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--mkt-ground)] text-primary">
                  <Icon className="size-[1.125rem]" aria-hidden="true" />
                </span>
                <div>
                  <dt className="font-semibold text-[var(--mkt-heading)]">{metric.title}</dt>
                  <dd className="mt-1 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{metric.body}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </div>

      <ComparisonColumns title={comparisonTitle} highlight={comparisonHighlight} lead={comparisonLead} options={comparison} icons={comparisonIcons} />
    </Section>
  );
}

const COVER_LABEL = { yes: 'Covered', part: 'Partly covered', no: 'Not covered' } as const;

/** Tick, dash or cross in a small disc — readable on the light cards and on DUMA's dark one. */
function CoverIcon({ mark, dark = false }: { mark: CoverMark; dark?: boolean }) {
  const disc = {
    yes: dark ? 'bg-white/15 text-sidebar-foreground' : 'bg-success-highlight text-success',
    part: 'bg-stock/15 text-stock',
    no: 'bg-[var(--mkt-line)] text-[var(--mkt-ink-3)]',
  }[mark];
  const Glyph = mark === 'yes' ? Check : mark === 'part' ? Minus : X;
  return (
    <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', disc)} aria-hidden="true">
      <Glyph className="size-3" />
    </span>
  );
}

/** Three ways to run it, side by side; the last column (DUMA) is raised in the forest shell. */
export function ComparisonColumns({ title, highlight, lead, options, icons }: { title: string; highlight: string; lead: string; options: readonly ComparisonOption[]; icons: readonly IconType[] }) {
  return (
    <div className="mt-16" data-reveal="">
      <h3 className="text-center text-2xl leading-[1.15] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-3xl">
        {title} <span className="mkt-mark mkt-mark-green rounded-md px-1.5">{highlight}</span>
      </h3>
      <p className="mx-auto mt-3 max-w-xl text-center text-pretty text-[var(--mkt-ink-2)]">{lead}</p>

      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-3">
        {options.map((option, index) => {
          const duma = index === options.length - 1;
          const Icon = icons[index];
          return (
            <article
              key={option.title}
              className={cn(
                'flex flex-col rounded-[14px] px-6 py-7',
                duma ? 'bg-sidebar text-sidebar-foreground shadow-[0_24px_48px_-20px_rgb(14_36_27/0.55)] md:-my-3 md:py-10' : 'mkt-card',
              )}
            >
              <span className={cn('grid size-11 place-items-center rounded-lg', duma ? 'bg-white/10' : 'bg-[var(--mkt-ground)] text-[var(--mkt-ink-2)]')}>
                {duma ? <Logo size={24} className="rounded-[19.4%]" /> : Icon && <Icon className="size-5" aria-hidden="true" />}
              </span>
              <h4 className="mt-4 text-lg font-semibold">{option.title}</h4>
              <p className={cn('mt-1.5 text-pretty text-[0.9375rem] leading-relaxed', duma ? 'text-sidebar-foreground/75' : 'text-[var(--mkt-ink-2)]')}>{option.summary}</p>

              <ul className={cn('mt-6 flex flex-col gap-3.5 border-t pt-6 text-[0.9375rem]', duma ? 'border-white/12' : 'border-[var(--mkt-line)]')}>
                {option.rows.map((row) => (
                  <li key={row.job} className="flex gap-3">
                    <CoverIcon mark={row.mark} dark={duma} />
                    <span>
                      <span className={cn('block', row.mark === 'no' && !duma && 'text-[var(--mkt-ink-2)]')}>{row.job}</span>
                      {row.note && <span className={cn('block text-[13px]', duma ? 'text-sidebar-foreground/60' : 'text-[var(--mkt-ink-3)]')}>{row.note}</span>}
                      <span className="sr-only">{COVER_LABEL[row.mark]}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <p className={cn('mt-auto pt-6 text-sm', duma ? 'text-sidebar-foreground/75' : 'text-[var(--mkt-ink-2)]')}>
                <span className={cn('block text-xs font-medium tracking-[0.06em] uppercase', duma ? 'text-sidebar-foreground/55' : 'text-[var(--mkt-ink-3)]')}>Best for</span>
                <span className={cn('mt-1 block', duma && 'font-medium text-sidebar-foreground')}>{option.bestFor}</span>
              </p>
              {duma && <SignUpButton inverted className="mt-6 w-full" />}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** The CTA band: corner strokes, the shape-shifting mascot, a headline and the two actions. */
export function SetupBand({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <section className="relative overflow-hidden px-4 py-28 text-center sm:px-6 sm:py-40" aria-labelledby={id}>
      <CornerStrokes />
      <div className="relative z-10 mx-auto max-w-2xl">
        <div className="flex justify-center" aria-hidden="true">
          <ShapeShiftingMascot size={140} state="idle" expression="excite" gesture="celebrate" gestureKey={id} follow />
        </div>
        <h2 id={id} className="mt-6 text-balance text-3xl leading-[1.12] font-semibold tracking-display sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <SignUpButton />
          <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
        </div>
        <p className="mt-5 text-sm text-[var(--mkt-ink-2)]">Free plan, forever. No card needed.</p>
      </div>
    </section>
  );
}
