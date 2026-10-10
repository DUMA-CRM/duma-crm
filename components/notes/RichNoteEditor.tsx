'use client';

import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { type Editor, EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

import {
  ColumnInsertLeft,
  ColumnInsertRight,
  ColumnRemove,
  RowInsertAbove,
  RowInsertBelow,
  RowRemove,
  TableHeader,
  Trash2,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';

import { NoteColumn, NoteColumns } from './noteColumns';
import { NoteVideo } from './noteVideo';

// ---------------------------------------------------------------------------
// The live note editor (TipTap) — loaded only on the Notes page
// (UI-ADR-031). It holds the document; the page around it saves. What it
// reports on every change: the editor's own JSON (stored as the truth), and
// Markdown and plain text derived from it (export, search, Ask DUMA).
//
// The formatting toolbar is `NoteToolbar`, rendered in the note's own bar by
// `NoteEditor` — one row for where the note is, how to format it and whether
// it's saved. Table editing lives here, on the table itself.
// ---------------------------------------------------------------------------

export interface EditorSnapshot {
  content: Record<string, unknown>;
  markdown: string;
  text: string;
}

export function snapshotOf(editor: Editor): EditorSnapshot {
  return {
    content: editor.getJSON() as Record<string, unknown>,
    markdown: editor.getMarkdown(),
    text: editor.getText({ blockSeparator: '\n' }),
  };
}

/** True for an empty stored document — a new note, or one imported as Markdown only. */
const isEmptyDoc = (content: Record<string, unknown>) => !content || Object.keys(content).length === 0;

/** Uploads put in a note: photos always, videos only where the upload goes to Content. */
export const insertableFiles = (files: File[], videos: boolean) =>
  files.filter((file) => file.type.startsWith('image/') || (videos && file.type.startsWith('video/')));

/** Upload photos (and videos) and put them in the note — at a drop point, or at the caret. */
export function insertMediaFiles(editor: Editor, files: File[], upload: (file: File) => Promise<string>, videos: boolean, at?: number) {
  for (const file of insertableFiles(files, videos)) {
    void upload(file)
      .then((src) => {
        const title = file.name.replace(/\.[^.]+$/, '');
        const node = file.type.startsWith('video/')
          ? { type: 'video', attrs: { src, title } }
          : { type: 'image', attrs: { src, alt: title } };
        const chain = editor.chain().focus();
        (at !== undefined ? chain.insertContentAt(at, node) : chain.insertContent(node)).run();
      })
      // The upload has already said why; the note just doesn't get the image.
      .catch(() => undefined);
  }
}

/**
 * ⇧⌘L is a checklist, as in Apple Notes. TextAlign claims the same keys for
 * "align left", so this runs first and wins.
 */
const NoteShortcuts = Extension.create({
  name: 'noteShortcuts',
  priority: 1000,
  addKeyboardShortcuts() {
    return { 'Mod-Shift-l': () => this.editor.commands.toggleTaskList() };
  },
});

export function RichNoteEditor({
  content,
  markdown,
  editable,
  onChange,
  onReady,
  onUploadImage,
  acceptsVideo,
}: {
  content: Record<string, unknown>;
  /** Used when `content` is empty: a Google Doc arrives as Markdown and becomes the document here. */
  markdown: string;
  editable: boolean;
  onChange: (snapshot: EditorSnapshot) => void;
  onReady?: (editor: Editor) => void;
  /** Upload a pasted or dropped image; resolves to its URL. */
  onUploadImage: (file: File) => Promise<string>;
  /** True when uploads go to Content, which keeps videos too. */
  acceptsVideo: boolean;
}) {
  const fromMarkdown = isEmptyDoc(content) && markdown.trim().length > 0;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;
  const videoRef = useRef(acceptsVideo);
  videoRef.current = acceptsVideo;
  const upload = (file: File) => uploadRef.current(file);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 60 } }),
      Image.configure({
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ['left', 'right', 'bottom-left', 'bottom-right'],
          minWidth: 80,
          alwaysPreserveAspectRatio: true,
        },
      }),
      NoteVideo,
      NoteColumns,
      NoteColumn,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      NoteShortcuts,
      Placeholder.configure({ placeholder: ({ pos }) => (pos === 0 ? 'Title' : 'Start writing…') }),
      Markdown,
    ],
    content: fromMarkdown ? markdown : isEmptyDoc(content) ? '' : content,
    ...(fromMarkdown ? { contentType: 'markdown' as const } : {}),
    editorProps: {
      attributes: { class: 'focus:outline-none', 'aria-label': 'Note' },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (insertableFiles(files, videoRef.current).length === 0 || !editorRef.current) return false;
        insertMediaFiles(editorRef.current, files, upload, videoRef.current);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (insertableFiles(files, videoRef.current).length === 0 || !editorRef.current) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertMediaFiles(editorRef.current, files, upload, videoRef.current, at);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => changeRef.current(snapshotOf(current)),
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    onReady?.(editor);
    // A Doc that arrived as Markdown is now a document: save it as one.
    if (fromMarkdown) changeRef.current(snapshotOf(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per editor
  }, [editor]);

  useEffect(() => {
    // No update event: becoming editable is not an edit, and must not trigger a save.
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return <div className="min-h-[60vh]" aria-busy="true" />;
  return (
    <div className="flex min-h-0 flex-col">
      <div className="note-prose pt-6">
        <EditorContent editor={editor} />
      </div>
      {editable && <TableMenu editor={editor} />}
    </div>
  );
}

/** The table under the caret, as a DOM element the floating menu can sit on. */
function tableElement(editor: Editor): HTMLElement | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      const dom = editor.view.nodeDOM($from.before(depth));
      return dom instanceof HTMLElement ? dom : null;
    }
  }
  return null;
}

/**
 * Rows and columns, on the table itself: whenever the caret is in a table, a
 * small bar sits above it. Columns resize by dragging their edges.
 */
function TableMenu({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      inTable: current.isActive('table'),
      canMerge: current.can().mergeCells(),
      canSplit: current.can().splitCell(),
      canDeleteColumn: current.can().deleteColumn(),
      canDeleteRow: current.can().deleteRow(),
    }),
  });

  const groups: { label: string; icon: IconComponent; run: () => void; disabled?: boolean; danger?: boolean }[][] = [
    [
      { label: 'Add a row above', icon: RowInsertAbove, run: () => editor.chain().focus().addRowBefore().run() },
      { label: 'Add a row below', icon: RowInsertBelow, run: () => editor.chain().focus().addRowAfter().run() },
      { label: 'Delete this row', icon: RowRemove, disabled: !state.canDeleteRow, run: () => editor.chain().focus().deleteRow().run() },
    ],
    [
      { label: 'Add a column to the left', icon: ColumnInsertLeft, run: () => editor.chain().focus().addColumnBefore().run() },
      { label: 'Add a column to the right', icon: ColumnInsertRight, run: () => editor.chain().focus().addColumnAfter().run() },
      {
        label: 'Delete this column',
        icon: ColumnRemove,
        disabled: !state.canDeleteColumn,
        run: () => editor.chain().focus().deleteColumn().run(),
      },
    ],
    [
      { label: 'Header row on or off', icon: TableHeader, run: () => editor.chain().focus().toggleHeaderRow().run() },
      { label: 'Delete the table', icon: Trash2, danger: true, run: () => editor.chain().focus().deleteTable().run() },
    ],
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="noteTableMenu"
      shouldShow={({ editor: current }) => current.isEditable && current.isActive('table')}
      getReferencedVirtualElement={() => tableElement(editor)}
      options={{ placement: 'top-start', offset: 8, flip: true, shift: { padding: 8 } }}
      className="z-30"
    >
      {state.inTable && (
        <div role="toolbar" aria-label="Table" className="flex items-center gap-0.5 rounded-lg border border-rule/70 bg-card p-1 shadow-lg">
          {groups.map((group, index) => (
            <div key={index} className={cn('flex items-center gap-0.5', index > 0 && 'ml-0.5 border-l border-rule/50 pl-1')}>
              {group.map((tool) => (
                <Tooltip key={tool.label} side="top" label={tool.label}>
                  <button
                    type="button"
                    aria-label={tool.label}
                    disabled={tool.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={tool.run}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35',
                      tool.danger && 'hover:bg-exception/8 hover:text-exception',
                    )}
                  >
                    <tool.icon size={15} aria-hidden="true" />
                  </button>
                </Tooltip>
              ))}
            </div>
          ))}
          {(state.canMerge || state.canSplit) && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().mergeOrSplit().run()}
              className="ml-0.5 h-7 rounded-md border-l border-rule/50 px-2 text-xs font-medium text-foreground transition-colors hover:bg-band"
            >
              {state.canMerge ? 'Merge cells' : 'Split cell'}
            </button>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}
