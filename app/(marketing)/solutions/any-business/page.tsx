import type { Metadata } from 'next';
import Link from 'next/link';

import { Mascot } from '@/components/ai/Mascot';
import { BookOpen, Check, ClipboardList, Code, Download, FileText, FolderOpen, Lock, NotebookPen, Users } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ContentEditorMock, FormMock, StorefrontApiMock } from '@/components/marketing/mocks';
import { PageLink, RelatedSection } from '@/components/marketing/RelatedLinks';
import { ClosingCta, FaqSection, FeatureCard, Mark, SecondaryButton, Section, SectionHeading, SignUpButton } from '@/components/marketing/sections';
import { ExplainerSection, SetupBand, UseCasesSection } from '@/components/marketing/solution';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { ANY_COMPARISON, ANY_FAQS, ANY_FEATURES, ANY_SETUP_STEPS, ANY_USE_CASES } from '@/lib/marketing/any-business';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, faqSchema, softwareApplicationSchema } from '@/lib/marketing/schema';
import { linkTo } from '@/lib/marketing/site';
import { AUDIENCE_LINKS } from '@/lib/marketing/solutions';

const DESCRIPTION =
  'Use one part of DUMA on its own: forms whose responses become customers, shared notes for your team, and an API and MCP server. Free to start, no card.';

export const metadata: Metadata = marketingMetadata({
  title: 'Form Builder, Team Notes and an API, Free to Start | DUMA',
  description: DESCRIPTION,
  path: '/solutions/any-business',
});

const USE_CASE_ICONS = [ClipboardList, Users, BookOpen, Code];
/** One per ANY_FEATURES entry, in order: forms, customers, close or cap, notes, Drive, API. */
const FEATURE_ICONS = [ClipboardList, Users, Lock, FolderOpen, Download, Code];
/** Form tool, notes app — DUMA's own entry shows the logo instead. */
const COMPARISON_ICONS = [ClipboardList, NotebookPen];

/**
 * /solutions/any-business — DUMA one part at a time, led by forms, notes and
 * the API. Blogging is /solutions/blogs' subject, so the content system is one
 * card here and links there. Same blocks as the other /solutions pages; every
 * claim is in lib/marketing/any-business.ts, which says what was checked.
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
              A form builder whose responses become customers, shared notes for your team, and an API and MCP server for your data. Each works on its own — and
              grows into the rest of DUMA when you’re ready.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <SignUpButton />
              <SecondaryButton href={linkTo('/pricing')}>See pricing</SecondaryButton>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-2)]">
              {['Free to start', 'No card needed', 'No website needed'].map((fact) => (
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
              <FormMock />
            </div>
            <figcaption className="mt-3 text-xs text-[var(--mkt-ink-2)]">An example waiting-list form, and the customer it becomes.</figcaption>
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
          <FeatureCard icon={ClipboardList} tone="orders" tag="no website needed" title="Forms" body="Build an enquiry, feedback or waiting-list form and share its link. Every response becomes a customer.">
            <FormMock />
          </FeatureCard>
          <FeatureCard
            icon={BookOpen}
            tone="team"
            tag="for teams"
            title="Notes"
            body="Checklists, how-tos and policies in private notes and shared folders — searchable, and synced one way to Google Drive if you use it."
            delay={80}
          />
          <FeatureCard icon={Code} tone="action" tag="for developers" title="API and MCP" body="Read and write your DUMA data from your own code with a scoped key, or from an AI assistant through the MCP server.">
            <StorefrontApiMock />
          </FeatureCard>
          <FeatureCard
            icon={FileText}
            tone="reference"
            tag="for websites"
            title="Content"
            body={
              <>
                A headless content system for the pages and posts on your own site. Writing a blog? See{' '}
                <PageLink path={AUDIENCE_LINKS.blogs.path}>DUMA’s content system for blogs and creators</PageLink>.
              </>
            }
            delay={80}
          >
            <ContentEditorMock />
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
          'A business collecting enquiries, a new place building a waiting list, a team that needs one handbook, a developer who wants the data in their own tools.',
          'Each starts with a single part, free — and adds customers, a till or a shop later without moving anything.',
        ]}
        items={ANY_USE_CASES}
        icons={USE_CASE_ICONS}
      />

      <ExplainerSection
        id="explainer"
        title="What forms, notes and an API should do for a small business"
        intro={
          <p>
            A form should put the person who filled it in on your customer list, not in a spreadsheet. Notes should be where the team already looks. And your data
            should be yours to reach from your own tools, with a key that can only do what you allow.
          </p>
        }
        setupTitle="How to start with one part of DUMA"
        steps={ANY_SETUP_STEPS}
        metricsTitle="What forms, notes and the API include"
        metrics={ANY_FEATURES}
        metricIcons={FEATURE_ICONS}
        comparisonTitle="A form tool, a notes app,"
        comparisonHighlight="or DUMA"
        comparisonLead="Three ways to collect enquiries and keep a team’s know-how. Here is what each one covers."
        comparison={ANY_COMPARISON}
        comparisonIcons={COMPARISON_ICONS}
      />

      <SetupBand id="any-setup" title="Start with one part, today." body="Sign up free, switch on what you need, and we’ll help you set it up." />

      <FaqSection items={ANY_FAQS} title="Questions people ask" />

      <RelatedSection
        id="any-related"
        audiences={[AUDIENCE_LINKS.blogs, AUDIENCE_LINKS.cafes, AUDIENCE_LINKS.shops]}
        extra={[
          { path: '/developers', label: 'The DUMA public API reference' },
          { path: '/developers/mcp', label: 'Connect an AI assistant through the MCP server' },
        ]}
      />

      <ClosingCta
        title="The one place for whatever you run."
        muted="Start with one part. Grow into the rest."
        body="Get started in minutes, completely free. No card required, and we’re here to help you every step of the way."
        aside={<RisingLines id="any-cta" />}
      />
    </>
  );
}
