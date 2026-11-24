import { JsonLd } from '@/components/marketing/JsonLd';
import { RelatedSection } from '@/components/marketing/RelatedLinks';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';
import { ClosingCta, FaqSection, FeatureCard, HeroTicks, HeroTitle, Section, SectionHeading } from '@/components/marketing/sections';
import { NumberDot } from '@/components/marketing/solution';
import { ToolBreadcrumb } from '@/components/marketing/tools/ToolBreadcrumb';

import type { Tone } from '@/lib/marketing/home';
import { breadcrumbSchema, faqSchema, webApplicationSchema } from '@/lib/marketing/schema';
import { TOOLS_INDEX, freeTool, otherTools } from '@/lib/marketing/tools';

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

/** One numbered step of the sum, with its worked formula when it has one. */
export type ToolStep = { title: string; body: string; formula?: string };

export type ToolPageProps = {
  path: string;
  description: string;
  /** The WebApplication schema's featureList. */
  features: string[];
  /** Prefix for the chalk-curve and closing-stroke SVG ids, unique per page. */
  curveId: string;
  hero: { lead: React.ReactNode; mark: React.ReactNode; subtitle: string; ticks: readonly string[] };
  /** The client island, and its section's accessible name. */
  tool: { node: React.ReactNode; label: string; /** Names the section with a visually hidden h2 of this id instead of aria-label. */ headingId?: string };
  how: {
    id: string;
    title: string;
    muted: string;
    intro: React.ReactNode;
    steps: readonly ToolStep[];
    /** A figure beside the steps; without one the steps take a single narrower column. */
    aside?: React.ReactNode;
  };
  inDuma: { title: string; points: readonly { icon: IconType; tone: Tone; title: string; body: string }[] };
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  /** Links to the other free tools and the glossary terms this one works out. */
  related?: boolean;
  closing: { title: string; muted: string };
};

/**
 * One free tool's page: the hero and the client island under shared chalk
 * curves, the sum in numbered steps, what DUMA adds, the FAQ, the related
 * links and a closing card — with the WebApplication, breadcrumb and FAQ
 * schema. Server-rendered; only the tool itself is a client island.
 */
export function ToolPage({ path, description, features, curveId, hero, tool, how, inDuma, faqTitle, faqs, related = false, closing }: ToolPageProps) {
  const steps = (
    <ol className={how.aside ? 'flex flex-col gap-8' : 'mt-10 flex max-w-3xl flex-col gap-8'}>
      {how.steps.map((step, index) => (
        <li key={step.title} className="flex gap-4" data-reveal="" data-reveal-delay={index * 60}>
          <NumberDot n={index + 1} />
          <div className="min-w-0">
            <p className="text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">{step.title}</p>
            <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">{step.body}</p>
            {step.formula && (
              <p className="mt-3 inline-block rounded-md border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-3 py-1.5 font-mono text-sm text-foreground tabular-nums">
                {step.formula}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <JsonLd data={webApplicationSchema({ name: freeTool(path).name, path, description, features })} />
      <JsonLd
        data={breadcrumbSchema([
          { name: TOOLS_INDEX.name, path: TOOLS_INDEX.path },
          { name: freeTool(path).name, path },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      {/* The curves sit on a wrapper round the hero and the tool: the hero
          alone is too short, and clipped to it they were cut off mid-stroke. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id={`${curveId}-left`} className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id={`${curveId}-right`} className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <section className="relative px-4 pt-30 pb-6 sm:px-6 sm:pt-40">
          <div className="relative z-10 mx-auto w-full max-w-5xl">
            <ToolBreadcrumb path={path} />
            <HeroTitle lead={hero.lead} mark={hero.mark} />
            <p className="mt-6 max-w-[44rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">{hero.subtitle}</p>
            <HeroTicks ticks={hero.ticks} />
          </div>
        </section>

        {tool.headingId ? (
          <Section spacing="snug" aria-labelledby={tool.headingId}>
            <h2 id={tool.headingId} className="sr-only">
              {tool.label}
            </h2>
            {tool.node}
          </Section>
        ) : (
          <Section spacing="snug" aria-label={tool.label}>
            {tool.node}
          </Section>
        )}
      </div>

      <Section spacing="normal" aria-labelledby={how.id}>
        <SectionHeading id={how.id} title={how.title} muted={how.muted} intro={how.intro} />
        {how.aside ? (
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
            {steps}
            {how.aside}
          </div>
        ) : (
          steps
        )}
      </Section>

      {/* ── What DUMA adds to the tool ── */}
      <Section spacing="snug" aria-labelledby="in-duma">
        <SectionHeading id="in-duma" title={inDuma.title} muted="Free in DUMA." />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {inDuma.points.map((point, index) => (
            <FeatureCard key={point.title} icon={point.icon} tone={point.tone} title={point.title} body={point.body} delay={index * 60} />
          ))}
        </div>
      </Section>

      <FaqSection items={faqs} title={faqTitle} />

      {related && (
        <RelatedSection
          id="related"
          audiences={[...otherTools(path), { path: TOOLS_INDEX.path, label: 'Every free tool' }]}
          audiencesTitle="More free tools"
          terms={freeTool(path).terms}
        />
      )}

      <ClosingCta title={closing.title} muted={closing.muted} aside={<RisingLines id={`${curveId}-cta`} />} />
    </>
  );
}
