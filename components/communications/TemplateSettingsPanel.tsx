'use client';

import { motion } from 'motion/react';
import { useState } from 'react';

import { Mascot } from '@/components/ai/Mascot';
import { SectionInfo } from '@/components/shared/rows';
import {
  AlignLeft,
  ArrowLeft,
  Code,
  ExternalLink,
  Eye,
  FileText,
  Heading,
  ImageIcon,
  ImagePlus,
  LayoutGrid,
  Link2,
  Mail,
  Maximize,
  Plus,
  Share2,
  Tag,
  Trash2,
  Type,
  Zap,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { ChangeRow, ValueMissing } from '@/components/settings/controls';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import { cn } from '@/lib/utils/cn';
import { imageHost } from '@/lib/utils/email-images';

import { EmailImage } from './EmailImage';
import { VariablePalette } from './VariablePalette';
import { COLUMN_LAYOUTS, type TemplateBlock, type TemplateDesign, isColumnsBlock, relayoutColumns } from './templateDesign';

/** Sections rise in one after another, as in the Content editors. */
const STAGGER = { shown: { transition: { staggerChildren: 0.06 } } };

/** Most inboxes cut the preview line around here. */
const PREHEADER_LIMIT = 90;

const FONTS: { value: TemplateDesign['styles']['fontFamily']; label: string }[] = [
  { value: 'Arial', label: 'Arial — clean, modern' },
  { value: 'Verdana', label: 'Verdana — wide, easy to read' },
  { value: 'Georgia', label: 'Georgia — classic serif' },
];

const COLOURS: { key: 'backgroundColor' | 'contentColor' | 'textColor' | 'accentColor'; title: string }[] = [
  { key: 'accentColor', title: 'Buttons and links' },
  { key: 'textColor', title: 'Text' },
  { key: 'contentColor', title: 'Email body' },
  { key: 'backgroundColor', title: 'Page background' },
];

const BLOCK_META: Record<TemplateBlock['type'], { label: string; icon: IconComponent; about: string }> = {
  heading: { label: 'Heading', icon: Heading, about: 'Type straight on the email to change the words.' },
  text: { label: 'Text', icon: FileText, about: 'Type straight on the email to change the words.' },
  button: { label: 'Button', icon: Link2, about: 'The label is typed on the button itself. Its colour is your brand colour.' },
  image: { label: 'Image', icon: ImageIcon, about: 'Pick one from Media, upload a picture, or link to one already online.' },
  divider: { label: 'Divider', icon: AlignLeft, about: 'A thin line between sections.' },
  spacer: { label: 'Spacer', icon: Maximize, about: 'Empty space between blocks.' },
  social: { label: 'Social links', icon: Share2, about: 'Where customers can find you.' },
  html: {
    label: 'Custom HTML',
    icon: Code,
    about: 'Sent exactly as written. Inline styles are the safest — many inboxes drop <style> tags.',
  },
  columns: {
    label: 'Column row',
    icon: LayoutGrid,
    about: 'Add content to each column with its +. Changing the split keeps what is in them.',
  },
};

const ALIGN_OPTIONS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Centre' },
  { value: 'right' as const, label: 'Right' },
];

const TEXTAREA_CLASS =
  'w-full rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus:border-primary disabled:opacity-60';

/** A row's value, cut to one line, or a quiet "not set". */
const shown = (value: string, missing: string) =>
  value.trim() ? <span className="truncate">{value}</span> : <ValueMissing>{missing}</ValueMissing>;

type EmailRow = 'subject' | 'preheader' | 'name' | 'category' | 'font';

/**
 * The editor's sidebar: titled cards of rows whose Change opens the control in
 * place, one at a time. With nothing selected it holds the email's own
 * settings; with a block selected, that block's — and a way back.
 */
export function TemplateSettingsPanel({
  selected,
  onDeselect,
  onBlockChange,
  onChooseImage,
  onBrowseMedia,
  name,
  onName,
  category,
  onCategory,
  categoryOptions,
  categoryHint,
  subject,
  onSubject,
  preheader,
  onPreheader,
  design,
  onStyles,
  variables,
  usedBy,
  onSuggestPreheader,
  preheaderAsk,
  readOnly,
  htmlMode,
}: {
  selected?: TemplateBlock;
  onDeselect: () => void;
  onBlockChange: (block: TemplateBlock) => void;
  /** Upload a file from this device into an image block. */
  onChooseImage: (blockId: string) => void;
  /** Pick from the media library; absent without Content or `cms:read`. */
  onBrowseMedia?: (blockId: string) => void;
  name: string;
  onName: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  categoryOptions: { value: string; label: string }[];
  categoryHint: string;
  subject: string;
  onSubject: (value: string) => void;
  preheader: string;
  onPreheader: (value: string) => void;
  design: TemplateDesign;
  onStyles: (patch: Partial<TemplateDesign['styles']>) => void;
  variables: string[];
  usedBy: { id: string; name: string; isEnabled: boolean }[];
  /** Ask DUMA for the preview line; absent for read-only viewers. */
  onSuggestPreheader?: () => void;
  /** Where that request stands, for the mascot. */
  preheaderAsk: { busy: boolean; failed: boolean; cheer: number };
  readOnly: boolean;
  htmlMode: boolean;
}) {
  // One row open at a time across the email's cards; a new template opens on what it still needs.
  const [open, setOpen] = useState<EmailRow | null>(() => (readOnly ? null : !subject.trim() ? 'subject' : !name.trim() ? 'name' : null));
  const toggle = (row: EmailRow) => setOpen((current) => (current === row ? null : row));

  if (selected && !htmlMode) {
    return (
      // Keyed by block, so picking another one replays the rise and folds its rows.
      <motion.div key={selected.id} initial="hidden" animate="shown" variants={STAGGER} className="flex flex-col gap-5">
        <BlockSettings
          block={selected}
          readOnly={readOnly}
          onChange={onBlockChange}
          onChooseImage={() => onChooseImage(selected.id)}
          onBrowseMedia={onBrowseMedia ? () => onBrowseMedia(selected.id) : undefined}
          onDeselect={onDeselect}
        />
      </motion.div>
    );
  }

  const preheaderLong = preheader.length > PREHEADER_LIMIT;
  const categoryLabel = categoryOptions.find((option) => option.value === category)?.label ?? category;

  return (
    <motion.div initial="hidden" animate="shown" variants={STAGGER} className="flex flex-col gap-5">
      <RecordGroup
        card
        id="template-inbox"
        title="Inbox"
        actions={<SectionInfo label="What people see in their inbox before they open the email." />}
      >
        <fieldset disabled={readOnly} className="min-w-0">
          <ChangeRow
            icon={Mail}
            label="Subject line"
            value={shown(subject, 'No subject yet')}
            tone={!subject.trim() && !readOnly ? 'warning' : undefined}
            open={open === 'subject'}
            onToggle={() => toggle('subject')}
            verbs={['Change', 'Done']}
          >
            <Input
              id="template-subject"
              aria-label="Subject line"
              value={subject}
              onChange={(event) => onSubject(event.target.value)}
              required
              autoFocus
              placeholder="Your order is ready"
            />
          </ChangeRow>
          <ChangeRow
            icon={Eye}
            label="Preview text"
            value={shown(preheader, 'None — the inbox shows the first words')}
            tone={preheaderLong ? 'warning' : undefined}
            open={open === 'preheader'}
            onToggle={() => toggle('preheader')}
            verbs={['Change', 'Done']}
          >
            <Input
              id="template-preheader"
              aria-label="Preview text"
              value={preheader}
              onChange={(event) => onPreheader(event.target.value)}
              autoFocus
              placeholder="The line shown after the subject"
              rightAction={
                onSuggestPreheader ? (
                  <Tooltip
                    side="top"
                    align="end"
                    label={preheader.trim() ? 'Ask DUMA to rewrite it from the email' : 'Ask DUMA to write it from the email'}
                  >
                    <button
                      type="button"
                      onClick={onSuggestPreheader}
                      disabled={preheaderAsk.busy}
                      aria-label={preheaderAsk.busy ? 'Writing the preview text…' : 'Ask DUMA to write the preview text'}
                      className="-mr-1 flex size-7 items-center justify-center rounded-md transition-colors hover:bg-band/60 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-wait"
                    >
                      <Mascot
                        size={22}
                        state={preheaderAsk.busy ? 'thinking' : undefined}
                        feeling={preheaderAsk.failed ? 'sad' : preheaderAsk.cheer ? 'happy' : 'curious'}
                        gesture={preheaderAsk.cheer ? 'celebrate' : undefined}
                        gestureKey={preheaderAsk.cheer}
                        fps={24}
                      />
                    </button>
                  </Tooltip>
                ) : undefined
              }
            />
            <p className={cn('mt-1.5 text-right text-xs tabular-nums text-muted-foreground', preheaderLong && 'font-medium text-measured')}>
              {preheaderLong
                ? `${preheader.length}/${PREHEADER_LIMIT} — most inboxes cut it here`
                : `${preheader.length}/${PREHEADER_LIMIT}`}
            </p>
          </ChangeRow>
        </fieldset>
      </RecordGroup>

      <RecordGroup card id="template-details" title="Template" actions={<SectionInfo label="Only your team sees these." />}>
        <fieldset disabled={readOnly} className="min-w-0">
          <ChangeRow
            icon={Type}
            label="Name"
            value={shown(name, 'Not named')}
            tone={!name.trim() && !readOnly ? 'warning' : undefined}
            open={open === 'name'}
            onToggle={() => toggle('name')}
            verbs={['Change', 'Done']}
          >
            <Input
              id="template-name"
              aria-label="Template name"
              value={name}
              onChange={(event) => onName(event.target.value)}
              required
              autoFocus
              placeholder="Order ready"
            />
          </ChangeRow>
          <ChangeRow
            icon={Tag}
            label="Category"
            value={categoryLabel}
            open={open === 'category'}
            onToggle={() => toggle('category')}
            verbs={['Change', 'Done']}
          >
            <Select
              value={category}
              onValueChange={onCategory}
              options={categoryOptions}
              ariaLabel="Template category"
              className="w-full"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{categoryHint}</p>
          </ChangeRow>
        </fieldset>
      </RecordGroup>

      {!htmlMode && (
        <RecordGroup card id="template-brand" title="Brand" actions={<SectionInfo label="Applies to the whole email." />}>
          <fieldset disabled={readOnly} className="min-w-0">
            {COLOURS.map((colour) => (
              <ColourRow
                key={colour.key}
                title={colour.title}
                value={design.styles[colour.key]}
                onChange={(value) => onStyles({ [colour.key]: value })}
              />
            ))}
            <ChangeRow
              icon={Type}
              label="Font"
              value={design.styles.fontFamily}
              open={open === 'font'}
              onToggle={() => toggle('font')}
              verbs={['Change', 'Done']}
            >
              <Select
                value={design.styles.fontFamily}
                onValueChange={(value) => onStyles({ fontFamily: value as TemplateDesign['styles']['fontFamily'] })}
                options={FONTS}
                ariaLabel="Font"
                className="w-full"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Safe in every inbox.</p>
            </ChangeRow>
          </fieldset>
        </RecordGroup>
      )}

      {!readOnly && variables.length > 0 && (
        <RecordGroup
          card
          id="template-personalise"
          title="Personalise"
          actions={<SectionInfo label="Each one is replaced with the real details when the email is sent." />}
        >
          <VariablePalette variables={variables} />
        </RecordGroup>
      )}

      {usedBy.length > 0 && (
        <RecordGroup card id="template-used-by" title="Used by" actions={<SectionInfo label="Automations that send this email." />}>
          {usedBy.map((item) => (
            // Not a link: leaving from here would skip the editor's unsaved-changes guard.
            <ChangeRow
              key={item.id}
              icon={Zap}
              label={item.isEnabled ? 'Sending' : 'Switched off'}
              value={<span className="truncate">{item.name}</span>}
            />
          ))}
        </RecordGroup>
      )}
    </motion.div>
  );
}

/** A brand colour, shaped like a `ChangeRow`: the swatch is the tile (and the picker), the hex is the value. */
function ColourRow({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-2.5 first:pt-0 has-[:disabled]:cursor-not-allowed">
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background p-1.5">
        <span
          className="size-full rounded-sm border border-black/10 dark:border-white/15"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={title}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label uppercase text-muted-foreground">{title}</span>
        <span className="mt-0.5 block font-mono text-sm font-semibold uppercase text-foreground">{value}</span>
      </span>
    </label>
  );
}

type BlockRow = 'image' | 'alt' | 'href' | 'url' | 'width' | 'height' | 'align' | 'split';

function BlockSettings({
  block,
  readOnly,
  onChange,
  onChooseImage,
  onBrowseMedia,
  onDeselect,
}: {
  block: TemplateBlock;
  readOnly: boolean;
  onChange: (block: TemplateBlock) => void;
  onChooseImage: () => void;
  onBrowseMedia?: () => void;
  onDeselect: () => void;
}) {
  const meta = BLOCK_META[block.type];
  // An image block with no picture opens on choosing one.
  const [open, setOpen] = useState<BlockRow | null>(() => (block.type === 'image' && !block.url ? 'image' : null));
  const toggle = (row: BlockRow) => setOpen((current) => (current === row ? null : row));

  const alignment =
    'align' in block ? (
      <ChangeRow
        icon={AlignLeft}
        label="Alignment"
        value={ALIGN_OPTIONS.find((option) => option.value === block.align)?.label ?? block.align}
        open={open === 'align'}
        onToggle={() => toggle('align')}
        verbs={['Change', 'Done']}
      >
        <SegmentedControl
          options={ALIGN_OPTIONS}
          value={block.align}
          onChange={(align) => onChange({ ...block, align })}
          ariaLabel="Alignment"
          className="w-full [&>button]:flex-1"
        />
      </ChangeRow>
    ) : null;

  let body: React.ReactNode = <p className="text-sm text-muted-foreground">Nothing else to set.</p>;

  if (block.type === 'heading' || block.type === 'text') body = alignment;

  if (block.type === 'button')
    body = (
      <>
        <ChangeRow
          icon={ExternalLink}
          label="Opens"
          value={shown(block.url, 'No link yet')}
          open={open === 'url'}
          onToggle={() => toggle('url')}
          verbs={['Change', 'Done']}
        >
          <Input
            id="block-button-url"
            aria-label="Where the button takes people"
            value={block.url}
            autoFocus
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://your-cafe.com/order"
          />
        </ChangeRow>
        {alignment}
      </>
    );

  if (block.type === 'image')
    body = (
      <>
        <ChangeRow
          icon={ImagePlus}
          label="Image"
          value={shown(block.url ? (imageHost(block.url) ?? block.url) : '', 'None chosen')}
          tone={!block.url && !readOnly ? 'warning' : undefined}
          open={open === 'image'}
          onToggle={() => toggle('image')}
          verbs={['Change', 'Done']}
        >
          <div className="space-y-3">
            {block.url && (
              <div className="overflow-hidden rounded-md border border-border bg-band/40 text-muted-foreground">
                <EmailImage url={block.url} alt="" className="mx-auto block max-h-36 w-full object-contain" />
              </div>
            )}
            {onBrowseMedia ? (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={onBrowseMedia}>
                  <ImageIcon aria-hidden="true" />
                  Media library
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={onChooseImage}>
                  <ImagePlus aria-hidden="true" />
                  Upload
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full gap-2" onClick={onChooseImage}>
                <ImagePlus aria-hidden="true" />
                {block.url ? 'Replace image' : 'Upload image'}
              </Button>
            )}
            <Input
              id="block-image-url"
              aria-label="Image link"
              value={block.url}
              onChange={(event) => onChange({ ...block, url: event.target.value })}
              placeholder="Or paste a link: https://"
            />
          </div>
        </ChangeRow>
        <ChangeRow
          icon={Type}
          label="Description"
          value={shown(block.alt, 'None')}
          open={open === 'alt'}
          onToggle={() => toggle('alt')}
          verbs={['Change', 'Done']}
        >
          <Input
            id="block-image-alt"
            aria-label="Image description"
            value={block.alt}
            autoFocus
            onChange={(event) => onChange({ ...block, alt: event.target.value })}
            placeholder="A flat white on the counter"
            hint="Shown when images are off, and read aloud to people who can’t see them."
          />
        </ChangeRow>
        <ChangeRow
          icon={ExternalLink}
          label="Opens"
          value={shown(block.href, 'Nothing')}
          open={open === 'href'}
          onToggle={() => toggle('href')}
          verbs={['Change', 'Done']}
        >
          <Input
            id="block-image-href"
            aria-label="Where the image takes people"
            value={block.href}
            autoFocus
            onChange={(event) => onChange({ ...block, href: event.target.value })}
            placeholder="https://"
          />
        </ChangeRow>
        <ChangeRow
          icon={Maximize}
          label="Width"
          value={`${block.width}%`}
          open={open === 'width'}
          onToggle={() => toggle('width')}
          verbs={['Change', 'Done']}
        >
          <Slider
            label="Width"
            aria-label="Image width"
            min={10}
            max={100}
            step={5}
            value={block.width}
            onValueChange={(width) => onChange({ ...block, width })}
            formatValue={(width) => `${width}%`}
          />
        </ChangeRow>
        {alignment}
      </>
    );

  if (block.type === 'spacer')
    body = (
      <ChangeRow
        icon={Maximize}
        label="Height"
        value={`${block.height}px`}
        open={open === 'height'}
        onToggle={() => toggle('height')}
        verbs={['Change', 'Done']}
      >
        <Slider
          label="Height"
          aria-label="Spacer height"
          min={8}
          max={120}
          step={4}
          value={block.height}
          onValueChange={(height) => onChange({ ...block, height })}
          formatValue={(height) => `${height}px`}
        />
      </ChangeRow>
    );

  if (isColumnsBlock(block))
    body = (
      <ChangeRow
        icon={LayoutGrid}
        label="Split"
        value={COLUMN_LAYOUTS.find((layout) => layout.value === block.layout)?.label ?? block.layout}
        open={open === 'split'}
        onToggle={() => toggle('split')}
        verbs={['Change', 'Done']}
      >
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(relayoutColumns(block, value))}
              aria-pressed={block.layout === value}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                block.layout === value ? 'border-primary/50 bg-primary/6' : 'border-border bg-background hover:border-primary/40',
              )}
            >
              <span className="flex h-6 w-full items-stretch gap-1" aria-hidden="true">
                {widths.map((width, index) => (
                  <span
                    key={index}
                    style={{ width: `${width}%` }}
                    className={cn('rounded-sm', block.layout === value ? 'bg-primary/25' : 'bg-band')}
                  />
                ))}
              </span>
              <span className="text-micro font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </ChangeRow>
    );

  if (block.type === 'html')
    body = (
      <textarea
        id="block-html"
        aria-label="HTML"
        value={block.html}
        onChange={(event) => onChange({ ...block, html: event.target.value })}
        spellCheck={false}
        className={cn(TEXTAREA_CLASS, 'min-h-80')}
      />
    );

  if (block.type === 'social')
    body = (
      <div className="space-y-3">
        {block.links.length === 0 && <p className="text-sm text-muted-foreground">No links yet.</p>}
        {block.links.map((link, index) => {
          const patch = (next: Partial<typeof link>) =>
            onChange({ ...block, links: block.links.map((item, position) => (position === index ? { ...item, ...next } : item)) });
          return (
            <div key={index} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Input
                  aria-label="Label"
                  value={link.label}
                  onChange={(event) => patch({ label: event.target.value })}
                  placeholder="Instagram"
                />
                <Input aria-label="Link" value={link.url} onChange={(event) => patch({ url: event.target.value })} placeholder="https://" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${link.label || 'link'}`}
                onClick={() => onChange({ ...block, links: block.links.filter((_, position) => position !== index) })}
                className="mt-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-dashed"
          onClick={() => onChange({ ...block, links: [...block.links, { label: 'Website', url: 'https://' }] })}
        >
          <Plus aria-hidden="true" /> Add link
        </Button>
      </div>
    );

  return (
    <RecordGroup
      card
      id="template-block"
      title={meta.label}
      actions={
        <Button type="button" variant="outline" size="sm" onClick={onDeselect}>
          <ArrowLeft aria-hidden="true" /> Email settings
        </Button>
      }
      footnote={meta.about}
    >
      <fieldset disabled={readOnly} className="min-w-0">
        {body}
      </fieldset>
    </RecordGroup>
  );
}
