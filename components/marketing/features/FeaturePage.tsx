import Link from 'next/link';

import { Mascot } from '@/components/ai/Mascot';
import { Check, ChevronRight, Info } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ScreenshotSlot } from '@/components/marketing/ScreenshotSlot';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { ClosingCta, FaqSection, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { NumberDot } from '@/components/marketing/solution';

import type { FeatureContent } from '@/lib/marketing/features';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { type MarketingModule, linkTo, modulePath, publishedPage } from '@/lib/marketing/site';

/**
 * One /features/[slug] page: hero over a full-width product screenshot, what
 * the feature is for, what it does (each line true today), how it works step
 * by step, what it doesn't do yet, FAQ and a closing card. Words
 * in lib/marketing/features.ts.
 */
export function FeaturePage({ module, content }: { module: MarketingModule; content: FeatureContent }) {
  const { hero } = content;
  const key = `feature-${content.slug}`;
  const path = modulePath(module.slug);
  const index = publishedPage('/features');
  const trail = [...(index ? [{ name: index.label, path: index.path }] : []), { name: module.name, path }];

  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: content.description })} />
      <JsonLd data={breadcrumbSchema(trail)} />
      <JsonLd data={faqSchema(content.faqs)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id={`${key}-left`} className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id={`${key}-right`} className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <div>
            {index && (
              <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-[var(--mkt-ink-3)]">
                <Link href={index.path} className="hover:text-foreground">
                  {index.label}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span className="text-[var(--mkt-ink-2)]" aria-current="page">
                  {module.name}
                </span>
              </nav>
            )}
            <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              {hero.lead} <span className="mkt-mark mkt-mark-green rounded-md px-2">{hero.mark}</span>
            </h1>
            <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">{hero.subtitle}</p>
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
          {/* Full width, as on the home page: a capture of a whole screen needs the room. */}
          <figure className="relative mt-16 sm:mt-20" data-reveal="">
            <div className="pointer-events-none absolute -top-20 right-10 hidden sm:block" aria-hidden="true">
              <Mascot size={120} state="idle" expression="attentif" gesture="wave" gestureKey={key} follow />
            </div>
            {/* Above the mascot, so it peeks out from behind the top edge. */}
            <div className="relative z-10">
              <ScreenshotSlot shot={hero.shot} preload />
            </div>
            <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">{hero.caption}</figcaption>
          </figure>
        </div>
      </section>

      {/* ── What it is ── */}
      <Section spacing="normal" aria-labelledby={`${key}-explainer`}>
        <SectionHeading id={`${key}-explainer`} title={content.explainer.title} />
        <div className="mt-6 grid gap-6 text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)] md:grid-cols-2 md:gap-10">
          {content.explainer.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      {/* ── What it does ── */}
      <Section spacing="normal" aria-labelledby={`${key}-capabilities`}>
        <SectionHeading id={`${key}-capabilities`} title={content.capabilities.title} intro={<p>{content.capabilities.intro}</p>} />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {content.capabilities.items.map((item, i) => (
            <article key={item.title} className="mkt-card px-6 py-5" data-reveal="" data-reveal-delay={(i % 2) * 60}>
              <div className="flex items-start justify-between gap-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {item.title}
                </h3>
                {item.tag && <span className="mkt-tag shrink-0">{item.tag}</span>}
              </div>
              <p className="mt-2 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* ── How it works ── */}
      <Section spacing="normal" aria-labelledby={`${key}-steps`}>
        <SectionHeading id={`${key}-steps`} title={content.steps.title} intro={<p>{content.steps.intro}</p>} />
        <ol className="mt-10 flex max-w-3xl flex-col gap-7">
          {content.steps.items.map((step, i) => (
            <li key={step.title} className="flex gap-4" data-reveal="" data-reveal-delay={i * 60}>
              <NumberDot n={i + 1} />
              <div>
                <p className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">{step.title}</p>
                <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Not yet ── */}
      <Section spacing="snug" aria-labelledby={`${key}-not-yet`}>
        <div className="mkt-card px-6 py-7 sm:px-8" data-reveal="">
          <h2 id={`${key}-not-yet`} className="flex items-center gap-2 text-2xl font-semibold tracking-display">
            <Info className="size-5 text-primary" aria-hidden="true" />
            {content.notYet.title}
          </h2>
          <p className="mt-3 max-w-3xl text-pretty text-[var(--mkt-ink-2)]">{content.notYet.intro}</p>
          <ul className="mt-6 grid gap-x-10 gap-y-3 text-pretty text-[0.9375rem] leading-relaxed md:grid-cols-2">
            {content.notYet.items.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--mkt-ink-3)]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
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
