'use client';

import Link from 'next/link';
import { useState } from 'react';

import { ArrowUpRight, ChevronDown, Search, X } from '@/components/icons';
import { Segmented } from '@/components/marketing/docs/Segmented';

import type { McpTool } from '@/lib/marketing/developers';
import { cn } from '@/lib/utils/cn';

type Kind = 'all' | 'read' | 'write' | 'delete';
const kindOf = (tool: McpTool): Exclude<Kind, 'all'> => (tool.destructive ? 'delete' : tool.writes ? 'write' : 'read');

const KINDS: { id: Kind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'read', label: 'Read' },
  { id: 'write', label: 'Write' },
  { id: 'delete', label: 'Delete' },
];

// Written out in full so Tailwind sees every class.
const KIND_DOT: Record<Exclude<Kind, 'all'>, string> = { read: 'bg-success', write: 'bg-stock', delete: 'bg-destructive' };
const KIND_TEXT: Record<Exclude<Kind, 'all'>, string> = { read: 'text-success', write: 'text-stock', delete: 'text-destructive' };

/**
 * The MCP tool directory: a search box and an action filter (the same
 * Segmented switch as the client picker), then every area in one card — folded until you
 * search or filter — with each tool as name, scope and action.
 */
export function McpTools({ groups }: { groups: { title: string; tools: McpTool[] }[] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matchesQuery = (group: string, tool: McpTool) => terms.every((term) => `${group} ${tool.name} ${tool.scope}`.toLowerCase().includes(term));
  const filtered = groups
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => (kind === 'all' || kindOf(tool) === kind) && matchesQuery(group.title, tool)),
    }))
    .filter((group) => group.tools.length);
  const count = filtered.reduce((total, group) => total + group.tools.length, 0);
  // Each action's count follows the search, so the filter says what it would show.
  const countOf = (id: Kind) =>
    groups.reduce((total, group) => total + group.tools.filter((tool) => (id === 'all' || kindOf(tool) === id) && matchesQuery(group.title, tool)).length, 0);
  const filtering = terms.length > 0 || kind !== 'all';
  const clear = () => {
    setQuery('');
    setKind('all');
  };

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="mkt-card flex min-h-11 flex-1 items-center gap-2 px-3 focus-within:ring-2 focus-within:ring-primary">
          <Search className="size-4 shrink-0 text-[var(--mkt-ink-2)]" aria-hidden="true" />
          <input
            aria-label="Search MCP tools"
            placeholder="Search tools, areas or scopes…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            className="w-full min-w-0 bg-transparent py-2.5 text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="grid size-6 shrink-0 place-items-center rounded-full text-[var(--mkt-ink-3)] hover:bg-[var(--mkt-line)] hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </label>
        <Segmented
          label="Filter tools by action"
          value={kind}
          onChange={setKind}
          options={KINDS.map((item) => ({
            id: item.id,
            label: (
              <>
                {item.id !== 'all' && <span className={cn('size-1.5 rounded-full', KIND_DOT[item.id])} aria-hidden="true" />}
                {item.label}
                <span className="text-xs text-[var(--mkt-ink-3)]">{countOf(item.id)}</span>
              </>
            ),
          }))}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[var(--mkt-ink-2)]">
        <p role="status">
          {count} {count === 1 ? 'tool' : 'tools'} in {filtered.length} {filtered.length === 1 ? 'area' : 'areas'}
        </p>
        {filtering && (
          <button type="button" onClick={clear} className="text-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {count === 0 ? (
        <div className="mkt-card mt-3 px-6 py-10 text-center">
          <p className="font-medium text-[var(--mkt-heading)]">No tools match</p>
          <p className="mt-1 text-sm text-[var(--mkt-ink-2)]">Try a name like “products” or a scope like “content:read”.</p>
          <button type="button" onClick={clear} className="mt-4 text-sm font-medium text-primary hover:underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mkt-card mt-3 divide-y divide-[var(--mkt-line)] overflow-hidden">
          {filtered.map((group) => (
            <details key={`${group.title}-${query}-${kind}`} open={filtering} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_oklab,var(--mkt-ground)_60%,var(--mkt-card))] [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 shrink-0 -rotate-90 text-primary transition-transform group-open:rotate-0" aria-hidden="true" />
                <span className="font-semibold text-[var(--mkt-heading)]">{group.title}</span>
                <span className="mkt-tag tabular-nums">{group.tools.length}</span>
                {/* A glance at what the area can do before it is opened. */}
                <span className="ml-auto hidden items-center gap-3 text-xs text-[var(--mkt-ink-3)] sm:flex">
                  {(['read', 'write', 'delete'] as const).map((id) => {
                    const n = group.tools.filter((tool) => kindOf(tool) === id).length;
                    return n ? (
                      <span key={id} className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 rounded-full', KIND_DOT[id])} aria-hidden="true" />
                        {n} {id}
                      </span>
                    ) : null;
                  })}
                </span>
              </summary>
              <ul className="border-t border-[var(--mkt-line)] bg-[color-mix(in_oklab,var(--mkt-ground)_45%,var(--mkt-card))]">
                {group.tools.map((tool) => {
                  const toolKind = kindOf(tool);
                  return (
                    <li
                      key={tool.name}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-t border-[var(--mkt-line)] px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_11rem_4.5rem] sm:pl-11"
                    >
                      {tool.slug ? (
                        <Link
                          href={`/developers/${tool.slug}`}
                          className="inline-flex min-w-0 items-center gap-1 font-mono text-[13px] text-foreground hover:text-primary hover:underline"
                        >
                          <span className="truncate">{tool.name}</span>
                          <ArrowUpRight className="size-3.5 shrink-0 text-[var(--mkt-ink-3)]" aria-hidden="true" />
                        </Link>
                      ) : (
                        <code className="truncate font-mono text-[13px]">{tool.name}</code>
                      )}
                      <span className="col-start-1 row-start-2 truncate font-mono text-xs text-[var(--mkt-ink-2)] sm:col-start-auto sm:row-start-auto">
                        {tool.scope}
                      </span>
                      <span
                        className={cn(
                          'row-span-2 flex items-center gap-1.5 justify-self-end text-xs font-medium capitalize sm:row-span-1',
                          KIND_TEXT[toolKind],
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', KIND_DOT[toolKind])} aria-hidden="true" />
                        {toolKind}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
