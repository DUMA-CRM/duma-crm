import Link from 'next/link';

import { Menu } from '@/components/icons';
import { JsonLd } from '@/components/marketing/JsonLd';
import { DocsSidebar } from '@/components/marketing/docs/DocsSidebar';
import { Logo } from '@/components/shared/Logo';

import { docsNav } from '@/lib/marketing/developers';
import { organizationSchema, websiteSchema } from '@/lib/marketing/schema';

import '../../(marketing)/marketing.css';

/**
 * The developer docs frame, after seline.com/api: no marketing header or
 * footer — a fixed sidebar of guides and endpoints, and the page beside it.
 * Same .mkt material as the marketing site; public through MARKETING_PATHS
 * ('/developers') in lib/utils/public-paths.ts.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const nav = docsNav();

  return (
    <div className="mkt min-h-dvh">
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />

      {/* Phones: a top bar with the sidebar in a native menu. */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--mkt-line)] bg-[var(--mkt-ground)]/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="DUMA home">
          <Logo size={24} className="rounded-[19.4%]" />
          <span className="font-semibold tracking-display">DUMA</span>
          <span className="text-[var(--mkt-ink-3)]">/ API</span>
        </Link>
        <details className="group">
          <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-md hover:bg-[var(--mkt-line)] [&::-webkit-details-marker]:hidden" aria-label="Menu">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <div className="absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-[var(--mkt-line)] bg-[var(--mkt-ground)] px-5 py-6 shadow-md">
            <DocsSidebar nav={nav} />
          </div>
        </details>
      </header>

      <div className="mx-auto flex w-full max-w-[90rem]">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto px-7 py-8 lg:block">
          <DocsSidebar nav={nav} />
        </aside>
        <main id="main" className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
