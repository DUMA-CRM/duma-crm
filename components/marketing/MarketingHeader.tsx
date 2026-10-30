import Link from 'next/link';

import { BookOpen, ChevronDown, Code, Menu, X } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { buttonVariants } from '@/components/ui/button';

import { SIGN_IN_PATH, SIGN_UP_CTA, SIGN_UP_PATH, headerNav } from '@/lib/marketing/site';

/**
 * The marketing site's top bar, after seline.com's: the mark on the left, and
 * on the right Pricing, About us, a Resources menu (Public API, Blog),
 * a hairline, sign in and the one button.
 *
 * A Server Component with no client JavaScript. Resources opens on hover and
 * on keyboard focus (CSS only); the mobile menu is a native <details>. Every
 * link is in the HTML a crawler reads. Links come from headerNav().
 */
export function MarketingHeader() {
  const { links, resources } = headerNav();
  const linkClass = 'text-[0.9375rem] text-[var(--mkt-ink-2)] transition-colors hover:text-foreground';
  // Resources and Sign in light up like the app's ghost button: a soft fill, the same 7px corners.
  const ghostClass = '-my-1.5 flex items-center gap-1 rounded-md px-3 py-1.5';
  const ghostFill = 'hover:bg-[color-mix(in_oklab,var(--mkt-ground)_92%,var(--ink))] focus-visible:bg-[color-mix(in_oklab,var(--mkt-ground)_92%,var(--ink))]';

  return (
    <header className="mkt-header sticky top-0 z-40 bg-[var(--mkt-ground)]/85 px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-6">
        <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="DUMA home">
          <Logo size={26} className="rounded-[19.4%]" />
          <span className="text-[1.0625rem] font-semibold tracking-display" aria-hidden="true">
            DUMA
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-7">
            {links.map((link) => (
              <li key={link.path}>
                <Link href={link.path} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}

            <li className="group relative">
              <button
                type="button"
                aria-haspopup="true"
                className={`${linkClass} ${ghostClass} group-focus-within:bg-[color-mix(in_oklab,var(--mkt-ground)_92%,var(--ink))] group-focus-within:text-foreground group-hover:bg-[color-mix(in_oklab,var(--mkt-ground)_92%,var(--ink))] group-hover:text-foreground`}
              >
                Resources
                <ChevronDown className="size-4 transition-transform group-focus-within:rotate-180 group-hover:rotate-180" aria-hidden="true" />
              </button>
              {/* The panel sits below a transparent bridge, so the pointer can travel to it without the menu closing. */}
              <div className="invisible absolute top-full right-0 z-50 pt-3 opacity-0 transition-[opacity,visibility] duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="w-[26rem] rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-card)] p-3 shadow-[0_20px_44px_-18px_rgb(32_55_45/0.3)]">
                  <p className="px-3 pt-1.5 pb-2 text-xs font-medium tracking-[0.08em] text-[var(--mkt-ink-3)] uppercase">Resources</p>
                  <ul className="flex flex-col">
                    {resources.map((item) => {
                      const Icon = item.icon === 'api' ? Code : BookOpen;
                      // Each resource wears a product tone: the API is reference blue, the blog is brand green.
                      const tone = item.icon === 'api' ? 'bg-reference/16 text-reference' : 'bg-primary/16 text-primary';
                      return (
                        <li key={item.path}>
                          <Link href={item.path} className="flex gap-3.5 rounded-md px-3 py-3 transition-colors hover:bg-[var(--mkt-ground)] focus-visible:bg-[var(--mkt-ground)]">
                            <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-md ${tone}`} aria-hidden="true">
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[1.0625rem] leading-snug font-medium text-foreground">{item.label}</span>
                              {item.description && <span className="mt-1 block text-[0.9375rem] leading-snug text-[var(--mkt-ink-2)]">{item.description}</span>}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <span className="mr-2 hidden h-5 w-px bg-[var(--mkt-line)] md:block" aria-hidden="true" />
          <Link href={SIGN_IN_PATH} className={`${linkClass} ${ghostClass} ${ghostFill} outline-none`}>
            Sign in
          </Link>
          <Link href={SIGN_UP_PATH} className={buttonVariants()}>
            {SIGN_UP_CTA}
          </Link>

          <details className="group md:hidden">
            <summary
              aria-label="Menu"
              className="grid size-9 cursor-pointer list-none place-items-center rounded-md hover:bg-[var(--mkt-line)] [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-5 group-open:hidden" aria-hidden="true" />
              <X className="hidden size-5 group-open:block" aria-hidden="true" />
            </summary>
            <nav aria-label="Main" className="absolute inset-x-0 top-16 border-b border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-4 pb-4 shadow-md">
              <ul className="flex flex-col">
                {[...links, ...resources].map((link) => (
                  <li key={link.path}>
                    <Link href={link.path} className="flex min-h-12 items-center border-b border-[var(--mkt-line)] text-base">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
