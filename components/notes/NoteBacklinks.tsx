'use client';

import { useQuery } from '@tanstack/react-query';

import { Link2, Pin, StickyNote } from '@/components/icons';

import { getNoteBacklinks } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { noteBodyAfterTitle } from '@/lib/utils/notes';

/**
 * "Linked from": the notes (that you can read) linking to this one — made with
 * [[ in another note. Quiet when there are none; a failure says so and retries.
 */
export function NoteBacklinks({ noteId, onOpen }: { noteId: string; onOpen: (id: string) => void }) {
  const query = useQuery({ queryKey: moduleQueryKeys.notes.key('backlinks', noteId), queryFn: () => getNoteBacklinks(noteId) });
  if (query.isPending || (query.isSuccess && query.data.length === 0)) return null;

  return (
    <section aria-label="Linked from" className="mt-10 border-t border-divider pt-5">
      <h2 className="mb-2 flex items-center gap-1.5 text-label uppercase text-muted-foreground">
        <Link2 size={13} aria-hidden="true" />
        Linked from{query.isSuccess && <span className="tabular-nums">· {query.data.length}</span>}
      </h2>
      {query.isError ? (
        <p className="text-sm text-muted-foreground">
          Links to this note couldn’t be loaded.{' '}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => void query.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {query.data.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onOpen(note.id)}
                className="flex w-full items-start gap-2.5 rounded-lg border border-rule/50 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {note.pinned ? (
                  <Pin size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <StickyNote size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{note.title || 'New note'}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {noteBodyAfterTitle(note.snippet) || note.snippet || 'No more text'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
