import type { Metadata } from 'next';
import Link from 'next/link';

import { Mascot } from '@/components/ai/Mascot';
import { BookOpen, Check, ClipboardList, Code, Copy, FileText, Globe, ImageIcon, Languages, Layers, Zap } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ContentEditorMock, FormMock, StorefrontApiMock } from '@/components/marketing/mocks';
import { ClosingCta, FaqSection, FeatureCard, Mark, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ExplainerSection, SetupBand, UseCasesSection } from '@/components/marketing/solution';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { ANY_COMPARISON, ANY_FAQS, ANY_SETUP_STEPS, ANY_USE_CASES, CMS_FEATURES } from '@/lib/marketing/any-business';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { linkTo } from '@/lib/marketing/site';

const DESCRIPTION =
  'Use just the part of DUMA you need: a headless content system for your blog or website, a form builder whose responses become customers, shared notes and an API. Free to start, no card needed.';

export const metadata: Metadata = marketingMetadata({
  title: 'Headless CMS, Form Builder and Notes — Use Just What You Need | DUMA',
  description: DESCRIPTION,
  path: '/solutions/any-business',
});

const USE_CASE_ICONS = [FileText, Globe, ClipboardList, BookOpen];
const CMS_ICONS = [Layers, Copy, Languages, ImageIcon, Zap, Code];
const COMPARISON_ICONS = [Globe, Code];

/**
 * /solutions/any-business — DUMA one part at a time, led by the content system
 * for a blog or website. Same blocks as the other /solutions pages; every claim
 * is in lib/marketing/any-business.ts, which says what was checked.
 */
export default function AnyBusinessPage() {
  return (
    <>
      <JsonLd data={softwareApplicationSchema({ description: DESCRIPTION })} />
      <JsonLd data={breadcrumbSchema([{ name: 'Any business', path: '/solutions/any-business' }])} />
      <JsonLd data={faqSchema(ANY_FAQS)} />

      {/* ── Hero ── */}
      <section className="relative -mt-16 overflow-hidden px-4 pt-30 pb-10 sm:px-6 sm:pt-40">
        <ChalkCurve side="left" id="any-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="any-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />
        <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
          <div>
            <h1 className="text-[2.6rem] leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-6xl">
              Use just the part <span className="mkt-mark mkt-mark-green rounded-md px-2">you need</span>
            </h1>
            <p className="mt-6 max-w-[38rem] text-balance text-lg leading-relaxed text-[var(--mkt-ink-2)] sm:text-xl">
              A content system for your blog or website, a form builder, shared notes and an API. Each works on its own — and grows into the rest of DUMA when
              you’re ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free to start', 'No card needed', 'Your own storage'].map((fact) => (
                <span key={fact} className="flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" />
                  {fact}
                </span>
              ))}
            </p>
          </div>
          <figure className="relative" data-reveal="">
            <div className="pointer-events-none absolute -top-16 right-6 hidden sm:block" aria-hidden="true">
              <Mascot size={96} state="idle" expression="attentif" gesture="wave" gestureKey="any" follow />
            </div>
            <div className="relative">
              <ContentEditorMock bleed={false} />
            </div>
            <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">An example blog post in the DUMA content editor.</figcaption>
          </figure>
        </div>
      </section>

      {/* ── The parts ── */}
      <Section spacing="roomy" aria-labelledby="parts">
        <SectionHeading
          id="parts"
          title="Start with one part."
          muted="Add the rest whenever you like."
          intro={
            <p>
              Every part of DUMA works on its own. Switch on the one you need today, and <Mark>nothing has to move</Mark> when you add the next.
            </p>
          }
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <FeatureCard
            icon={FileText}
            tone="reference"
            tag="for blogs and websites"
            title="Content"
            body="A headless content system: write posts and pages in DUMA, in every language you need, and publish them to your own site."
          >
            <ContentEditorMock />
          </FeatureCard>
          <FeatureCard icon={ClipboardList} tone="orders" tag="no website needed" title="Forms" body="Build an enquiry, feedback or waiting-list form and share its link. Every response becomes a customer." delay={80}>
            <FormMock />
          </FeatureCard>
          <FeatureCard
            icon={BookOpen}
            tone="team"
            tag="for teams"
            title="Notes"
            body="Recipes, checklists, how-tos and policies in private notes and shared folders — searchable, and synced one way to Google Docs if you use them."
          />
          <FeatureCard icon={Code} tone="action" tag="for developers" title="API and MCP" body="Read and write your DUMA data from your own code, or from an AI assistant through the MCP server." delay={80}>
            <StorefrontApiMock />
          </FeatureCard>
        </div>
        <p className="mt-6 text-sm text-[var(--mkt-ink-2)]">
          Need more later? The till, stock, customers, rotas and the rest are{' '}
          <Link href="/" className="text-primary hover:underline">
            in the same workspace
          </Link>
          .
        </p>
      </Section>

      <UseCasesSection
        id="uses"
        title="Four ways people use one part of DUMA"
        lead={[
          'A writer with a blog, a small studio with a website, a business collecting enquiries, a team that needs one handbook.',
          'Each starts with a single part, free — and adds customers, a till or a shop later without moving anything.',
        ]}
        items={ANY_USE_CASES}
        icons={USE_CASE_ICONS}
      />

      <ExplainerSection
        id="explainer"
        title="What a content system should do, and how to start a blog on DUMA"
        intro={
          <p>
            A content system should let you write once and publish anywhere: your site, in your design, in every language you need, with your images in storage you
            control. And it shouldn’t trap you — your content should leave with you whenever you want.
          </p>
        }
        setupTitle="How to start a blog on DUMA"
        steps={ANY_SETUP_STEPS}
        metricsTitle="What the content system includes"
        metrics={CMS_FEATURES}
        metricIcons={CMS_ICONS}
        comparisonTitle="A blog platform, a headless CMS,"
        comparisonHighlight="or DUMA"
        comparisonLead="Three ways to run a blog or a website’s content. Here is what each one covers."
        comparison={ANY_COMPARISON}
        comparisonIcons={COMPARISON_ICONS}
      />

      <SetupBand id="any-setup" title="Start with one part, today." body="Sign up free, switch on what you need, and we’ll help you set it up." />

      <FaqSection items={ANY_FAQS} title="Questions people ask" />

      <ClosingCta
        title="The one place for whatever you run."
        muted="Start with one part. Grow into the rest."
        body="Get started in minutes, completely free. No card required, and we’re here to help you every step of the way."
        aside={<RisingLines id="any-cta" />}
      />
    </>
  );
}
