import Link from 'next/link';

import { ArrowUpRight } from '@/components/icons';
import { Section, SectionHeading } from '@/components/marketing/sections';

import { glossaryTerm } from '@/lib/marketing/glossary';
import { MODULES, publishedPage } from '@/lib/marketing/site';

/**
 * Whether a marketing path has a live page behind it. Only those are linked,
 * so a page that links ahead to one still being written never points at a 404:
 * the link simply appears the day that page is published in lib/marketing/site.ts.
 */
export function isLivePath(path: string): boolean {
  if (path.startsWith('/glossary/')) return glossaryTerm(path.slice('/glossary/'.length)) !== undefined;
  if (path.startsWith('/features/')) return MODULES.some((m) => m.published && `/features/${m.slug}` === path);
  return publishedPage(path) !== undefined;
}

/** "Related": descriptive links to the audience pages, glossary terms and sibling pages. */
export function RelatedLinks({ id, title = 'Related', links }: { id: string; title?: string; links: readonly { label: string; path: string; note?: string }[] }) {
  const live = links.filter((link) => isLivePath(link.path));
  if (live.length === 0) return null;
  return (
    <Section spacing="snug" aria-labelledby={id}>
      <SectionHeading id={id} title={title} />
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((link) => (
          <li key={link.path}>
            <Link href={link.path} className="mkt-card group flex h-full items-start justify-between gap-3 px-5 py-4 hover:border-primary/40">
              <span>
                <span className="block font-medium text-[var(--mkt-heading)] group-hover:text-primary">{link.label}</span>
                {link.note && <span className="mt-1 block text-sm text-[var(--mkt-ink-2)]">{link.note}</span>}
              </span>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
