import Link from 'next/link';

import { ArrowUpRight } from '@/components/icons';
import { Section, SectionHeading } from '@/components/marketing/sections';

import { glossaryTerm } from '@/lib/marketing/glossary';
import { publishedPage } from '@/lib/marketing/site';

/**
 * Sideways links between the marketing pages: an audience page to the other
 * audiences, to the glossary terms it uses and to About, so each page is
 * reached from its neighbours and not only from the nav and the footer.
 *
 * Every link goes through publishedPage(), the registry's own guard, so a page
 * that is unpublished (or not built yet) drops out instead of becoming a 404.
 * Anchors are descriptive — "Bakery software, with recipe costing" — never "learn
 * more", because the anchor is what tells a search engine what the page is.
 */

export type RelatedLink = { path: string; label: string };

/** A link to a marketing page if it is published, otherwise its words as plain text. */
export function PageLink({ path, children }: { path: string; children: React.ReactNode }) {
  if (!publishedPage(path)) return <>{children}</>;
  return (
    <Link href={path} className="text-primary hover:underline">
      {children}
    </Link>
  );
}

function LinkList({ title, links }: { title: string; links: readonly RelatedLink[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-[0.06em] text-[var(--mkt-ink-3)] uppercase">{title}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.path}>
            <Link href={link.path} className="group inline-flex items-start gap-1.5 text-[0.9375rem] leading-snug font-medium text-[var(--mkt-heading)] hover:text-primary">
              <span>{link.label}</span>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[var(--mkt-ink-3)] group-hover:text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The "Related" block at the foot of an audience page: other businesses DUMA
 * runs, the terms the page leans on (by glossary slug), and the people behind
 * it. A column with nothing published in it is left out.
 */
export function RelatedSection({
  id,
  audiences,
  audiencesTitle = 'Other businesses on DUMA',
  terms = [],
  extra = [],
}: {
  id: string;
  audiences: readonly RelatedLink[];
  /** The first column's heading, for a page whose neighbours are not audiences — the other free tools, say. */
  audiencesTitle?: string;
  terms?: readonly string[];
  extra?: readonly RelatedLink[];
}) {
  const pages = audiences.filter((link) => publishedPage(link.path));
  const glossary = publishedPage('/glossary')
    ? terms.map(glossaryTerm).filter((term) => term !== undefined).map((term) => ({ path: `/glossary/${term.slug}`, label: term.title }))
    : [];
  const about = [...extra.filter((link) => publishedPage(link.path)), ...(publishedPage('/about') ? [{ path: '/about', label: 'Who builds DUMA, and why' }] : [])];

  const columns = [
    { title: audiencesTitle, links: pages },
    { title: 'Terms explained', links: glossary },
    { title: 'About DUMA', links: about },
  ].filter((column) => column.links.length > 0);
  if (columns.length === 0) return null;

  return (
    <Section spacing="snug" aria-labelledby={id}>
      <SectionHeading id={id} title="Related" muted="Where to look next." />
      <div className="mkt-card mt-8 grid gap-8 px-6 py-7 sm:px-8 md:grid-cols-3" data-reveal="">
        {columns.map((column) => (
          <LinkList key={column.title} title={column.title} links={column.links} />
        ))}
      </div>
    </Section>
  );
}
