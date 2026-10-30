import Link from 'next/link';

import { MapPin } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';

import { PAGES, SIGN_IN_PATH, SIGN_UP_PATH, linkTo, modulePath, publishedModules, publishedPage } from '@/lib/marketing/site';

type FooterLink = { path: string; label: string };

/**
 * The marketing footer: the mark and the promise on the left, link columns on
 * the right, a quiet line underneath. Its groups are the site's internal-linking
 * backbone — every published page is reachable from every other in one hop —
 * so they list everything published. Empty groups are dropped. Audience and
 * pricing links follow linkTo(): the page once published, its home section until
 * then.
 */
export function MarketingFooter() {
  const features = publishedPage('/features');
  const pages = (paths: string[]): FooterLink[] => paths.flatMap((path) => PAGES.filter((p) => p.path === path && p.published));

  const groups: { title: string; links: FooterLink[] }[] = [
    {
      title: 'Product',
      links: [
        ...(features ? [{ path: features.path, label: features.label }] : []),
        ...publishedModules().map((m) => ({ path: modulePath(m.slug), label: m.name })),
        { path: linkTo('/pricing'), label: 'Pricing' },
        ...pages(['/developers', '/developers/mcp']),
      ],
    },
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
    {
      title: 'Account',
      links: [
        { path: SIGN_UP_PATH, label: 'Create a workspace' },
        { path: SIGN_IN_PATH, label: 'Sign in' },
      ],
    },
    { title: 'Company', links: pages(['/why-duma', '/blog', '/about', '/contact']) },
    { title: 'Legal', links: pages(['/privacy', '/terms']) },
  ].filter((group) => group.links.length > 0);

  return (
    <footer className="px-4 sm:px-6">
      {/* One column for the mark, then one per link group — however many groups are published. */}
      <div
        className="mx-auto grid w-full max-w-5xl gap-10 py-14 sm:grid-cols-2 lg:[grid-template-columns:var(--footer-cols)]"
        style={{ '--footer-cols': `minmax(0,1.5fr) repeat(${groups.length},minmax(0,1fr))` } as React.CSSProperties}
      >
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md" aria-label="DUMA home">
            <Logo size={24} className="rounded-[19.4%]" />
            <span className="text-base font-semibold tracking-display" aria-hidden="true">
              DUMA
            </span>
          </Link>
          <p className="mt-4 max-w-[26ch] text-[0.9375rem] text-[var(--mkt-ink-2)]">Run your whole business from one place, on one bill.</p>
        </div>

        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-[0.9375rem] font-semibold">{group.title}</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {group.links.map((link) => (
                <li key={link.path}>
                  <Link href={link.path} className="inline-flex min-h-8 items-center text-[0.9375rem] text-[var(--mkt-ink-2)] hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 pb-10 text-sm text-[var(--mkt-ink-3)]">
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          Hosted in the United Kingdom
        </p>
        <p>© {new Date().getFullYear()} DUMA</p>
      </div>
    </footer>
  );
}
