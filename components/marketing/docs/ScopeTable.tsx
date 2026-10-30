'use client';

import { useState } from 'react';

import { Segmented } from '@/components/marketing/docs/Segmented';

type Filter = 'all' | 'publishable' | 'secret';

/**
 * Every scope a key can hold, filtered by the kind of key that may hold it —
 * the question a reader choosing a key is actually asking.
 */
export function ScopeTable({ scopes }: { scopes: { scope: string; detail: string; publishable: boolean }[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = scopes.filter((s) => filter === 'all' || (filter === 'publishable' ? s.publishable : !s.publishable));
  const count = (f: Filter) => scopes.filter((s) => f === 'all' || (f === 'publishable' ? s.publishable : !s.publishable)).length;
  const option = (id: Filter, label: string) => ({
    id,
    label: (
      <>
        {label}
        <span className="text-xs text-[var(--mkt-ink-3)]">{count(id)}</span>
      </>
    ),
  });

  return (
    <div className="mt-5">
      <Segmented
        label="Filter scopes by key"
        value={filter}
        onChange={setFilter}
        options={[option('all', 'All'), option('publishable', 'Publishable key'), option('secret', 'Secret key only')]}
      />
      <div className="mkt-card mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="bg-[color-mix(in_oklab,var(--mkt-ground)_70%,var(--mkt-card))] text-[11px] tracking-[0.06em] text-[var(--mkt-ink-3)] uppercase">
            <tr>
              <th className="px-4 py-2.5 font-medium">Scope</th>
              <th className="px-4 py-2.5 font-medium">Lets a key</th>
              <th className="px-4 py-2.5 font-medium">Key</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.scope} className="border-t border-[var(--mkt-line)] align-top">
                <td className="px-4 py-2.5 font-mono text-[0.8125rem] whitespace-nowrap text-foreground">{s.scope}</td>
                <td className="px-4 py-2.5 text-[var(--mkt-ink-2)]">{s.detail}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="mkt-tag">{s.publishable ? 'Either' : 'Secret'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
