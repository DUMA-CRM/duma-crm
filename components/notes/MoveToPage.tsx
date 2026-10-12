'use client';

import { useState } from 'react';

import { ArrowLeft, Check, FolderIcon, FolderLocked, FolderShared, Search } from '@/components/icons';
import { Input } from '@/components/ui/input';

import type { NoteFolder } from '@/lib/modules/notes/client';
import { cn } from '@/lib/utils/cn';
import { type MoveTarget, moveTargets } from '@/lib/utils/notes-tree';

/** Search shows once the list is long enough to need it. */
const SEARCH_FROM = 7;

/**
 * The note menu's second page: where the note can go, with the sidebar's own
 * icons and indentation, and a search for a long list. The current place is
 * marked and can't be picked.
 */
export function MoveToPage({
  folders,
  currentFolderId,
  pending,
  onBack,
  onMove,
}: {
  folders: NoteFolder[];
  currentFolderId: string | null;
  pending: boolean;
  onBack: () => void;
  onMove: (target: MoveTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const all = moveTargets(folders);
  const shown = query.trim() ? moveTargets(folders, query) : all;
  const searching = query.trim() !== '';

  return (
    <div role="group" aria-label="Move to">
      <div className="flex items-center gap-1 pb-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the note menu"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-foreground">Move to</p>
      </div>

      {all.length >= SEARCH_FROM && (
        <Input
          aria-label="Find a folder"
          placeholder="Find a folder"
          value={query}
          autoFocus
          leftIcon={<Search size={14} aria-hidden="true" />}
          onChange={(event) => setQuery(event.target.value)}
          className="mb-1.5"
        />
      )}

      {shown.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">No folder called “{query.trim()}”.</p>
      ) : (
        <ul className="max-h-72 space-y-px overflow-y-auto">
          {shown.map((target) => {
            const current = target.id === currentFolderId;
            const Icon = target.id === null ? FolderLocked : target.shared ? FolderShared : FolderIcon;
            return (
              <li key={target.id ?? 'mine'}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={current || pending}
                  onClick={() => onMove(target)}
                  // The sidebar's indent: 12px a level.
                  style={{ paddingLeft: `${8 + target.depth * 12}px` }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring',
                    current ? 'bg-primary/10 text-foreground' : 'text-foreground hover:bg-band/60 disabled:opacity-50',
                  )}
                >
                  <Icon
                    size={16}
                    strokeWidth={1.7}
                    className={cn('shrink-0', current ? 'text-primary' : 'text-muted-foreground')}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', current && 'font-semibold')}>{target.name}</span>
                    {searching && target.path && <span className="block truncate text-xs text-muted-foreground">in {target.path}</span>}
                  </span>
                  {target.shared && <span className="sr-only">(shared)</span>}
                  {current && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      <Check size={13} aria-hidden="true" />
                      Here now
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
