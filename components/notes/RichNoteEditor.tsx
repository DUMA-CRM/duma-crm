'use client';

import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useId, useRef } from 'react';

import {
  Bold,
  Code,
  Heading,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  ListBullet,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Table,
  Type,
  Underline,
  Undo,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// The live note editor (TipTap) — loaded only on the Notes page
// (UI-ADR-031). It holds the document; the page around it saves. What it
// reports on every change: the editor's own JSON (stored as the truth), and
// Markdown and plain text derived from it (export, search, Ask DUMA).
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

export function RichNoteEditor({
  content,
  markdown,
  editable,
  onChange,
  onReady,
  onUploadImage,
}: {
  content: Record<string, unknown>;
  /** Used when `content` is empty: a Google Doc arrives as Markdown and becomes the document here. */
  markdown: string;
  editable: boolean;
  onChange: (snapshot: EditorSnapshot) => void;
  onReady?: (editor: Editor) => void;
  /** Upload a pasted or dropped image; resolves to its URL. */
  onUploadImage: (file: File) => Promise<string>;
}) {
  const fromMarkdown = isEmptyDoc(content) && markdown.trim().length > 0;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;

  const insertImages = (editor: Editor, files: File[], at?: number) => {
    for (const file of files.filter((candidate) => candidate.type.startsWith('image/'))) {
      void uploadRef.current(file).then((src) => {
        const chain = editor.chain().focus();
        (at !== undefined
          ? chain.insertContentAt(at, { type: 'image', attrs: { src, alt: file.name } })
          : chain.setImage({ src, alt: file.name })
        ).run();
      });
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ allowBase64: false }),
      Highlight,
      Placeholder.configure({ placeholder: ({ pos }) => (pos === 0 ? 'Title' : 'Start writing…') }),
      Markdown,
    ],
    content: fromMarkdown ? markdown : isEmptyDoc(content) ? '' : content,
    ...(fromMarkdown ? { contentType: 'markdown' as const } : {}),
    editorProps: {
      attributes: { class: 'focus:outline-none', 'aria-label': 'Note' },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (!files.some((file) => file.type.startsWith('image/')) || !editorRef.current) return false;
        insertImages(editorRef.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.some((file) => file.type.startsWith('image/')) || !editorRef.current) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertImages(editorRef.current, files, at);
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
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return <div className="min-h-[60vh]" aria-busy="true" />;
  return (
    <div className="flex min-h-0 flex-col">
      {editable && <Toolbar editor={editor} onPickImage={(files) => insertImages(editor, files)} />}
      <div className="note-prose px-1 pt-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: (files: File[]) => void }) {
  const fileInputId = useId();
  // Re-render on selection and content, so the active states follow the caret.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      paragraph: current.isActive('paragraph'),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      highlight: current.isActive('highlight'),
      code: current.isActive('code'),
      link: current.isActive('link'),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      task: current.isActive('taskList'),
      quote: current.isActive('blockquote'),
      table: current.isActive('table'),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link address', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '' || url.trim() === 'https://') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const groups: { label: string; icon: IconComponent; active?: boolean; disabled?: boolean; run: () => void; shortcut?: string }[][] = [
    [
      { label: 'Title', icon: Heading, active: state.h1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: 'Heading', icon: Type, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    ],
    [
      { label: 'Bold', icon: Bold, active: state.bold, shortcut: '⌘B', run: () => editor.chain().focus().toggleBold().run() },
      { label: 'Italic', icon: Italic, active: state.italic, shortcut: '⌘I', run: () => editor.chain().focus().toggleItalic().run() },
      {
        label: 'Underline',
        icon: Underline,
        active: state.underline,
        shortcut: '⌘U',
        run: () => editor.chain().focus().toggleUnderline().run(),
      },
      { label: 'Strikethrough', icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
      { label: 'Highlight', icon: Highlighter, active: state.highlight, run: () => editor.chain().focus().toggleHighlight().run() },
    ],
    [
      {
        label: 'Checklist',
        icon: ListChecks,
        active: state.task,
        shortcut: '⇧⌘L',
        run: () => editor.chain().focus().toggleTaskList().run(),
      },
      { label: 'Bulleted list', icon: ListBullet, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
      { label: 'Numbered list', icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
      { label: 'Quote', icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
      { label: 'Code', icon: Code, active: state.code, run: () => editor.chain().focus().toggleCode().run() },
    ],
    [
      {
        label: state.table ? 'Add a row' : 'Table',
        icon: Table,
        active: state.table,
        run: () =>
          state.table
            ? editor.chain().focus().addRowAfter().run()
            : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      { label: 'Link', icon: Link2, active: state.link, shortcut: '⌘K', run: setLink },
      { label: 'Image', icon: ImagePlus, run: () => document.getElementById(fileInputId)?.click() },
      { label: 'Divider', icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },
    ],
    [
      { label: 'Undo', icon: Undo, disabled: !state.canUndo, shortcut: '⌘Z', run: () => editor.chain().focus().undo().run() },
      { label: 'Redo', icon: Redo, disabled: !state.canRedo, shortcut: '⇧⌘Z', run: () => editor.chain().focus().redo().run() },
    ],
  ];

  // ⌘K for a link and ⇧⌘L for a checklist, as Notes does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editor.isFocused || !(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'k' && !event.shiftKey) {
        event.preventDefault();
        setLink();
      } else if (event.key.toLowerCase() === 'l' && event.shiftKey) {
        event.preventDefault();
        editor.chain().focus().toggleTaskList().run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1 border-b border-rule/50 bg-background/95 px-1 py-1.5 backdrop-blur"
    >
      {groups.map((group, index) => (
        <div key={index} className={cn('flex items-center gap-0.5', index > 0 && 'border-l border-rule/50 pl-1')}>
          {group.map((tool) => (
            <Tooltip key={tool.label} side="bottom" label={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}>
              <button
                type="button"
                aria-label={tool.label}
                aria-pressed={tool.active ?? undefined}
                disabled={tool.disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={tool.run}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40',
                  tool.active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                )}
              >
                <tool.icon size={16} aria-hidden="true" />
              </button>
            </Tooltip>
          ))}
        </div>
      ))}
      <input
        id={fileInputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          onPickImage([...(event.target.files ?? [])]);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}
