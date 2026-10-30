'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ChevronDown, FileText, Search, Settings, ShoppingBag } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';

import type { DocsNavSection } from '@/lib/marketing/developers';
import { cn } from '@/lib/utils/cn';

const METHOD_TONE: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-reference',
  PUT: 'text-stock',
  PATCH: 'text-stock',
  DELETE: 'text-destructive',
};

/** A method label in its colour — GET green, POST periwinkle, PUT/PATCH amber, DELETE red. */
export function MethodLabel({ method, className }: { method: string; className?: string }) {
  return (
    <span className={cn('font-mono text-[10px] font-semibold tracking-wide', METHOD_TONE[method] ?? 'text-[var(--mkt-ink-2)]', className)}>
      {method}
    </span>
  );
}

/**
 * The docs sidebar, after seline.com/api: the mark, the guides, then every
 * endpoint under small grey group titles. The page you're on is highlighted;
 * the long management groups fold away unless they hold it.
 */
export function DocsSidebar({ nav }: { nav: DocsNavSection[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = nav
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((group) => ({
          ...group,
          links: group.links.filter((link) =>
            terms.every((term) =>
              `${group.title ?? ''} ${link.label} ${link.method ?? ''} ${link.path ?? ''}`.toLowerCase().includes(term),
            ),
          ),
        }))
        .filter((group) => group.links.length),
    }))
    .filter((section) => section.groups.length);
  const closeMobileMenu = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.currentTarget.closest('header')?.querySelector('details')?.removeAttribute('open');
  };

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-7 text-[0.9375rem]">
      <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="DUMA home">
        <Logo size={26} className="rounded-[19.4%]" />
        <span className="font-semibold tracking-display">DUMA</span>
        <span className="text-[var(--mkt-ink-3)]">/ API</span>
      </Link>

      <div className="space-y-2">
        <label className="flex items-center gap-2 rounded-lg border border-[var(--mkt-line)] bg-[var(--mkt-card)] px-2.5 focus-within:ring-2 focus-within:ring-primary">
          <Search className="size-4 shrink-0 text-[var(--mkt-ink-2)]" aria-hidden="true" />
          <input
            aria-label="Search API documentation"
            placeholder="Find an endpoint…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            className="min-w-0 w-full bg-transparent py-2.5 text-xs outline-none"
          />
        </label>
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-xs text-primary hover:underline">
            Clear search
          </button>
        )}
        <p role="status" className="text-xs text-[var(--mkt-ink-2)]">
          {terms.length
            ? `${filtered.reduce((n, section) => n + section.groups.reduce((total, group) => total + group.links.length, 0), 0)} results`
            : 'Guides, endpoints and examples'}
        </p>
      </div>
      {filtered.length === 0 && <p className="text-sm text-[var(--mkt-ink-2)]">No matches. Try a resource, HTTP method or path.</p>}
      {filtered.map((section) => (
        <div key={section.title}>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--mkt-ink-3)] uppercase">{section.title}</p>
          <div className="mt-2 flex flex-col gap-4">
            {section.groups.map((group, index) => {
              const holdsCurrent = group.links.some((link) => link.href === pathname);
              const links = (
                <ul className="flex flex-col">
                  {group.links.map((link) => {
                    const current = link.href === pathname;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={closeMobileMenu}
                          aria-current={current ? 'page' : undefined}
                          className={cn(
                            'flex items-baseline gap-2 rounded-md px-2 py-1.5 transition-colors',
                            current ? 'bg-primary/10 font-medium text-primary' : 'text-[var(--mkt-ink-2)] hover:text-foreground',
                          )}
                        >
                          {link.method && <MethodLabel method={link.method} className="w-9 shrink-0" />}
                          <span className="min-w-0 leading-snug">{link.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              );
              if (!group.title) return <div key={index}>{links}</div>;
              const Icon = group.title.includes('Store') ? ShoppingBag : group.title.includes('Content') ? FileText : Settings;
              return (
                <details
                  key={`${group.title}-${pathname}-${terms.join(' ')}`}
                  open={holdsCurrent || terms.length > 0}
                  className="group/manage"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] text-[var(--mkt-ink-2)] hover:text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{group.title}</span>
                      <span className="text-[10px] tabular-nums">{group.links.length}</span>
                    </span>
                    <ChevronDown className="size-3.5 transition-transform group-open/manage:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="mt-1">{links}</div>
                </details>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
