'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';

import {
  Bold,
  Code,
  Columns2,
  Eye,
  FileText,
  Heading,
  ImagePlus,
  Info,
  Italic,
  Link2,
  ListBullet,
  ListChecks,
  ListOrdered,
  Paperclip,
  Pencil,
  Play,
  Quote,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl, type SegmentedOption } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { getCmsContentTypes, getCmsEntries, uploadCmsAsset } from '@/lib/modules/cms/client';
import { previewUrlFor } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  CALLOUT_KINDS,
  type CalloutKind,
  type TextEdit,
  applyEdit,
  continueList,
  imageMarkdown,
  insertBlock,
  insertCallout,
  insertLink,
  insertNamedLink,
  toggleLinePrefix,
  toggleWrap,
  uploadPlaceholder,
  videoEmbed,
} from '@/lib/utils/markdown-edit';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { MediaPicker } from './MediaPicker';
import { ReferencePicker } from './ReferencePicker';
import { RichTextPreview } from './RichTextPreview';
import { invalidateCms } from './shared';

type Mode = 'write' | 'preview' | 'split';
type Command = (text: string, start: number, end: number) => TextEdit;

const VIEW_OPTIONS: SegmentedOption<Mode>[] = [
  { value: 'write', label: 'Write', icon: Pencil },
  { value: 'preview', label: 'Preview', icon: Eye },
  { value: 'split', label: 'Split', icon: Columns2 },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const TOOLS: Array<{ label: string; icon: IconComponent; shortcut?: string; run: Command } | 'gap'> = [
  { label: 'Heading', icon: Heading, run: (t, s, e) => toggleLinePrefix(t, s, e, 'heading') },
  { label: 'Bold', icon: Bold, shortcut: 'B', run: (t, s, e) => toggleWrap(t, s, e, '**', 'bold text') },
  { label: 'Italic', icon: Italic, shortcut: 'I', run: (t, s, e) => toggleWrap(t, s, e, '_', 'italic text') },
  { label: 'Quote', icon: Quote, run: (t, s, e) => toggleLinePrefix(t, s, e, 'quote') },
  { label: 'Code', icon: Code, shortcut: 'E', run: (t, s, e) => toggleWrap(t, s, e, '`', 'code') },
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
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The caret when the picker opened — the dialog takes focus, the image still goes here.
  const savedSelection = useRef<{ start: number; end: number } | null>(null);
  const [mode, setMode] = useState<Mode>('write');
  const [picking, setPicking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [calloutOpen, setCalloutOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);

  // The text as it is right now. Programmatic edits update it immediately, so
  // two uploads finishing back to back each see the other's result.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
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

  const run = (command: Command) => {
    const element = textarea.current;
    if (!element || disabled) return;
    apply(command(latest.current, element.selectionStart, element.selectionEnd));
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
  const openPicker = () => {
    rememberSelection();
    setPicking(true);
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
      rows={14}
      spellCheck
      className="block min-h-72 w-full flex-1 resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
      value={value}
      disabled={disabled}
      placeholder={'## A heading\n\nWrite in Markdown. Paste or drop an image to put it right here.'}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
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
      {/* The view and the tools sit above the paper, not on it — the card is only the text. */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl<Mode> ariaLabel="Editor view" value={mode} onChange={setMode} options={VIEW_OPTIONS} />
        {mode !== 'preview' && editable && (
          <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
            {TOOLS.map((tool, index) =>
              tool === 'gap' ? (
                <span key={`gap-${index}`} className="mx-1 h-4 w-px bg-rule/60" aria-hidden="true" />
              ) : (
                <Tooltip side="top" key={tool.label} label={tool.shortcut ? `${tool.label} (${MOD}${tool.shortcut})` : tool.label}>
                  <button
                    type="button"
                    aria-label={tool.shortcut ? `${tool.label} (${MOD}${tool.shortcut})` : tool.label}
                    // Keep the textarea's selection: a mousedown on the button would otherwise blur it first.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => run(tool.run)}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
                  >
                    <tool.icon size={16} aria-hidden="true" />
                  </button>
                </Tooltip>
              ),
            )}
            <span className="mx-1 h-4 w-px bg-rule/60" aria-hidden="true" />
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={openPicker}
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-band"
            >
              <ImagePlus size={16} aria-hidden="true" /> Image
            </button>
            <Tooltip side="top" label="Link to another entry">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  rememberSelection();
                  setLinking(true);
                }}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-band"
              >
                <FileText size={16} aria-hidden="true" /> Entry
              </button>
            </Tooltip>
            <Popover open={calloutOpen} onOpenChange={setCalloutOpen}>
              <PopoverTrigger
                onMouseDown={(event) => {
                  event.preventDefault();
                  rememberSelection();
                }}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-band"
              >
                <Info size={16} aria-hidden="true" /> Callout
              </PopoverTrigger>
              <PopoverContent align="end" className="w-40 p-1">
                {CALLOUT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="block w-full rounded-sm px-2.5 py-1.5 text-left text-sm capitalize hover:bg-band"
                    onClick={() => {
                      setCalloutOpen(false);
                      atSaved((text, start, end) => insertCallout(text, start, end, kind as CalloutKind));
                    }}
                  >
                    {kind.toLowerCase()}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Tooltip side="top" label="Embed a YouTube or Vimeo video">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  rememberSelection();
                  setVideoUrl('');
                }}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-band"
              >
                <Play size={16} aria-hidden="true" /> Video
              </button>
            </Tooltip>
          </div>
        )}
      </div>
      {/* The paper: the text (or preview) and the upload strip at its foot. */}
      <div
        className={cn(
          'mt-2 overflow-hidden rounded-lg border transition-colors focus-within:border-primary/60',
          paper,
          error ? 'border-exception' : 'border-rule',
          dragging && 'border-primary ring-2 ring-primary/15',
        )}
        onDragOver={(event) => {
          if (!editable || mode === 'preview' || !event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          if (!editable || mode === 'preview' || event.dataTransfer.files.length === 0) return;
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
        {mode === 'write' && textArea}
        {mode === 'preview' && preview}
        {mode === 'split' && (
          <div className="grid lg:grid-cols-2">
            <div className="flex flex-col">{textArea}</div>
            <div className="border-t border-rule/50 lg:border-l lg:border-t-0">{preview}</div>
          </div>
        )}

        {editable && mode !== 'preview' && (
          <div className="flex items-center justify-between gap-3 border-t border-dashed border-rule/60 px-4 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={13} aria-hidden="true" />
              {uploading > 0 ? `Uploading ${uploading} ${uploading === 1 ? 'image' : 'images'}…` : 'Paste, drop or click to add images'}
            </button>
            <span className="hidden sm:inline">Markdown supported</span>
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
                  atSaved((text, start, end) => insertBlock(text, start, end, url));
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
