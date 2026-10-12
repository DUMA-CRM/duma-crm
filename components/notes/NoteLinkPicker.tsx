'use client';

import { useQuery } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Pin, StickyNote } from '@/components/icons';

import { getNotes } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { noteHref, noteLinkQuery, untitledNote } from '@/lib/utils/note-links';
import { rankSwitcher } from '@/lib/utils/notes-switcher';

interface Open {
  query: string;
  /** Where the `[[` starts, so the pick replaces it. */
  start: number;
  caret: number;
  top: number;
  left: number;
}

/**
 * Type `[[` in a note to link another: a list of notes by title follows the
 * caret, narrowed as you type. Arrows move, Enter or Tab links, Esc closes.
 * The link is an ordinary one to `/notes?note=<id>`, so it reads anywhere.
 */
export function NoteLinkPicker({ editor, currentNoteId }: { editor: Editor; currentNoteId: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [active, setActive] = useState(0);
  // Esc on a `[[` keeps it closed until a new one is typed.
  const dismissed = useRef<number | null>(null);
  const lastQuery = useRef<string | null>(null);

  useEffect(() => {
    const check = () => {
      const { from, empty } = editor.state.selection;
      const text = empty ? editor.state.doc.textBetween(Math.max(0, from - 64), from, '\n', '\n') : '';
      const query = empty ? noteLinkQuery(text) : null;
      const start = query === null ? -1 : from - query.length - 2;
      if (query === null || dismissed.current === start) {
        lastQuery.current = null;
        setOpen(null);
        return;
      }
      if (lastQuery.current !== query) {
        lastQuery.current = query;
        setActive(0);
      }
      const at = editor.view.coordsAtPos(from);
      setOpen({ query, start, caret: from, top: at.bottom + 6, left: at.left });
    };
    editor.on('selectionUpdate', check);
    editor.on('update', check);
    return () => {
      editor.off('selectionUpdate', check);
      editor.off('update', check);
    };
  }, [editor]);

  const notes = useQuery({
    queryKey: moduleQueryKeys.notes.key('list', 'switcher'),
    queryFn: () => getNotes({ limit: 200 }),
    staleTime: 30_000,
    enabled: open !== null,
  });
  const results = open
    ? rankSwitcher(
        (notes.data ?? []).filter((note) => note.id !== currentNoteId),
        open.query,
        8,
      )
    : [];

  const pick = (index: number) => {
    const note = results[index];
    if (!open || !note) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: open.start, to: open.caret })
      .insertContent([
        {
          type: 'text',
          text: note.title.trim() || untitledNote(note.kind),
          // The title is remembered, so the link's text follows the note when it's renamed (noteLinkTitles).
          marks: [{ type: 'link', attrs: { href: noteHref(note.id), noteTitle: note.title.trim() || untitledNote(note.kind) } }],
        },
        { type: 'text', text: ' ' },
      ])
      .run();
    setOpen(null);
  };

  // While the list is open, the arrows and Enter are its, not the editor's — caught before ProseMirror sees them.
  useEffect(() => {
    if (!open) return;
    const dom = editor.view.dom;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActive((index) => (event.key === 'ArrowDown' ? Math.min(index + 1, results.length - 1) : Math.max(index - 1, 0)));
      } else if ((event.key === 'Enter' || event.key === 'Tab') && results.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        pick(active);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismissed.current = open.start;
        setOpen(null);
      }
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
  });

  if (!open) return null;
  return createPortal(
    <div
      role="listbox"
      aria-label="Link a note"
      style={{ top: open.top, left: open.left }}
      className="fixed z-100 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-rule/70 bg-card p-1 text-foreground shadow-lg"
      // Keep the editor focused: a click picks, it doesn't blur.
      onMouseDown={(event) => event.preventDefault()}
    >
      <p className="px-2 pb-1 pt-1.5 text-label uppercase text-muted-foreground">Link a note</p>
      {notes.isPending ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.isError ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Notes couldn’t be loaded.</p>
      ) : results.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">{open.query ? `No note called “${open.query}”.` : 'No other notes yet.'}</p>
      ) : (
        <ul className="max-h-64 space-y-px overflow-y-auto">
          {results.map((note, index) => (
            <li key={note.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150',
                  index === active ? 'bg-primary/10' : 'hover:bg-band/60',
                )}
              >
                {note.pinned ? (
                  <Pin size={14} className="shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <StickyNote size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{note.title.trim() || untitledNote(note.kind)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
