import Link from 'next/link';

import { Github, Linkedin, MapPin, XLogo } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';

import { CONTACT_EMAIL, FOUNDER_PROFILES, PAGES, STATUS_URL, linkTo, publishedPage } from '@/lib/marketing/site';

/** `status` puts the status page's green dot before the label; `external` opens the link in a new tab. */
type FooterLink = { path: string; label: string; status?: boolean; external?: boolean };
type FooterGroup = { title: string; links: FooterLink[] };

const NETWORK_ICON = { github: Github, x: XLogo, linkedin: Linkedin } as const;

/**
 * The marketing footer, after seline.com's: the mark and the promise in a wide
 * first column, then four columns that each stack one or two link groups, and
 * a quiet line underneath. Its groups are the site's internal-linking backbone
 * — every published page is reachable from every other in one hop — so they
 * list everything published — except the module pages, which are one hop
 * down from All features; an empty group, and then an empty column, is
 * dropped. Audience and pricing links follow linkTo(): the page once
 * published, its home section until then.
 */
export function MarketingFooter() {
  const features = publishedPage('/features');
  const pages = (paths: string[]): FooterLink[] => paths.flatMap((path) => PAGES.filter((p) => p.path === path && p.published));

  const columns: FooterGroup[][] = [
    [
      {
        title: 'Product',
        links: [
          ...(features ? [{ path: features.path, label: features.label }] : []),
          { path: linkTo('/pricing'), label: 'Pricing' },
          ...pages(['/developers', '/developers/mcp', '/developers/webhooks']),
          { path: STATUS_URL, label: 'Status page', status: true, external: true },
        ],
      },
      { title: 'Contact us', links: [{ path: `mailto:${CONTACT_EMAIL}`, label: 'Email' }] },
    ],
    [
      { title: 'Company', links: pages(['/about', '/why-duma', '/contact']) },
      {
        title: 'DUMA for',
        links: [
          { path: linkTo('/solutions/cafes'), label: 'Cafés and restaurants' },
          { path: '/solutions/bars', label: 'Bars and pubs' },
          { path: '/solutions/bakeries', label: 'Bakeries' },
          { path: linkTo('/solutions/shops'), label: 'Shops and online stores' },
          { path: '/solutions/retail', label: 'Retail' },
          { path: '/solutions/blogs', label: 'Blogs and creators' },
          { path: '/solutions/any-business', label: 'Any business' },
        ],
      },
    ],
    [
      { title: 'Resources', links: pages(['/blog', '/glossary']) },
      // Every published tool, so a new one is in the footer the day it ships.
      { title: 'Tools', links: PAGES.filter((p) => p.published && (p.path === '/tools' || p.path.startsWith('/tools/'))) },
      // Every published comparison, so a new one is in the footer the day it ships.
      { title: 'Compare', links: PAGES.filter((p) => p.published && p.path.startsWith('/compare/')) },
    ],
    [
      { title: 'Legal', links: pages(['/terms', '/privacy', '/dpa', '/gdpr', '/legal', '/data-deletion']) },
    ],
  ]
    .map((column) => column.filter((group) => group.links.length > 0))
    .filter((column) => column.length > 0);

  return (
    <footer className="px-4 sm:px-6">
      {/*
        A fixed column for the mark, then one per stack of groups — however many
        are published — each as wide as its longest link, spread so the last one
        ends on the right edge, in line with the copyright below.
      */}
      <div
        className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-8 gap-y-10 pt-16 pb-20 lg:justify-between lg:[grid-template-columns:var(--footer-cols)]"
        style={{ '--footer-cols': `15rem repeat(${columns.length},max-content)` } as React.CSSProperties}
      >
        <div className="col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md" aria-label="DUMA home">
            <Logo size={26} className="rounded-[19.4%]" />
            <span className="text-lg font-semibold tracking-display" aria-hidden="true">
              DUMA
            </span>
          </Link>
          <p className="mt-4 max-w-[28ch] text-pretty text-[0.9375rem] leading-relaxed text-[var(--mkt-ink-2)]">
            Run your whole business from one place.
          </p>
          <ul className="mt-4 -ml-2 flex items-center gap-0.5" aria-label="Find the founder on">
            {FOUNDER_PROFILES.map((profile) => {
              const Icon = NETWORK_ICON[profile.network];
              return (
                <li key={profile.network}>
                  <a
                    href={profile.url}
                    rel="me noopener"
                    target="_blank"
                    aria-label={profile.label}
                    className="grid size-8 place-items-center rounded-md text-[var(--mkt-ink-3)] transition-colors hover:text-[var(--mkt-heading)]"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        {columns.map((column) => (
          <div key={column[0]!.title} className="flex flex-col gap-9">
            {column.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-[0.9375rem] font-semibold text-[var(--mkt-heading)]">{group.title}</h2>
                <ul className="mt-3 flex flex-col gap-0.5">
                  {group.links.map((link) => (
                    <li key={link.path}>
                      <Link
                        href={link.path}
                        {...(link.external && { target: '_blank', rel: 'noopener' })}
                        className="inline-flex min-h-8 items-center gap-2 text-[0.9375rem] leading-snug text-[var(--mkt-ink-2)] transition-colors hover:text-[var(--mkt-heading)]"
                      >
                        {link.status && (
                          // The status-page convention, not the brand: a bright "all systems go" green, with a
                          // ping ring like a live signal. Still for anyone who asked for reduced motion.
                          <span className="relative grid size-2 shrink-0 place-items-center" aria-hidden="true">
                            <span className="absolute inset-0 animate-ping rounded-full bg-[#34c759] opacity-60 motion-reduce:hidden" />
                            <span className="relative size-2 rounded-full bg-[#34c759] shadow-[0_0_0_3px_rgb(52_199_89/0.22)]" />
                          </span>
                        )}
                        {link.label}
                        {link.external && <span className="sr-only"> (opens in a new tab)</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 pb-10 text-sm text-[var(--mkt-ink-3)]">
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          Hosted in the United Kingdom
        </p>
        <p>© DUMA, {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
