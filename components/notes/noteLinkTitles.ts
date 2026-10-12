'use client';

import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { Mark } from '@tiptap/pm/model';
import { type Editor, Extension } from '@tiptap/react';
import { useEffect } from 'react';

import { getNote, getNotes } from '@/lib/modules/notes/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { noteIdFromHref, relinkedText, untitledNote } from '@/lib/utils/note-links';

// ---------------------------------------------------------------------------
// Links between notes follow renames, as in Obsidian. A link already points at
// its note by id, so it never breaks; what goes stale is its text. The [[
// picker remembers the title it wrote (`data-note-title` on the link); when a
// note is opened, each link whose text is still that title is rewritten to the
// note's title now — and, if the note can be edited, saved like any edit.
// ---------------------------------------------------------------------------

/** The title a [[ link was made with, kept on the link itself. */
export const NoteLinkTitle = Extension.create({
  name: 'noteLinkTitle',
  addGlobalAttributes() {
    return [
      {
        types: ['link'],
        attributes: {
          noteTitle: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-note-title'),
            renderHTML: (attrs) => (attrs.noteTitle ? { 'data-note-title': attrs.noteTitle as string } : {}),
          },
        },
      },
    ];
  },
});

interface NoteLinkRange {
  id: string;
  from: number;
  to: number;
  text: string;
  savedTitle: string | null;
  link: Mark;
  /** Every mark on the link's first run (bold, colour…), kept on the new text. */
  marks: readonly Mark[];
}

/** Each link to a note in the document — one range per link, however many formatting runs it spans. */
function noteLinksIn(editor: Editor): NoteLinkRange[] {
  const ranges: NoteLinkRange[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const link = node.marks.find((mark) => mark.type.name === 'link');
    const id = noteIdFromHref(link?.attrs.href as string | undefined);
    if (!link || !id) return;
    const last = ranges[ranges.length - 1];
    if (last && last.to === pos && last.link.attrs.href === link.attrs.href) {
      last.to = pos + node.nodeSize;
      last.text += node.text ?? '';
      return;
    }
    const savedTitle = link.attrs.noteTitle as string | null;
    ranges.push({ id, from: pos, to: pos + node.nodeSize, text: node.text ?? '', savedTitle, link, marks: node.marks });
  });
  return ranges;
}

/** The linked notes' titles now: from the list most screens already have, the rest one by one. Unreadable ones are left out. */
async function titlesOf(queryClient: QueryClient, ids: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const list = await queryClient
    .fetchQuery({ queryKey: moduleQueryKeys.notes.key('list', 'titles', null), queryFn: () => getNotes({ limit: 200 }), staleTime: 30_000 })
    .catch(() => []);
  for (const note of list) titles.set(note.id, note.title.trim() || untitledNote(note.kind));
  await Promise.all(
    ids
      .filter((id) => !titles.has(id))
      .map((id) =>
        queryClient
          .fetchQuery({ queryKey: moduleQueryKeys.notes.key('note', id), queryFn: () => getNote(id), staleTime: 30_000 })
          .then((note) => titles.set(id, note.title.trim() || untitledNote(note.content?.type === 'drawing' ? 'drawing' : 'note')))
          .catch(() => undefined),
      ),
  );
  return titles;
}

/** Once the note is open: rewrite the links whose note was renamed since. */
export function useNoteLinkTitles(editor: Editor | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!editor) return;
    const ids = [...new Set(noteLinksIn(editor).map((link) => link.id))];
    if (ids.length === 0) return;
    let cancelled = false;
    void titlesOf(queryClient, ids).then((titles) => {
      if (cancelled || editor.isDestroyed) return;
      // Found again: the document may have changed while the titles loaded.
      const { tr, schema } = editor.state;
      let changed = false;
      // From the end, so the positions still to come stay where they were.
      for (const range of noteLinksIn(editor).reverse()) {
        const current = titles.get(range.id);
        const text = current === undefined ? null : relinkedText(range, current);
        if (text === null) continue;
        const link = range.link.type.create({ ...range.link.attrs, noteTitle: current });
        tr.replaceWith(
          range.from,
          range.to,
          schema.text(
            text,
            range.marks.map((mark) => (mark.type === link.type ? link : mark)),
          ),
        );
        changed = true;
      }
      // Not an edit to undo; it is saved, so the Markdown and search follow too.
      if (changed) editor.view.dispatch(tr.setMeta('addToHistory', false));
    });
    return () => {
      cancelled = true;
    };
  }, [editor, queryClient]);
}
