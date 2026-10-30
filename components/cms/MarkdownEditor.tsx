'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  Bold,
  ChevronDown,
  Code,
  CodeBlock,
  Eye,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  Italic,
  Link2,
  ListBullet,
  ListChecks,
  ListOrdered,
  Paperclip,
  Pencil,
  Pilcrow,
  Play,
  Plus,
  Quote,
  Redo,
  Undo,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { MenuOption } from '@/components/shared/MenuOption';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl, type SegmentedOption } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { getCmsContentTypes, getCmsEntries, uploadCmsAsset } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { previewUrlFor } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  type BlockKind,
  CALLOUT_KINDS,
  type CalloutKind,
  type TextEdit,
  applyEdit,
  blockKindAt,
  continueList,
  imageMarkdown,
  insertBlock,
  insertCallout,
  insertLink,
  insertNamedLink,
  setBlockKind,
  toggleCodeBlock,
  toggleLinePrefix,
  toggleWrap,
  uploadPlaceholder,
  videoEmbed,
} from '@/lib/utils/markdown-edit';
import { useCmsTenantId } from '@/components/cms/ContentScope';

import { MediaPicker } from './MediaPicker';
import { ReferencePicker } from './ReferencePicker';
import { RichTextPreview } from './RichTextPreview';
import { ActionRow } from './rows';
import { invalidateCms } from './shared';

type Mode = 'live' | 'write' | 'preview';
type Command = (text: string, start: number, end: number) => TextEdit;

const VIEW_OPTIONS: SegmentedOption<Mode>[] = [
  { value: 'live', label: 'Live', icon: Pencil },
  { value: 'write', label: 'Markdown', icon: Code },
  { value: 'preview', label: 'Preview', icon: Eye },
];

// The live editor (TipTap) loads only when a rich-text field opens — UI-ADR-031 keeps it out of every other bundle.
const LiveMarkdownEditor = dynamic(() => import('./LiveMarkdownEditor'), {
  ssr: false,
  loading: () => <div className="min-h-72" aria-busy="true" />,
});

/** The toolbar's formatting, as live-editor commands — the same buttons as for Markdown. */
/** The block styles, named and drawn as on the Notes toolbar. */
const BLOCKS: ReadonlyArray<{ key: BlockKind; label: string; icon: IconComponent }> = [
  { key: 'text', label: 'Text', icon: Pilcrow },
  { key: 'h1', label: 'Title', icon: Heading1 },
  { key: 'h2', label: 'Heading', icon: Heading2 },
  { key: 'h3', label: 'Subheading', icon: Heading3 },
  { key: 'quote', label: 'Quote', icon: Quote },
];

/** The live editor's block at the caret, in the same names. */
const liveBlock = (editor: Editor): BlockKind =>
  editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading')
        ? 'h3'
        : editor.isActive('blockquote')
          ? 'quote'
          : 'text';

const LIVE_RUN: Record<string, (editor: Editor) => void> = {
  Bold: (editor) => editor.chain().focus().toggleBold().run(),
  Italic: (editor) => editor.chain().focus().toggleItalic().run(),
  Code: (editor) => editor.chain().focus().toggleCode().run(),
  'Code block': (editor) => editor.chain().focus().toggleCodeBlock().run(),
  'Bulleted list': (editor) => editor.chain().focus().toggleBulletList().run(),
  'Numbered list': (editor) => editor.chain().focus().toggleOrderedList().run(),
  'Task list': (editor) => editor.chain().focus().toggleTaskList().run(),
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const TOOLS: Array<{ label: string; icon: IconComponent; shortcut?: string; run: Command } | 'gap'> = [
  { label: 'Bold', icon: Bold, shortcut: 'B', run: (t, s, e) => toggleWrap(t, s, e, '**', 'bold text') },
  { label: 'Italic', icon: Italic, shortcut: 'I', run: (t, s, e) => toggleWrap(t, s, e, '_', 'italic text') },
  { label: 'Code', icon: Code, shortcut: 'E', run: (t, s, e) => toggleWrap(t, s, e, '`', 'code') },
  { label: 'Code block', icon: CodeBlock, run: toggleCodeBlock },
  { label: 'Link', icon: Link2, shortcut: 'K', run: insertLink },
  'gap',
  { label: 'Bulleted list', icon: ListBullet, run: (t, s, e) => toggleLinePrefix(t, s, e, 'bullet') },
  { label: 'Numbered list', icon: ListOrdered, run: (t, s, e) => toggleLinePrefix(t, s, e, 'number') },
  { label: 'Task list', icon: ListChecks, run: (t, s, e) => toggleLinePrefix(t, s, e, 'task') },
];

const SHORTCUTS = new Map(
  TOOLS.flatMap((tool) => (tool !== 'gap' && tool.shortcut ? [[tool.shortcut.toLowerCase(), tool.run] as const] : [])),
);

const baseName = (fileName: string) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

/**
 * The rich-text field, written the way GitHub's comment box works: a toolbar
 * and the usual shortcuts over plain Markdown, Write / Preview / Split, and
 * images that land exactly where the caret is — picked from Media, or pasted
 * and dropped straight in, uploading while an "Uploading…" line holds their
 * place.
 *
 * Edits go through the browser's own text insertion (`insertText`) so ⌘Z
 * undoes a toolbar click like any typing. The rules are pure, in
 * `lib/utils/markdown-edit.ts`.
 */
export function MarkdownEditor({
  id,
  label,
  help,
  value,
  disabled,
  error,
  locale = 'en',
  onChange,
}: {
  /** The entry's language, so an entry link finds that language's page. */
  locale?: string;
  id: string;
  label: React.ReactNode;
  help?: React.ReactNode;
  value: string;
  disabled?: boolean;
  error: boolean;
  onChange: (next: string) => void;
}) {
  const tenantId = useCmsTenantId() ?? undefined;
  const queryClient = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The caret when the picker opened — the dialog takes focus, the image still goes here.
  const savedSelection = useRef<{ start: number; end: number } | null>(null);
  // Live, as in a note — unless this text uses Markdown the live editor can't keep exactly; then Markdown.
  const [mode, setMode] = useState<Mode>('live');
  const [liveEditor, setLiveEditor] = useState<Editor | null>(null);
  // The text that failed the live check: retried only once it has changed.
  const [blockedFor, setBlockedFor] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const live = mode === 'live' && liveEditor !== null;
  // Whether the live editor has anything to undo or redo — refreshed on every change it makes.
  const [history, setHistory] = useState({ undo: false, redo: false });
  // The block style under the caret, for the selector: from the live editor, or from the Markdown line.
  const [block, setBlock] = useState<BlockKind>('text');
  const [blockOpen, setBlockOpen] = useState(false);
  useEffect(() => {
    if (!liveEditor) return;
    const refresh = () => {
      setHistory({ undo: liveEditor.can().undo(), redo: liveEditor.can().redo() });
      setBlock(liveBlock(liveEditor));
    };
    refresh();
    liveEditor.on('transaction', refresh);
    return () => {
      liveEditor.off('transaction', refresh);
    };
  }, [liveEditor]);
  const chooseBlock = (kind: BlockKind) => {
    setBlockOpen(false);
    if (mode === 'live') {
      if (!liveEditor) return;
      const chain = liveEditor.chain().focus();
      if (kind === 'text') chain.clearNodes().setParagraph().run();
      else if (kind === 'quote') chain.toggleBlockquote().run();
      else chain.setHeading({ level: kind === 'h1' ? 1 : kind === 'h2' ? 2 : 3 }).run();
      return;
    }
    const element = textarea.current;
    if (!element || disabled) return;
    apply(setBlockKind(latest.current, element.selectionStart, element.selectionEnd, kind));
    setBlock(kind);
  };

  /** Undo or redo in whichever view is open: the editor's history, or the text box's own (toolbar edits go through it too). */
  const step = (direction: 'undo' | 'redo') => {
    if (mode === 'live') {
      if (!liveEditor) return;
      if (direction === 'undo') liveEditor.chain().focus().undo().run();
      else liveEditor.chain().focus().redo().run();
      return;
    }
    textarea.current?.focus();
    document.execCommand(direction);
  };
  const chooseMode = (next: Mode) => {
    if (next === 'live' && blockedFor !== null && blockedFor === latest.current) {
      toast('info', 'This text uses Markdown the live editor can’t keep exactly — keep editing it as Markdown.');
      return;
    }
    if (next !== 'live') setLiveEditor(null);
    setMode(next);
  };
  const [insertOpen, setInsertOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  // The text as it is right now. Programmatic edits update it immediately, so
  // two uploads finishing back to back each see the other's result.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
  // The text box grows with the text, as a note does — no inner scrollbar, no drag handle.
  useLayoutEffect(() => {
    const element = textarea.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value, mode]);
  const commit = (next: string) => {
    latest.current = next;
    onChange(next);
  };

  function apply(edit: TextEdit) {
    const element = textarea.current;
    const expected = applyEdit(latest.current, edit);
    if (element) {
      element.focus();
      element.setSelectionRange(edit.from, edit.to);
      // insertText keeps the browser's undo stack; it fires `input`, so onChange runs as for typing.
      const inserted = edit.insert ? document.execCommand('insertText', false, edit.insert) : document.execCommand('delete');
      if (!inserted || element.value !== expected) commit(expected);
      else latest.current = expected;
      requestAnimationFrame(() => element.setSelectionRange(edit.selectFrom, edit.selectTo));
    } else {
      commit(expected);
    }
  }

  const run = (command: Command, label?: string) => {
    if (disabled) return;
    if (mode === 'live') {
      if (liveEditor && label && LIVE_RUN[label]) LIVE_RUN[label](liveEditor);
      return;
    }
    const element = textarea.current;
    if (!element) return;
    apply(command(latest.current, element.selectionStart, element.selectionEnd));
  };

  /** Images into the live editor at the caret, uploaded first when they come from this device. */
  const insertLiveImages = (images: Array<{ src: string; alt: string }>) => {
    if (!liveEditor || images.length === 0) return;
    liveEditor
      .chain()
      .focus()
      .insertContent(images.map((image) => ({ type: 'image', attrs: image })))
      .run();
  };

  /** Swap one upload's placeholder for its result, wherever the text has moved it to. */
  function resolvePlaceholder(placeholder: string, replacement: string) {
    const element = textarea.current;
    const current = latest.current;
    const at = current.indexOf(placeholder);
    if (at === -1) return; // Deleted while uploading — respect that.
    const caret = element?.selectionStart ?? 0;
    const shift = caret > at ? replacement.length - placeholder.length : 0;
    const removeLine = !replacement && current.slice(at + placeholder.length, at + placeholder.length + 1) === '\n';
    commit(current.slice(0, at) + replacement + current.slice(at + placeholder.length + (removeLine ? 1 : 0)));
    if (element) requestAnimationFrame(() => element.setSelectionRange(caret + shift, caret + shift));
  }

  async function uploadFiles(files: File[]) {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      if (files.length > 0) toast('error', 'Only images can be added to the text. Add other files in Media.');
      return;
    }
    if (mode === 'live') {
      setUploading((count) => count + images.length);
      await Promise.all(
        images.map(async (file) => {
          try {
            const asset = await uploadCmsAsset(file, {}, tenantId);
            insertLiveImages([{ src: asset.url, alt: asset.altText ?? asset.title ?? baseName(file.name) }]);
          } catch (failure) {
            toast('error', `${file.name}: ${failure instanceof Error ? failure.message : 'upload failed'}`);
          } finally {
            setUploading((count) => count - 1);
          }
        }),
      );
      invalidateCms(queryClient);
      return;
    }
    const element = textarea.current;
    const start = element?.selectionStart ?? latest.current.length;
    const end = element?.selectionEnd ?? start;
    const placeholders = images.map((file) => uploadPlaceholder(file.name, Math.random().toString(36).slice(2, 7)));
    apply(insertBlock(latest.current, start, end, placeholders.join('\n\n')));

    setUploading((count) => count + images.length);
    await Promise.all(
      images.map(async (file, index) => {
        try {
          const asset = await uploadCmsAsset(file, {}, tenantId);
          resolvePlaceholder(placeholders[index]!, imageMarkdown(asset.altText ?? asset.title ?? baseName(file.name), asset.url));
        } catch (failure) {
          resolvePlaceholder(placeholders[index]!, '');
          toast('error', `${file.name}: ${failure instanceof Error ? failure.message : 'upload failed'}`);
        } finally {
          setUploading((count) => count - 1);
        }
      }),
    );
    invalidateCms(queryClient);
  }

  const rememberSelection = () => {
    const element = textarea.current;
    savedSelection.current = element ? { start: element.selectionStart, end: element.selectionEnd } : null;
  };
  /** Apply a command at the remembered caret, after the dialog that took focus has gone. */
  const atSaved = (command: Command) =>
    requestAnimationFrame(() => {
      const at = savedSelection.current ?? { start: latest.current.length, end: latest.current.length };
      apply(command(latest.current, at.start, at.end));
    });

  /** The page an entry lives on: its type's preview URL, else /slug. */
  async function linkEntry(documentId: string) {
    const [entries, types] = await Promise.all([getCmsEntries({ documentIds: documentId }, tenantId), getCmsContentTypes(tenantId)]);
    const entry = entries.data.find((row) => row.locale === locale) ?? entries.data[0];
    if (!entry) return;
    const type = types.find((row) => row.id === entry.contentTypeId);
    const url = previewUrlFor(type?.previewUrl ?? null, entry) ?? (entry.slug ? `/${entry.slug}` : null);
    if (!url) {
      toast('error', 'That entry has no slug or page URL yet — give it a slug, or set a preview URL on its model.');
      return;
    }
    if (mode === 'live' && liveEditor) {
      liveEditor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: entry.title ?? 'Untitled', marks: [{ type: 'link', attrs: { href: url } }] })
        .run();
      return;
    }
    atSaved((text, start, end) => insertNamedLink(text, start, end, url, entry.title ?? 'Untitled'));
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      const command = SHORTCUTS.get(event.key.toLowerCase());
      if (command) {
        event.preventDefault();
        run(command);
      }
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const element = event.currentTarget;
      if (element.selectionStart !== element.selectionEnd) return;
      const edit = continueList(latest.current, element.selectionStart);
      if (edit) {
        event.preventDefault();
        apply(edit);
      }
    }
  };

  const editable = !disabled;
  // The same surface as every input: white in light mode, the field colour in dark.
  const paper = 'bg-control';

  const textArea = (
    <textarea
      ref={textarea}
      id={id}
      rows={10}
      spellCheck
      className="block min-h-72 w-full flex-1 resize-none overflow-hidden bg-transparent px-5 py-4 text-[0.9375rem] leading-7 text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
      value={value}
      disabled={disabled}
      placeholder={'## A heading\n\nWrite in Markdown. Paste or drop an image to put it right here.'}
      onChange={(event) => {
        const element = event.target;
        const caret = element.selectionStart;
        // `[[` links another entry, as in Notes: the brackets go, the picker opens at that spot.
        if (element.selectionEnd === caret && caret >= 2 && element.value.slice(caret - 2, caret) === '[[') {
          const next = element.value.slice(0, caret - 2) + element.value.slice(caret);
          commit(next);
          savedSelection.current = { start: caret - 2, end: caret - 2 };
          setLinking(true);
          return;
        }
        onChange(element.value);
      }}
      onKeyDown={onKeyDown}
      onSelect={(event) => setBlock(blockKindAt(event.currentTarget.value, event.currentTarget.selectionStart))}
      onPaste={(event) => {
        const files = [...event.clipboardData.files];
        if (!editable || files.length === 0) return;
        event.preventDefault();
        void uploadFiles(files);
      }}
    />
  );

  const preview = (
    <div className="min-h-72 overflow-auto px-5 py-4" aria-label="Preview">
      {value.trim() ? <RichTextPreview markdown={value} /> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}
    </div>
  );

  return (
    <div>
      {label}
      {/* The paper: the text (or preview) and the upload strip at its foot. */}
      <div
        className={cn(
          'overflow-hidden rounded-lg border transition-colors focus-within:border-primary/60',
          paper,
          error ? 'border-exception' : 'border-rule',
          dragging && 'border-primary ring-2 ring-primary/15',
        )}
        onDragOver={(event) => {
          if (!editable || mode !== 'write' || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (!editable || mode !== 'write' || event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          setDragging(false);
          // Drop where the pointer is, not where the caret was.
          const element = textarea.current;
          const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offset: number } | null };
          const at = doc.caretPositionFromPoint?.(event.clientX, event.clientY)?.offset;
          if (element && at !== undefined && event.target === element && at <= element.value.length) element.setSelectionRange(at, at);
          void uploadFiles([...event.dataTransfer.files]);
        }}
      >
        {/* One bar on the paper, as in a note: formatting, then Insert, and the view on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/50 px-2 py-1.5">
          {mode !== 'preview' && editable ? (
            <div className="flex min-w-0 flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
              {/* The Notes text-style selector: Text, Title, Heading, Subheading, Quote. */}
              <Popover open={blockOpen} onOpenChange={setBlockOpen}>
                <Tooltip side="top" label="Text style">
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      className="flex h-8 w-28 items-center justify-between gap-1 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-band"
                    >
                      <span className="truncate">{(BLOCKS.find((entry) => entry.key === block) ?? BLOCKS[0]!).label}</span>
                      <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent
                  align="start"
                  className="w-48 p-1"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  {BLOCKS.map((entry) => (
                    <MenuOption
                      key={entry.key}
                      icon={entry.icon}
                      label={entry.label}
                      selected={entry.key === block}
                      onSelect={() => chooseBlock(entry.key)}
                      className={cn(
                        entry.key === 'h1' && 'text-base font-bold',
                        (entry.key === 'h2' || entry.key === 'h3') && 'font-semibold',
                      )}
                    />
                  ))}
                </PopoverContent>
              </Popover>
              <span className="mx-1 h-5 w-px bg-rule/60" aria-hidden="true" />
              {TOOLS.map((tool, index) =>
                tool === 'gap' ? (
                  <span key={`gap-${index}`} className="mx-1 h-5 w-px bg-rule/60" aria-hidden="true" />
                ) : (
                  <Tooltip side="top" key={tool.label} label={tool.shortcut ? `${tool.label} (${MOD}${tool.shortcut})` : tool.label}>
                    <button
                      type="button"
                      aria-label={tool.shortcut ? `${tool.label} (${MOD}${tool.shortcut})` : tool.label}
                      // Keep the textarea's selection: a mousedown on the button would otherwise blur it first.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (mode === 'live' && tool.label === 'Link') {
                          setLinkUrl((liveEditor?.getAttributes('link').href as string | undefined) ?? '');
                          setLinkOpen(true);
                          return;
                        }
                        run(tool.run, tool.label);
                      }}
                      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <tool.icon size={16} aria-hidden="true" />
                    </button>
                  </Tooltip>
                ),
              )}
              <span className="mx-1 h-5 w-px bg-rule/60" aria-hidden="true" />
              <Popover open={insertOpen} onOpenChange={setInsertOpen}>
                <PopoverTrigger
                  onMouseDown={(event) => {
                    event.preventDefault();
                    rememberSelection();
                  }}
                  className="flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-band"
                >
                  <Plus size={15} aria-hidden="true" /> Insert
                  <ChevronDown size={13} className="text-muted-foreground" aria-hidden="true" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-60 p-2">
                  <div className="flex flex-col gap-0.5">
                    <ActionRow
                      icon={ImagePlus}
                      label="Image from Media"
                      onClick={() => {
                        setInsertOpen(false);
                        setPicking(true);
                      }}
                    />
                    <ActionRow
                      icon={Paperclip}
                      label="Image from this device"
                      onClick={() => {
                        setInsertOpen(false);
                        fileInput.current?.click();
                      }}
                    />
                    <ActionRow
                      icon={FileText}
                      label="Link to an entry"
                      onClick={() => {
                        setInsertOpen(false);
                        setLinking(true);
                      }}
                    />
                    <ActionRow
                      icon={Play}
                      label="YouTube or Vimeo video"
                      onClick={() => {
                        setInsertOpen(false);
                        setVideoUrl('');
                      }}
                    />
                  </div>
                  <p className="mb-1 mt-2 px-2 text-label uppercase text-muted-foreground">Callout</p>
                  <div className="flex flex-col gap-0.5">
                    {CALLOUT_KINDS.map((kind) => (
                      <ActionRow
                        key={kind}
                        icon={Info}
                        label={kind.charAt(0) + kind.slice(1).toLowerCase()}
                        onClick={() => {
                          setInsertOpen(false);
                          if (mode === 'live' && liveEditor)
                            liveEditor
                              .chain()
                              .focus()
                              .insertCallout(kind as CalloutKind)
                              .run();
                          else atSaved((text, start, end) => insertCallout(text, start, end, kind as CalloutKind));
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 px-2 text-xs text-muted-foreground">Tip: type [[ to link another entry.</p>
                </PopoverContent>
              </Popover>
              <span className="mx-1 h-5 w-px bg-rule/60" aria-hidden="true" />
              {(
                [
                  { direction: 'undo', label: `Undo (${MOD}Z)`, icon: Undo, disabled: mode === 'live' && !history.undo },
                  { direction: 'redo', label: `Redo (${MOD}⇧Z)`, icon: Redo, disabled: mode === 'live' && !history.redo },
                ] as const
              ).map((tool) => (
                <Tooltip side="top" key={tool.direction} label={tool.label}>
                  <button
                    type="button"
                    aria-label={tool.label}
                    disabled={tool.disabled}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => step(tool.direction)}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35"
                  >
                    <tool.icon size={16} aria-hidden="true" />
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : (
            <span className="px-2 text-xs text-muted-foreground">{editable ? 'Preview — as your website shows it' : 'Read only'}</span>
          )}
          <SegmentedControl<Mode> ariaLabel="Editor view" value={mode} onChange={chooseMode} options={VIEW_OPTIONS} />
        </div>
        {blockedFor !== null && mode === 'write' && (
          <p className="border-b border-rule/50 bg-band/60 px-5 py-2 text-xs text-muted-foreground">
            This text uses Markdown the live editor can’t keep exactly, so it opens here, as Markdown. Preview shows it as your website
            will.
          </p>
        )}
        {linkOpen && live && (
          <form
            className="flex items-center gap-2 border-b border-rule/50 px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              const href = linkUrl.trim();
              const chain = liveEditor!.chain().focus().extendMarkRange('link');
              if (!href) chain.unsetLink().run();
              else if (liveEditor!.state.selection.empty && !liveEditor!.isActive('link'))
                liveEditor!
                  .chain()
                  .focus()
                  .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
                  .run();
              else chain.setLink({ href }).run();
              setLinkOpen(false);
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                aria-label="Link address"
                autoFocus
                placeholder="https://…"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
              />
            </div>
            <Button type="submit" className="h-9">
              {linkUrl.trim() ? 'Apply' : 'Remove link'}
            </Button>
            <Button type="button" variant="ghost" className="h-9" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
          </form>
        )}
        {mode === 'live' && (
          <LiveMarkdownEditor
            id={id}
            label={typeof label === 'string' ? label : 'Rich text'}
            value={value}
            editable={editable}
            onChange={(next) => {
              latest.current = next;
              onChange(next);
            }}
            onCheck={(safe) => {
              if (safe) return;
              setBlockedFor(latest.current);
              setLiveEditor(null);
              setMode('write');
            }}
            onReady={setLiveEditor}
            onFiles={(files) => void uploadFiles(files)}
            onEntryLink={() => setLinking(true)}
          />
        )}
        {mode === 'write' && textArea}
        {mode === 'preview' && preview}

        {editable && mode !== 'preview' && (
          <div className="flex items-center justify-between gap-3 border-t border-rule/50 px-5 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={13} aria-hidden="true" />
              {uploading > 0 ? `Uploading ${uploading} ${uploading === 1 ? 'image' : 'images'}…` : 'Paste, drop or click to add images'}
            </button>
            <span className="hidden sm:inline">{mode === 'live' ? 'Saved as Markdown' : 'Markdown supported'}</span>
          </div>
        )}
      </div>
      {help}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          void uploadFiles(files);
        }}
      />
      {linking && (
        <ReferencePicker
          exclude={[]}
          locale={locale}
          onClose={() => setLinking(false)}
          onPick={(documentId) => {
            setLinking(false);
            void linkEntry(documentId).catch((failure) =>
              toast('error', failure instanceof Error ? failure.message : 'The link couldn’t be made.'),
            );
          }}
        />
      )}
      {videoUrl !== null && (
        <Modal
          title="Embed a video"
          description="Paste a YouTube or Vimeo link. Your website shows the player; the preview here shows a card."
          size="sm"
          onClose={() => setVideoUrl(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVideoUrl(null)}>
                Cancel
              </Button>
              <Button
                disabled={!videoEmbed(videoUrl)}
                onClick={() => {
                  const url = videoUrl.trim();
                  setVideoUrl(null);
                  if (mode === 'live' && liveEditor) liveEditor.chain().focus().insertVideo(url).run();
                  else atSaved((text, start, end) => insertBlock(text, start, end, url));
                }}
              >
                Insert video
              </Button>
            </div>
          }
        >
          <Input
            label="Video link"
            autoFocus
            placeholder="https://www.youtube.com/watch?v=…"
            value={videoUrl}
            onChange={(event) => setVideoUrl(event.target.value)}
            error={videoUrl.trim() && !videoEmbed(videoUrl) ? 'Use a YouTube or Vimeo link' : undefined}
          />
        </Modal>
      )}
      {picking && (
        <MediaPicker
          multiple
          groups={['image']}
          onClose={() => setPicking(false)}
          onPick={(_, assets) => {
            setPicking(false);
            if (assets.length === 0) return;
            if (mode === 'live') {
              insertLiveImages(assets.map((asset) => ({ src: asset.url, alt: asset.altText ?? asset.title ?? baseName(asset.fileName) })));
              return;
            }
            const block = assets
              .map((asset) => imageMarkdown(asset.altText ?? asset.title ?? baseName(asset.fileName), asset.url))
              .join('\n\n');
            const at = savedSelection.current ?? { start: latest.current.length, end: latest.current.length };
            // After the picker unmounts, so focus and selection land back in the text.
            requestAnimationFrame(() => apply(insertBlock(latest.current, at.start, at.end, block)));
          }}
        />
      )}
    </div>
  );
}
