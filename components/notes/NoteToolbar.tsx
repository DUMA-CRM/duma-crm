'use client';

import { type Editor, useEditorState } from '@tiptap/react';
import { type ComponentProps, useEffect, useId, useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import { assetSrc } from '@/components/cms/shared';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  CodeBlock,
  Columns2,
  Columns3,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  ImagePlus,
  Italic,
  Link2,
  ListBullet,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo,
  Strikethrough,
  Table,
  TextClear,
  TextColor,
  Underline,
  Undo,
  UploadCloud,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { cn } from '@/lib/utils/cn';
import { NOTE_COLOURS, type NoteColour, normaliseNoteLink, noteColourOf, noteColourValue, noteMediaKind } from '@/lib/utils/note-editor';
import { useAuthStore } from '@/stores/authStore';

import { insertMediaFiles } from './RichNoteEditor';

// ---------------------------------------------------------------------------
// The note's formatting, in one row inside the note's own bar. Block style,
// alignment, colour, link and media are small menus, so everything fits on
// one line; a narrow screen scrolls the row rather than wrapping it.
// Every control keeps the editor's focus (mousedown is prevented, menus don't
// take focus), so the selection being formatted never disappears.
// ---------------------------------------------------------------------------

type Align = 'left' | 'center' | 'right';

const BLOCKS = [
  { key: 'text', label: 'Text', icon: Pilcrow },
  { key: 'h1', label: 'Title', icon: Heading1 },
  { key: 'h2', label: 'Heading', icon: Heading2 },
  { key: 'h3', label: 'Subheading', icon: Heading3 },
  { key: 'quote', label: 'Quote', icon: Quote },
] as const;
type BlockKey = (typeof BLOCKS)[number]['key'];

const ALIGNS: { key: Align; label: string; icon: IconComponent }[] = [
  { key: 'left', label: 'Align left', icon: AlignLeft },
  { key: 'center', label: 'Centre', icon: AlignCenter },
  { key: 'right', label: 'Align right', icon: AlignRight },
];

const colourName = (colour: NoteColour) => colour[0]!.toUpperCase() + colour.slice(1);

/** Keep the caret in the note: a toolbar click must not blur the editor. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();
const noAutoFocus = (event: Event) => event.preventDefault();

export function NoteToolbar({
  editor,
  onUploadMedia,
}: {
  editor: Editor;
  /** Saves a photo or video from this device into Content's media library; null when that isn't possible. */
  onUploadMedia: ((file: File) => Promise<string>) | null;
}) {
  const fileInputId = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const capabilities = useAuthStore((store) => store.capabilities);
  const { contentEnabled } = useCatalogWords();
  // Content's media library: the module on, and Media readable (`cms:read`, as the API checks).
  const canUseContent = contentEnabled && hasCapability(capabilities, 'cms:read');

  // Re-render on selection and content, so the active states follow the caret.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      block: (current.isActive('heading', { level: 1 })
        ? 'h1'
        : current.isActive('heading', { level: 2 })
          ? 'h2'
          : current.isActive('heading', { level: 3 })
            ? 'h3'
            : current.isActive('blockquote')
              ? 'quote'
              : 'text') as BlockKey,
      align: ((['center', 'right'] as const).find((value) => current.isActive({ textAlign: value })) ?? 'left') as Align,
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      underline: current.isActive('underline'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock'),
      link: current.isActive('link'),
      textColour: noteColourOf('text', current.getAttributes('textStyle').color),
      markColour: current.isActive('highlight') ? (noteColourOf('mark', current.getAttributes('highlight').color) ?? 'yellow') : null,
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      task: current.isActive('taskList'),
      table: current.isActive('table'),
      columns: current.isActive('columns') ? (current.getAttributes('columns').count as number) : 0,
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  // ⌘K for a link, as Notes does. (⇧⌘L for a checklist is the editor's own shortcut.)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!editor.isFocused || !(event.metaKey || event.ctrlKey) || event.shiftKey) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setLinkOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor]);

  const setBlock = (key: BlockKey) => {
    const chain = editor.chain().focus();
    if (key === 'text') chain.clearNodes().setParagraph().run();
    else if (key === 'quote') chain.toggleBlockquote().run();
    else chain.setHeading({ level: key === 'h1' ? 1 : key === 'h2' ? 2 : 3 }).run();
  };

  const block = BLOCKS.find((entry) => entry.key === state.block) ?? BLOCKS[0];
  const align = ALIGNS.find((entry) => entry.key === state.align) ?? ALIGNS[0]!;

  return (
    <div role="toolbar" aria-label="Formatting" className="flex w-max items-center gap-0.5">
      <Popover>
        <Tooltip side="bottom" label="Text style">
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={keepFocus}
              className="flex h-8 w-30 items-center justify-between gap-1 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-band"
            >
              <span className="truncate">{block.label}</span>
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent className="w-48 p-1" onOpenAutoFocus={noAutoFocus} onCloseAutoFocus={noAutoFocus}>
          {BLOCKS.map((entry) => (
            <MenuOption
              key={entry.key}
              icon={entry.icon}
              label={entry.label}
              selected={entry.key === state.block}
              onSelect={() => setBlock(entry.key)}
              className={cn(entry.key === 'h1' && 'text-base font-bold', (entry.key === 'h2' || entry.key === 'h3') && 'font-semibold')}
            />
          ))}
        </PopoverContent>
      </Popover>

      <Separator />
      <ToolButton label="Bold" shortcut="⌘B" icon={Bold} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton
        label="Italic"
        shortcut="⌘I"
        icon={Italic}
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Underline"
        shortcut="⌘U"
        icon={Underline}
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        label="Strikethrough"
        shortcut="⇧⌘S"
        icon={Strikethrough}
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolButton
        label="Inline code"
        shortcut="⌘E"
        icon={Code}
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <ToolButton
        label="Code block"
        shortcut="⌥⌘C"
        icon={CodeBlock}
        active={state.codeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ColourMenu editor={editor} textColour={state.textColour} markColour={state.markColour} />

      <Separator />
      <ToolButton
        label="Checklist"
        shortcut="⇧⌘L"
        icon={ListChecks}
        active={state.task}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
      <ToolButton
        label="Bulleted list"
        shortcut="⇧⌘8"
        icon={ListBullet}
        active={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        label="Numbered list"
        shortcut="⇧⌘7"
        icon={ListOrdered}
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Popover>
        <Tooltip side="bottom" label="Alignment">
          <PopoverTrigger asChild>
            <ToolButton label="Alignment" icon={align.icon} active={state.align !== 'left'} menu />
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent className="flex w-auto gap-0.5 p-1" onOpenAutoFocus={noAutoFocus} onCloseAutoFocus={noAutoFocus}>
          {ALIGNS.map((entry) => (
            <ToolButton
              key={entry.key}
              label={entry.label}
              icon={entry.icon}
              active={state.align === entry.key}
              onClick={() =>
                entry.key === 'left' ? editor.chain().focus().unsetTextAlign().run() : editor.chain().focus().setTextAlign(entry.key).run()
              }
            />
          ))}
        </PopoverContent>
      </Popover>

      <Separator />
      <LinkMenu editor={editor} open={linkOpen} onOpenChange={setLinkOpen} active={state.link} />
      <ToolButton
        label={state.table ? 'Edit the table from the bar above it' : 'Table'}
        icon={Table}
        active={state.table}
        onClick={() => {
          if (state.table) editor.chain().focus().run();
          else editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }}
      />
      {(onUploadMedia || canUseContent) && (
        <Popover>
          <Tooltip side="bottom" label="Photo or video">
            <PopoverTrigger asChild>
              <ToolButton label="Photo or video" icon={ImagePlus} menu />
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent className="w-60 p-1" onOpenAutoFocus={noAutoFocus} onCloseAutoFocus={noAutoFocus}>
            {onUploadMedia && (
              <MenuOption
                icon={UploadCloud}
                label="Upload from this device"
                hint="Saved to Content → Media, in Notes"
                onSelect={() => document.getElementById(fileInputId)?.click()}
              />
            )}
            {canUseContent && (
              <MenuOption
                icon={ImageIcon}
                label="From Content"
                hint="Photos and videos in your media library"
                onSelect={() => setPicking(true)}
              />
            )}
          </PopoverContent>
        </Popover>
      )}
      <Popover>
        <Tooltip side="bottom" label="Side by side">
          <PopoverTrigger asChild>
            <ToolButton label="Side by side" icon={Columns2} active={state.columns > 0} menu />
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent className="w-56 p-1" onOpenAutoFocus={noAutoFocus} onCloseAutoFocus={noAutoFocus}>
          <MenuOption
            icon={Columns2}
            label="2 in a row"
            hint={state.columns ? undefined : 'This paragraph goes in the first'}
            selected={state.columns === 2}
            onSelect={() => editor.chain().focus().setColumns(2).run()}
          />
          <MenuOption
            icon={Columns3}
            label="3 in a row"
            selected={state.columns === 3}
            onSelect={() => editor.chain().focus().setColumns(3).run()}
          />
          {state.columns > 0 && (
            <MenuOption
              icon={Pilcrow}
              label="One column"
              hint="Stack everything again"
              onSelect={() => editor.chain().focus().unsetColumns().run()}
            />
          )}
        </PopoverContent>
      </Popover>
      <ToolButton label="Divider" icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />

      <Separator />
      <ToolButton
        label="Clear formatting"
        icon={TextClear}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run()}
      />
      <ToolButton label="Undo" shortcut="⌘Z" icon={Undo} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <ToolButton label="Redo" shortcut="⇧⌘Z" icon={Redo} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />

      <input
        id={fileInputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        className="hidden"
        onChange={(event) => {
          if (onUploadMedia) insertMediaFiles(editor, [...(event.target.files ?? [])], onUploadMedia, true);
          event.currentTarget.value = '';
        }}
      />
      {picking && (
        <MediaPicker
          multiple
          groups={['image', 'video']}
          onClose={() => setPicking(false)}
          onPick={(_, assets) => {
            setPicking(false);
            // The keyless delivery URL through /be: a note shared with someone
            // who can't open Content still shows it (UI-ADR-031).
            const nodes = assets.flatMap((asset): { type: string; attrs: Record<string, string> }[] => {
              const kind = noteMediaKind(asset.mimeType);
              const src = assetSrc(asset.url);
              if (kind === 'image') return [{ type: 'image', attrs: { src, alt: asset.altText ?? asset.title ?? asset.fileName } }];
              if (kind === 'video') return [{ type: 'video', attrs: { src, title: asset.title ?? asset.fileName } }];
              return [];
            });
            if (nodes.length > 0) requestAnimationFrame(() => editor.chain().focus().insertContent(nodes).run());
          }}
        />
      )}
    </div>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-rule/60" aria-hidden="true" />;
}

/** One icon control. Spreads the rest so it can be a popover's trigger. */
function ToolButton({
  label,
  shortcut,
  icon: Icon,
  active,
  menu = false,
  className,
  ...props
}: {
  label: string;
  shortcut?: string;
  icon: IconComponent;
  active?: boolean;
  /** Opens a menu: no tooltip of its own (the trigger's wrapper has it). */
  menu?: boolean;
} & Omit<ComponentProps<'button'>, 'children'>) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={menu ? undefined : (active ?? undefined)}
      onMouseDown={keepFocus}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35 data-[state=open]:bg-band data-[state=open]:text-foreground',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
        className,
      )}
      {...props}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
  if (menu) return button;
  return (
    <Tooltip side="bottom" label={shortcut ? `${label} (${shortcut})` : label}>
      {button}
    </Tooltip>
  );
}

function MenuOption({
  icon: Icon,
  label,
  hint,
  selected,
  onSelect,
  className,
}: {
  icon: IconComponent;
  label: string;
  hint?: string;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', className)}>{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {selected && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
    </button>
  );
}

/**
 * Text colour and highlight, in Notion's palette. The swatches are theme
 * variables, so a red word is a readable red in dark mode too.
 */
function ColourMenu({ editor, textColour, markColour }: { editor: Editor; textColour: NoteColour | null; markColour: NoteColour | null }) {
  return (
    <Popover>
      <Tooltip side="bottom" label="Text colour and highlight (⇧⌘H highlights)">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Text colour and highlight"
            onMouseDown={keepFocus}
            className={cn(
              'flex size-8 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-band',
              (textColour || markColour) && 'text-foreground',
            )}
          >
            <TextColor size={15} aria-hidden="true" style={textColour ? { color: noteColourValue('text', textColour) } : undefined} />
            {/* The bar shows the highlight under the caret, as Docs does. */}
            <span
              className="h-0.75 w-4 rounded-full bg-rule/70"
              style={markColour ? { background: noteColourValue('mark', markColour) } : undefined}
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-64 p-3" onOpenAutoFocus={noAutoFocus} onCloseAutoFocus={noAutoFocus}>
        <p className="mb-2 text-label uppercase text-muted-foreground">Text</p>
        <div className="grid grid-cols-5 gap-1.5">
          <Swatch label="Default" selected={!textColour} onSelect={() => editor.chain().focus().unsetColor().run()}>
            <span className="text-sm font-semibold text-foreground">A</span>
          </Swatch>
          {NOTE_COLOURS.map((colour) => (
            <Swatch
              key={colour}
              label={colourName(colour)}
              selected={textColour === colour}
              onSelect={() => editor.chain().focus().setColor(noteColourValue('text', colour)).run()}
            >
              <span className="text-sm font-semibold" style={{ color: noteColourValue('text', colour) }}>
                A
              </span>
            </Swatch>
          ))}
        </div>
        <p className="mb-2 mt-3 text-label uppercase text-muted-foreground">Highlight</p>
        <div className="grid grid-cols-5 gap-1.5">
          <Swatch label="No highlight" selected={!markColour} onSelect={() => editor.chain().focus().unsetHighlight().run()}>
            <span className="block h-px w-5 rotate-[-35deg] bg-muted-foreground" />
          </Swatch>
          {NOTE_COLOURS.map((colour) => (
            <Swatch
              key={colour}
              label={`${colourName(colour)} highlight`}
              selected={markColour === colour}
              onSelect={() =>
                editor
                  .chain()
                  .focus()
                  .setHighlight({ color: noteColourValue('mark', colour) })
                  .run()
              }
              style={{ background: noteColourValue('mark', colour) }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Swatch({
  label,
  selected,
  onSelect,
  style,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip side="top" label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onMouseDown={keepFocus}
        onClick={onSelect}
        style={style}
        className={cn(
          'flex size-9 items-center justify-center rounded-md border border-rule/60 bg-card transition-[box-shadow,border-color] hover:border-rule focus-visible:outline-2 focus-visible:outline-ring',
          selected && 'border-primary ring-2 ring-primary/35',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Add, change or remove a link — in place, instead of a browser prompt. */
function LinkMenu({
  editor,
  open,
  onOpenChange,
  active,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: boolean;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip side="bottom" label="Link (⌘K)">
        <PopoverTrigger asChild>
          <ToolButton label="Link" icon={Link2} active={active} menu />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80 p-2" onCloseAutoFocus={noAutoFocus}>
        <LinkForm editor={editor} active={active} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Mounted each time the menu opens, so it starts from the link under the caret. */
function LinkForm({ editor, active, onDone }: { editor: Editor; active: boolean; onDone: () => void }) {
  const [value, setValue] = useState(() => (editor.getAttributes('link').href as string | undefined) ?? '');
  const [invalid, setInvalid] = useState(false);

  const apply = () => {
    const href = normaliseNoteLink(value);
    if (!href) {
      if (value.trim()) {
        setInvalid(true);
        return;
      }
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else if (editor.state.selection.empty && !active) {
      // Nothing selected: the link is its own text.
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: value.trim(), marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onDone();
  };

  return (
    <>
      <form
        className="flex items-start gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            autoFocus
            aria-label="Link address"
            placeholder="Paste a link or an email address"
            value={value}
            error={invalid ? 'That link can’t be used.' : undefined}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            className="h-8"
          />
        </div>
        <Button type="submit" size="sm">
          {active ? 'Save' : 'Add'}
        </Button>
      </form>
      {active && (
        <div className="mt-1.5 flex items-center gap-1 border-t border-rule/50 pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1"
            onClick={() => window.open(editor.getAttributes('link').href as string, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink aria-hidden="true" /> Open
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-exception hover:text-exception"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              onDone();
            }}
          >
            Remove link
          </Button>
        </div>
      )}
    </>
  );
}
