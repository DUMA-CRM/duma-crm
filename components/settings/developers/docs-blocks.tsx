'use client';

import { useEffect, useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { Info, Lock } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Tooltip } from '@/components/shared/Tooltip';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { type ApiEndpoint, SCOPES, kindAllows } from '@/lib/developers/api-reference';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

// The building blocks of the API reference: code, tables, asides, sections.

export const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

/** A section's DOM id. One prefix for the page, so a copied link lands on the right heading. */
export const anchor = (id: string) => `api-${id}`;

/** A copy button that confirms in place for a moment. */
export function DocCopyButton({
  text,
  label,
  variant = 'ghost',
  className,
  children,
}: {
  text: string;
  label: string;
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant={variant}
      size={children ? 'sm' : 'icon-sm'}
      className={cn(!children && 'text-muted-foreground', className)}
      aria-label={children ? undefined : `Copy ${label}`}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) setCopied(true);
        else toast('error', 'Copy failed — select the text instead.');
      }}
    >
      <CopyGlyph copied={copied} className={children ? 'size-3.5' : 'size-4'} />
      {children && (copied ? 'Copied' : children)}
    </Button>
  );
}

/** Code with its name and a copy button; several snippets of the same thing become tabs. */
export function CodeBlock({ tabs }: { tabs: Array<{ label: string; code: string; language?: string }> }) {
  const [index, setIndex] = useState(0);
  const current = tabs[Math.min(index, tabs.length - 1)]!;
  return (
    <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">
      <div className="flex items-center gap-1 border-b border-rule/50 py-1 pl-1.5 pr-1">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto" role={tabs.length > 1 ? 'tablist' : undefined}>
          {tabs.map((tab, tabIndex) =>
            tabs.length > 1 ? (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={tabIndex === index}
                onClick={() => setIndex(tabIndex)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                  tabIndex === index ? 'bg-band text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ) : (
              <span key={tab.label} className="truncate px-2 text-xs font-semibold text-muted-foreground">
                {tab.label}
              </span>
            ),
          )}
        </div>
        {current.language && (
          <span className="shrink-0 px-1.5 font-mono text-[0.6875rem] text-muted-foreground/80">{current.language}</span>
        )}
        <DocCopyButton text={current.code} label={current.label} />
      </div>
      <pre className="max-h-[28rem] overflow-auto bg-background/40 p-4 font-mono text-xs leading-5 text-foreground">{current.code}</pre>
    </div>
  );
}

export function DocTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule/60 bg-control">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-rule/50 text-xs text-muted-foreground">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-4 py-2.5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/40 align-top">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td
                  key={column}
                  className="px-4 py-2.5 leading-relaxed text-muted-foreground first:whitespace-nowrap first:text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-sm bg-band/70 px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>
);

/** A short aside: a rule worth remembering, set apart from the reference around it. */
export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed',
        tone === 'warning' ? 'border-measured/35 bg-measured/6 text-foreground' : 'border-rule/50 bg-band/35 text-muted-foreground',
      )}
    >
      <Info
        size={15}
        className={cn('mt-0.5 shrink-0', tone === 'warning' ? 'text-measured' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** One part of the reference, in the same porcelain section as the rest of Settings, with an anchor the contents rail scrolls to. */
export function DocSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SettingsSection id={anchor(id)} title={title} description={lead} descriptionClassName="max-w-[72ch]">
      <div className="space-y-4">{children}</div>
    </SettingsSection>
  );
}

export function MethodBadge({ method }: { method: ApiEndpoint['method'] }) {
  return (
    <span
      className={cn(
        'w-12 shrink-0 rounded-sm px-1.5 py-0.5 text-center font-mono text-[0.6875rem] font-semibold',
        method === 'GET' ? 'bg-reference/12 text-reference' : 'bg-momentum/12 text-momentum',
      )}
    >
      {method}
    </span>
  );
}

/** An API's endpoints, straight from the registry: method, path, what it returns, and the scope it needs. */
export function EndpointList({ base, endpoints }: { base: string; endpoints: readonly ApiEndpoint[] }) {
  return (
    <ul className="divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-control">
      {endpoints.map((endpoint) => {
        const secretOnly = endpoint.scope ? !kindAllows('publishable', endpoint.scope) : false;
        return (
          <li key={endpoint.method + endpoint.path} className="group flex items-center gap-3 px-3.5 py-2.5">
            <MethodBadge method={endpoint.method} />
            <span className="min-w-0 flex-1">
              <code className="block truncate font-mono text-xs font-medium text-foreground">{endpoint.path}</code>
              <span className="block truncate text-xs text-muted-foreground">{endpoint.summary}</span>
            </span>
            <span className="hidden shrink-0 font-mono text-[0.6875rem] text-muted-foreground sm:block">{endpoint.scope ?? 'no key'}</span>
            {secretOnly && (
              <Tooltip side="top" align="end" label={`Secret key, from your server — ${SCOPES[endpoint.scope!].label.toLowerCase()}`}>
                <Lock size={13} className="shrink-0 text-muted-foreground" aria-label="Secret key only" />
              </Tooltip>
            )}
            <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <DocCopyButton text={`${base}${endpoint.path}`} label={`${endpoint.path} URL`} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
