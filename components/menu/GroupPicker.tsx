'use client';

import { useState } from 'react';

import { Check, Search } from '@/components/icons';
import { inputClass } from '@/components/menu/shared';

import { cn } from '@/lib/utils/cn';
import { matchesSearch } from '@/lib/utils/menu-editor';

/**
 * A modifier group picker: every group by its full name, wrapping rather than
 * cut to "H… T…", with a search once the list is long. A radio group, so the
 * arrow keys aren't needed — each choice is its own button.
 */
export function GroupPicker({
  groups,
  value,
  onChange,
  label = 'Group',
}: {
  groups: { id: string; name: string; isSize?: boolean }[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const [query, setQuery] = useState('');
  const shown = groups.filter((group) => matchesSearch(group.name, query));
  return (
    <div className="space-y-2">
      {groups.length > 8 && (
        <label className="relative block">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
            placeholder="Search groups"
            aria-label="Search groups"
            className={cn(inputClass, 'pl-8')}
          />
        </label>
      )}
      <div role="radiogroup" aria-label={label} className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((group) => {
          const on = group.id === value;
          return (
            <button
              key={group.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(group.id)}
              className={cn(
                'flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                on ? 'border-primary/40 bg-primary/5 font-semibold text-foreground' : 'border-border text-foreground hover:bg-band/50',
              )}
            >
              <span className="min-w-0 flex-1 break-words">{group.name}</span>
              {on && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
        {shown.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground sm:col-span-2">No group matches “{query}”.</p>}
      </div>
    </div>
  );
}
