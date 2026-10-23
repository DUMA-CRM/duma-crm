'use client';

import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

import { proxiedImage } from '@/lib/api/client';
import { survivesRoundTrip } from '@/lib/utils/markdown-roundtrip';

import { CmsCallout, CmsVideo } from './liveMarkdownNodes';

// ---------------------------------------------------------------------------
// CMS rich text, edited live — the Notes editor's engine (TipTap), limited to
// what Markdown can hold, reading and writing Markdown (UI-ADR-039). Loaded
// only when a rich-text field opens (next/dynamic), as UI-ADR-031 asks.
//
// On creation it checks the value survives its own round trip
// (`survivesRoundTrip`); if not, the caller falls back to the Markdown
// editor. It reports changes only for real edits, so opening an entry never
// marks it unsaved.
// ---------------------------------------------------------------------------

/** Images show through `/be` (the CSP refuses the API's own host); the stored `src` stays the asset's URL. */
const CmsImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? (proxiedImage(HTMLAttributes.src) ?? HTMLAttributes.src) : HTMLAttributes.src;
    return ['img', { ...HTMLAttributes, src }];
  },
});

export default function LiveMarkdownEditor({
  id,
  label,
  value,
  editable,
  onChange,
  onCheck,
  onReady,
  onFiles,
  onEntryLink,
}: {
  id: string;
  label: string;
  value: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  /** Whether this value can be edited live without changing what websites show. */
  onCheck: (safe: boolean) => void;
  onReady: (editor: Editor) => void;
  /** Images pasted or dropped in; the caller uploads and inserts them. */
  onFiles: (files: File[]) => void;
  /** `[[` typed, as in Notes: the caller opens the entry picker and inserts the link at the caret. */
  onEntryLink: () => void;
}) {
  // The Markdown this editor last produced — a different `value` came from elsewhere (Ask DUMA, a restore).
  const emitted = useRef(value);
  const changeRef = useRef(onChange);
  const checkRef = useRef(onCheck);
  const filesRef = useRef(onFiles);
  const entryLinkRef = useRef(onEntryLink);
  useEffect(() => {
    changeRef.current = onChange;
    checkRef.current = onCheck;
    filesRef.current = onFiles;
    entryLinkRef.current = onEntryLink;
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      CmsImage.configure({ allowBase64: false }),
      CmsCallout,
      CmsVideo,
      Placeholder.configure({ placeholder: 'Start writing — type # for a heading, - for a list, or paste an image.' }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'focus:outline-none', id, 'aria-label': label, 'aria-multiline': 'true', role: 'textbox' },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
        if (files.length === 0) return false;
        filesRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((file) => file.type.startsWith('image/'));
        if (files.length === 0) return false;
        filesRef.current(files);
        return true;
      },
    },
    onCreate: ({ editor: created }) => checkRef.current(survivesRoundTrip(value, created.getMarkdown())),
    onUpdate: ({ editor: current }) => {
      // `[[` links another entry, as it links another note: the brackets go, the picker opens.
      const { from, empty } = current.state.selection;
      if (empty && from >= 2 && current.state.doc.textBetween(from - 2, from) === '[[') {
        current.chain().deleteRange({ from: from - 2, to: from }).run();
        entryLinkRef.current();
        return;
      }
      emitted.current = current.getMarkdown();
      changeRef.current(emitted.current);
    },
  });

  useEffect(() => {
    if (editor) onReady(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per editor
  }, [editor]);

  useEffect(() => {
    // Not an edit: no update event, so nothing is marked unsaved.
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  // Text changed outside the editor (Ask DUMA filled it in): show it, without reporting it back as an edit.
  useEffect(() => {
    if (!editor || value === emitted.current) return;
    emitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className="min-h-72" aria-busy="true" />;
  return (
    <div className="note-prose cms-live px-5 py-4">
      <EditorContent editor={editor} />
    </div>
  );
}
