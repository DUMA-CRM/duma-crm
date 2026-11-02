import type { Metadata } from 'next';
import Link from 'next/link';

import { ChevronRight } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { ClosingCta } from '@/components/marketing/sections';
import { ChalkCurve, RisingLines } from '@/components/marketing/Strokes';

import { GLOSSARY, glossaryByLetter } from '@/lib/marketing/glossary';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema, glossarySchema } from '@/lib/marketing/schema';

export const metadata: Metadata = marketingMetadata({
  title: 'Terms & Definitions for Cafés, Restaurants and Shops | DUMA',
  description:
    'Plain-English definitions of the numbers a UK café, restaurant or shop runs on: food cost, GP, prime cost, labour %, stocktakes and more, with examples.',
  path: '/glossary',
});

/**
 * /glossary — Terms & definitions, after seline.com/google-analytics-terms: a
 * left-aligned heading, then every term A–Z under its letter, in two plain
 * columns — the term with a chevron, and two lines of its definition.
 */
export default function GlossaryPage() {
  const groups = glossaryByLetter();

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'Terms & definitions', path: '/glossary' }])} />
      <JsonLd data={glossarySchema([...GLOSSARY])} />

      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="glossary-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="glossary-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />

        <section className="relative px-4 pt-28 pb-24 sm:px-6 sm:pt-36">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-display text-balance text-[var(--mkt-heading)] sm:text-5xl">
              Terms &amp; definitions
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-[var(--mkt-ink-2)]">
              The numbers a café, restaurant or shop runs on — what they mean, how to work them out, and what to do about them.
            </p>

            <div className="mt-12 flex flex-col gap-12" aria-label="Terms A to Z" role="list">
              {groups.map(({ letter, terms }) => (
                <section key={letter} id={`letter-${letter}`} aria-labelledby={`letter-${letter}-heading`} className="scroll-mt-24" role="listitem">
                  <h2 id={`letter-${letter}-heading`} className="text-sm font-semibold text-[var(--mkt-ink-3)]">
                    {letter}
                  </h2>
                  <ul className="mt-5 grid gap-x-10 gap-y-8 md:grid-cols-2">
                    {terms.map((term) => (
                      <li key={term.slug}>
                        <Link href={`/glossary/${term.slug}`} className="group block rounded-md">
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--mkt-heading)]">
                            <span className="group-hover:underline group-hover:underline-offset-4">{term.term}</span>
                            <ChevronRight
                              className="size-4 shrink-0 text-[var(--mkt-ink-3)] transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            />
                          </h3>
                          <p className="mt-2 line-clamp-2 text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">{term.short}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>

      <ClosingCta
        title="Every number here, worked out for you."
        muted="Free to start."
        body="DUMA costs your recipes, counts your stock and builds the reports — food cost, prime cost, labour and menu engineering — from the sales you are already taking."
        aside={<RisingLines id="glossary-cta" />}
      />
    </>
  );
}
