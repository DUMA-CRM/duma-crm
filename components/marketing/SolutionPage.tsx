import type { Metadata } from 'next';

import { Mascot } from '@/components/ai/Mascot';
import { Check, ClipboardList, LayoutDashboard, Receipt, Users } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { CustomersScreen, OrdersScreen } from '@/components/marketing/mocks';
import { ProductTabs } from '@/components/marketing/ProductTabs';
import { ReviewTicker } from '@/components/marketing/ReviewTicker';
import { Screenshot } from '@/components/marketing/Screenshot';
import { ClosingCta, FaqSection, FeatureCard, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ExplainerSection, MistakesSection, SetupBand, UseCasesSection } from '@/components/marketing/solution';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { reviewsToShow } from '@/lib/marketing/reviews';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { hasScreenshot } from '@/lib/marketing/screenshots.server';
import { linkTo } from '@/lib/marketing/site';
import type { ComparisonOption, ListItem } from '@/lib/marketing/solutions';
import type { Tone } from '@/lib/marketing/home';

type IconType = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;

export type HeroTab = 'pos' | 'dashboard' | 'orders' | 'customers';

export type SolutionContent = {
  path: `/solutions/${string}`;
  breadcrumb: string;
  metaTitle: string;
  description: string;
  hero: {
    lead: string;
    mark: string;
    subtitle: string;
    ticks: [string, string, string];
    /** The product tabs, in order — or `visual` for a single picture beside the text. */
    tabs?: HeroTab[];
    visual?: { node: React.ReactNode; caption: string };
  };
  teaser?: { title: string; intro: React.ReactNode; visual: React.ReactNode; caption: string };
  mistakes: { title: string; items: readonly ListItem[] };
  how: {
    title: string;
    intro: React.ReactNode;
    cards: readonly { icon: IconType; tone: Tone; tag: string; title: string; body: string; visual?: React.ReactNode }[];
  };
  useCases: { title: string; lead: [string, string]; items: readonly ListItem[]; icons: readonly IconType[] };
  explainer: {
    title: string;
    intro: React.ReactNode;
    setupTitle: string;
    steps: readonly ListItem[];
    metricsTitle: string;
    metrics: readonly ListItem[];
    metricIcons: readonly IconType[];
    comparisonTitle: string;
    comparisonHighlight: string;
    comparisonLead: string;
    comparison: readonly ComparisonOption[];
    comparisonIcons: readonly IconType[];
  };
  setupBand: { title: string; body: string };
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  closing: { title: string; muted: string; body: string };
};

export function solutionMetadata(content: SolutionContent): Metadata {
  return marketingMetadata({ title: content.metaTitle, description: content.description, path: content.path });
}

/** A screenshot inside the hero's tab frame: the frame already draws the edge. */
const FRAMELESS = 'rounded-none border-0 shadow-none';

const TAB = {
  pos: { label: 'POS', icon: <Receipt /> },
  dashboard: { label: 'Dashboard', icon: <LayoutDashboard /> },
  orders: { label: 'Orders', icon: <ClipboardList /> },
  customers: { label: 'Customers', icon: <Users /> },
} as const;

function tabPanel(tab: HeroTab, preload: boolean) {
  if (tab === 'pos' || tab === 'dashboard') return <Screenshot shot={tab} preload={preload} className={FRAMELESS} />;
  if (hasScreenshot(tab)) return <Screenshot shot={tab} preload={preload} className={FRAMELESS} />;
  return tab === 'orders' ? <OrdersScreen /> : <CustomersScreen />;
}

/**
 * One /solutions page from its content, after seline.com/for-ecommerce: hero
 * (product tabs or a single picture), optional teaser, costly habits, tagged
 * feature cards, use cases, the explainer, the setup band, FAQ and closing
 * card. Every audience page is a SolutionContent object and this.
 */
export function SolutionPage({ content }: { content: SolutionContent }) {
  const { hero } = content;
  const key = content.path.split('/').pop()!;

  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: content.description })} />
      <JsonLd data={breadcrumbSchema([{ name: content.breadcrumb, path: content.path }])} />
      <JsonLd data={faqSchema(content.faqs)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id={`${key}-left`} className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id={`${key}-right`} className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className={hero.visual ? 'relative z-10 mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14' : 'relative z-10 mx-auto w-full max-w-5xl'}>
          <div>
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

          {hero.visual ? (
            <figure className="relative" data-reveal="">
              <div className="pointer-events-none absolute -top-16 right-6 hidden sm:block" aria-hidden="true">
                <Mascot size={96} state="idle" expression="attentif" gesture="wave" gestureKey={key} follow />
              </div>
              <div className="relative">{hero.visual.node}</div>
              <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">{hero.visual.caption}</figcaption>
            </figure>
          ) : (
            <div className="mt-16 sm:mt-20">
              <ProductTabs tabs={(hero.tabs ?? ['pos', 'dashboard', 'orders', 'customers']).map((tab, index) => ({ id: tab, ...TAB[tab], panel: tabPanel(tab, index === 0) }))}>
                <div className="absolute -top-10 right-48 left-1 hidden sm:block">
                  <ReviewTicker reviews={reviewsToShow()} />
                </div>
                <div className="pointer-events-none absolute -top-20 right-10 hidden sm:block" aria-hidden="true">
                  <Mascot size={120} state="idle" expression="attentif" gesture="wave" gestureKey={key} follow />
                </div>
              </ProductTabs>
            </div>
          )}
        </div>
      </section>

      {/* ── Teaser ── */}
      {content.teaser && (
        <Section spacing="normal" aria-labelledby={`${key}-teaser`}>
          <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
            <div>
              <SectionHeading id={`${key}-teaser`} title={content.teaser.title} intro={content.teaser.intro} />
              <div className="mt-8 flex flex-wrap gap-3">
                <SignUpButton />
                <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
              </div>
            </div>
            <figure data-reveal="">
              {content.teaser.visual}
              <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">{content.teaser.caption}</figcaption>
            </figure>
          </div>
        </Section>
      )}

      <MistakesSection id={`${key}-mistakes`} title={content.mistakes.title} items={content.mistakes.items} />

      {/* ── How DUMA runs it ── */}
      <Section spacing="roomy" aria-labelledby={`${key}-how`}>
        <SectionHeading id={`${key}-how`} title={content.how.title} intro={content.how.intro} />
        <p className="mt-8 text-sm text-[var(--mkt-ink-2)]">
          * <span className="mkt-tag mx-1">free in full</span> means it stays free with no limits. The names and figures in these cards are examples.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {content.how.cards.map((card, index) => (
            <FeatureCard key={card.title} icon={card.icon} tone={card.tone} tag={card.tag} title={card.title} body={card.body} delay={(index % 2) * 80}>
              {card.visual}
            </FeatureCard>
          ))}
        </div>
      </Section>

      <UseCasesSection id={`${key}-uses`} title={content.useCases.title} lead={content.useCases.lead} items={content.useCases.items} icons={content.useCases.icons} />

      <ExplainerSection id={`${key}-explainer`} {...content.explainer} />

      <SetupBand id={`${key}-setup`} title={content.setupBand.title} body={content.setupBand.body} />

      <FaqSection items={content.faqs} title={content.faqTitle} />

      <ClosingCta title={content.closing.title} muted={content.closing.muted} body={content.closing.body} aside={<RisingLines id={`${key}-cta`} />} />
    </>
  );
}
