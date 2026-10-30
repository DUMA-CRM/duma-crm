import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd } from '@/components/marketing/JsonLd';
import { ChalkCurve } from '@/components/marketing/Strokes';
import { Mark, SecondaryButton } from '@/components/marketing/sections';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { hasPublicFile } from '@/lib/marketing/public-file.server';
import { breadcrumbSchema } from '@/lib/marketing/schema';
import { linkTo } from '@/lib/marketing/site';

export const metadata: Metadata = marketingMetadata({
  title: 'About DUMA: Independent Business Software, Built in the Open',
  description:
    'DUMA is an independent, all-in-one business system for cafés, food businesses and small shops — built and supported by its founder, Marian Dudych. Hosted in the UK.',
  path: '/about',
});

/** Drop the founder's photo here and the card shows it; until then, initials. Square, at least 320×320. */
const FOUNDER_PHOTO = '/marketing/team/marian.jpg';

/**
 * /about, after seline.com/about-us: a centred headline and intro, the team
 * as cards in a grey tray, the story told in a narrow column, two tilted
 * pictures with a caption, and an invitation at the end. Every line is true of
 * DUMA today (see the "DUMA Business Profile" vault note) — no investors,
 * customer counts or founding dates are claimed because none are confirmed.
 */
export default function AboutPage() {
  const hasPhoto = hasPublicFile(FOUNDER_PHOTO);

  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: 'About', path: '/about' }])} />

      {/* Pulled up under the sticky header, like the home hero, so the chalk curves start at the very top and run on behind the story. */}
      <div className="relative -mt-16 overflow-hidden">
        <ChalkCurve side="left" id="about-left" className="pointer-events-none absolute top-0 -left-24 hidden w-[34rem] md:block" />
        <ChalkCurve side="right" id="about-right" className="pointer-events-none absolute top-56 -right-40 hidden w-[44rem] md:block" />

        <section className="relative px-4 pt-32 pb-16 sm:px-6 sm:pt-40">
          <div className="relative z-10 mx-auto max-w-2xl">
            <h1 className="text-center text-4xl leading-[1.1] font-semibold tracking-display text-[var(--mkt-heading)] sm:text-5xl">
              Independent, small, honest
            </h1>
            <p className="mx-auto mt-6 max-w-[40rem] text-center text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]">
              DUMA is an all-in-one system for cafés, food businesses and small shops, built and run independently by its founder, Marian
              Dudych. When you write to DUMA, <Mark>you talk to the person who builds it.</Mark>
            </p>

            {/* The team, as cards in a grey tray. */}
            <ul className="mx-auto mt-10 grid max-w-sm gap-2 rounded-xl bg-[color-mix(in_oklab,var(--mkt-ground)_93%,#000)] p-2">
              <li className="flex gap-4 rounded-lg p-2">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-[var(--brand-shell)]">
                  {hasPhoto ? (
                    <Image src={FOUNDER_PHOTO} alt="Marian Dudych" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span
                      className="grid size-full place-items-center text-2xl font-semibold tracking-display text-white"
                      aria-hidden="true"
                    >
                      MD
                    </span>
                  )}
                </div>
                <div className="min-w-0 py-1">
                  <p className="font-semibold">Marian Dudych</p>
                  <p className="text-sm text-[var(--mkt-ink-2)]">Founder</p>
                  <p className="mt-3 text-sm text-[var(--mkt-ink-3)]">Product, design and code</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* The story, in a narrow column. */}
        <section className="relative px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto flex max-w-2xl flex-col gap-5 text-pretty text-[1.0625rem] leading-relaxed text-[var(--mkt-ink-2)]">
            <p>
              Every small business runs on a pile of apps. A till here, a rota app there, spreadsheets for stock, another tool for email —
              and a separate bill for each. None of them talk to each other, so the owner spends the evening copying numbers from one to the
              next.
            </p>
            <p>
              It should be one place: one system where a sale updates the stock, the customer and the reports at the same moment, with one
              simple bill — or none at all.
            </p>

            {/* Two photographs, set down slightly askew, with a caption — after seline.com/about-us. */}
            <figure className="my-8">
              <div className="relative mx-auto flex max-w-xl items-start justify-center">
                <div className="relative z-10 aspect-[3/2] w-[56%] -rotate-[5deg] overflow-hidden rounded-lg shadow-[0_20px_40px_-16px_rgb(32_55_45/0.45)] transition-[rotate,translate,scale,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:scale-105 hover:rotate-0 hover:shadow-[0_28px_48px_-16px_rgb(32_55_45/0.5)]">
                  <Image
                    src="/marketing/london/london_1.webp"
                    alt="A laptop on a wooden table in a leafy café garden"
                    sizes="(min-width: 640px) 330px, 56vw"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="relative mt-8 -ml-8 aspect-[3/2] w-[54%] rotate-[3deg] overflow-hidden rounded-lg shadow-[0_20px_40px_-16px_rgb(32_55_45/0.45)] transition-[rotate,translate,scale,box-shadow] duration-300 ease-out hover:z-20 hover:-translate-y-1 hover:scale-105 hover:rotate-0 hover:shadow-[0_28px_48px_-16px_rgb(32_55_45/0.5)]">
                  <Image
                    src="/marketing/london/london_2.webp"
                    alt="The view along the Thames from Westminster Bridge, with people walking and a cyclist passing"
                    sizes="(min-width: 640px) 320px, 54vw"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
              <figcaption className="mt-5 text-center text-sm text-[var(--mkt-ink-2)]">Sketching out DUMA. London, Feb 2025.</figcaption>
            </figure>

            <p>
              So that is what DUMA is. The till, kitchen screen, stock and recipes, rotas, customers, marketing and reports live in one
              workspace, on the tablet, phone or laptop you already own and next to the card machine you already have. It runs from servers
              in the United Kingdom, and the till keeps taking orders when the internet doesn’t.
            </p>
            <p>
              The name comes from two places: from the founder’s own — <span className="text-foreground">DU</span>dych{' '}
              <span className="text-foreground">MA</span>
              rian — and from the Ukrainian word <Mark><em>дума</em></Mark>, a thought, a considered idea. That is how we try to build it: carefully, and
              around what businesses actually need rather than what makes a good feature list.
            </p>
            <p>
              We are at the start of the journey. If you run a café, a shop or anything in between,{' '}
              <Mark>we’ll help you set DUMA up, for free</Mark> — and we’d love to hear what it should do next. You can read what it costs
              on the{' '}
              <Link href={linkTo('/pricing')} className="text-primary hover:underline">
                pricing page
              </Link>
              .
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <SecondaryButton href={linkTo('/solutions/shops')}>DUMA for online stores</SecondaryButton>
              <SecondaryButton href={linkTo('/solutions/cafes')}>DUMA for cafés</SecondaryButton>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
