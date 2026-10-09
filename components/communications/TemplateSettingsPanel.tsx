'use client';

import { motion } from 'motion/react';

import { Mascot } from '@/components/ai/Mascot';
import { ActionRow, ActionRows, FieldRow, InfoRow, InfoRows, RowTile, SectionInfo } from '@/components/cms/rows';
import {
  AlignLeft,
  ArrowLeft,
  Braces,
  Code,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Heading,
  ImageIcon,
  ImagePlus,
  LayoutGrid,
  Link2,
  Mail,
  Maximize,
  Plus,
  Send,
  Share2,
  Tag,
  Trash2,
  Type,
  Zap,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatusDot } from '@/components/shared/StatusDot';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import { cn } from '@/lib/utils/cn';

import { ExpandRow } from './ExpandRow';
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
  image: { label: 'Image', icon: ImageIcon, about: 'Upload a picture or link to one already online.' },
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
    about: 'Drag content from the left into each column. Changing the split keeps what is in them.',
  },
};

const ALIGN_OPTIONS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Centre' },
  { value: 'right' as const, label: 'Right' },
];

const TEXTAREA_CLASS =
  'w-full rounded-md border border-rule/60 bg-background p-3 font-mono text-xs outline-none focus:border-primary disabled:opacity-60';

/**
 * The editor's right rail, in the Content editors' vocabulary: compact titled
 * cards whose explanation sits behind an ⓘ, rows led by an outlined icon tile,
 * and an Actions list at the foot. With nothing selected it holds the email's
 * own settings; with a block selected, that block's — and a way back.
 */
export function TemplateSettingsPanel({
  selected,
  onDeselect,
  onBlockChange,
  onChooseImage,
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
  canDelete,
  onDelete,
  onPreview,
  onSendTest,
  onSuggestPreheader,
  preheaderAsk,
  sendTestBlocked,
  readOnly,
  htmlMode,
}: {
  selected?: TemplateBlock;
  onDeselect: () => void;
  onBlockChange: (block: TemplateBlock) => void;
  onChooseImage: (blockId: string) => void;
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
  canDelete: boolean;
  onDelete: () => void;
  onPreview: () => void;
  /** Ask DUMA for the preview line; absent for read-only viewers. */
  onSuggestPreheader?: () => void;
  /** Where that request stands, for the mascot. */
  preheaderAsk: { busy: boolean; failed: boolean; cheer: number };
  /** Absent without email.send. */
  onSendTest?: () => void;
  sendTestBlocked: boolean;
  readOnly: boolean;
  htmlMode: boolean;
}) {
  if (selected && !htmlMode) {
    return (
      // Keyed by block, so picking another one replays the rise.
      <motion.div key={selected.id} initial="hidden" animate="shown" variants={STAGGER} className="flex flex-col gap-4 p-4">
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
          <BlockSettings
            block={selected}
            onChange={onBlockChange}
            onChooseImage={() => onChooseImage(selected.id)}
            onDeselect={onDeselect}
          />
        </fieldset>
      </motion.div>
    );
  }

  const preheaderLong = preheader.length > PREHEADER_LIMIT;

  return (
    <motion.div initial="hidden" animate="shown" variants={STAGGER} className="flex flex-col gap-4 p-4">
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
        <SettingsSection title="Inbox" actions={<SectionInfo label="What people see in their inbox before they open the email." />}>
          <div className="space-y-4">
            <ExpandRow icon={Mail} title="Subject line" htmlFor="template-subject" value={subject}>
              <Input
                id="template-subject"
                value={subject}
                onChange={(event) => onSubject(event.target.value)}
                required
                placeholder="Your order is ready"
              />
            </ExpandRow>
            <ExpandRow icon={Eye} title="Preview text" htmlFor="template-preheader" value={preheader} warn={preheaderLong}>
              <Input
                id="template-preheader"
                value={preheader}
                onChange={(event) => onPreheader(event.target.value)}
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
              <p className={cn('text-right text-xs tabular-nums text-muted-foreground', preheaderLong && 'font-medium text-measured')}>
                {preheaderLong
                  ? `${preheader.length}/${PREHEADER_LIMIT} — most inboxes cut it here`
                  : `${preheader.length}/${PREHEADER_LIMIT}`}
              </p>
            </ExpandRow>
          </div>
        </SettingsSection>

        <SettingsSection title="Template" actions={<SectionInfo label="Only your team sees these." />}>
          <div className="space-y-4">
            <ExpandRow icon={Type} title="Name" htmlFor="template-name" value={name}>
              <Input id="template-name" value={name} onChange={(event) => onName(event.target.value)} required placeholder="Order ready" />
            </ExpandRow>
            <ExpandRow icon={Tag} title="Category" value={categoryOptions.find((option) => option.value === category)?.label ?? category}>
              <Select
                value={category}
                onValueChange={onCategory}
                options={categoryOptions}
                ariaLabel="Template category"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{categoryHint}</p>
            </ExpandRow>
          </div>
        </SettingsSection>

        {!htmlMode && (
          <SettingsSection title="Brand" actions={<SectionInfo label="Applies to the whole email." />}>
            <div className="space-y-4">
              <InfoRows>
                {COLOURS.map((colour) => (
                  <ColourRow
                    key={colour.key}
                    title={colour.title}
                    value={design.styles[colour.key]}
                    onChange={(value) => onStyles({ [colour.key]: value })}
                  />
                ))}
              </InfoRows>
              <div className="border-t border-rule/40 pt-4">
                <FieldRow icon={Type} title="Font" note="Safe in every inbox">
                  <Select
                    value={design.styles.fontFamily}
                    onValueChange={(value) => onStyles({ fontFamily: value as TemplateDesign['styles']['fontFamily'] })}
                    options={FONTS}
                    ariaLabel="Font"
                    className="w-full"
                  />
                </FieldRow>
              </div>
            </div>
          </SettingsSection>
        )}
      </fieldset>

      {!readOnly && variables.length > 0 && (
        <SettingsSection
          title="Personalise"
          actions={
            <SectionInfo label="Click one to copy it, then paste it into the subject, preview text or the email. Each is replaced with real details when the email is sent." />
          }
        >
          <VariablePalette variables={variables} />
        </SettingsSection>
      )}

      {usedBy.length > 0 && (
        <SettingsSection title="Used by" actions={<SectionInfo label="Automations that send this email." />}>
          <InfoRows>
            {usedBy.map((item) => (
              // Not a link: leaving from here would skip the editor's unsaved-changes guard.
              <InfoRow key={item.id} icon={Zap} title={item.name}>
                <StatusDot tone={item.isEnabled ? 'success' : 'muted'} label={item.isEnabled ? 'Sending' : 'Switched off'} />
                <span className="text-xs text-muted-foreground" aria-hidden="true">
                  {item.isEnabled ? 'Sending' : 'Off'}
                </span>
              </InfoRow>
            ))}
          </InfoRows>
        </SettingsSection>
      )}

      <SettingsSection title="Actions">
        <ActionRows danger={canDelete ? <ActionRow icon={Trash2} label="Delete template" danger onClick={onDelete} /> : undefined}>
          <ActionRow icon={Eye} label="Preview in an inbox" onClick={onPreview} />
          {onSendTest && <ActionRow icon={Send} label="Send a test email" disabled={sendTestBlocked} onClick={onSendTest} />}
        </ActionRows>
      </SettingsSection>
    </motion.div>
  );
}

/** A brand colour as a row: the swatch is the tile (and the picker), the hex on the right. */
function ColourRow({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 has-[:disabled]:cursor-not-allowed">
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background p-1">
          <span className="size-full rounded-sm border border-black/10" style={{ backgroundColor: value }} aria-hidden="true" />
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={title}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
      </span>
      <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">{value}</span>
    </label>
  );
}

function BlockSettings({
  block,
  onChange,
  onChooseImage,
  onDeselect,
}: {
  block: TemplateBlock;
  onChange: (block: TemplateBlock) => void;
  onChooseImage: () => void;
  onDeselect: () => void;
}) {
  const meta = BLOCK_META[block.type];

  // The block's identity card: which block, what it is for, and the way back.
  const header = (
    <SettingsSection
      title="Block"
      actions={
        <Button type="button" variant="ghost" size="sm" className="-mr-2 gap-1.5 text-muted-foreground" onClick={onDeselect}>
          <ArrowLeft aria-hidden="true" /> Email settings
        </Button>
      }
    >
      <div className="flex items-start gap-3">
        <RowTile icon={meta.icon} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{meta.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{meta.about}</p>
        </div>
      </div>
    </SettingsSection>
  );

  const alignment =
    'align' in block ? (
      <FieldRow icon={AlignLeft} title="Alignment">
        <SegmentedControl
          options={ALIGN_OPTIONS}
          value={block.align}
          onChange={(align) => onChange({ ...block, align })}
          ariaLabel="Alignment"
          className="w-full [&>button]:flex-1"
        />
      </FieldRow>
    ) : null;

  if (block.type === 'heading' || block.type === 'text')
    return (
      <>
        {header}
        <SettingsSection title="Layout">{alignment}</SettingsSection>
      </>
    );

  if (block.type === 'button')
    return (
      <>
        {header}
        <SettingsSection title="Button">
          <div className="space-y-4">
            <FieldRow icon={ExternalLink} title="Opens" htmlFor="block-button-url" note="Where it takes people">
              <Input
                id="block-button-url"
                value={block.url}
                onChange={(event) => onChange({ ...block, url: event.target.value })}
                placeholder="https://your-cafe.com/order"
              />
            </FieldRow>
            {alignment}
          </div>
        </SettingsSection>
      </>
    );

  if (block.type === 'image')
    return (
      <>
        {header}
        <SettingsSection title="Image">
          <div className="space-y-4">
            {block.url && (
              <div className="overflow-hidden rounded-md border border-rule/60 bg-band/40">
                {/* eslint-disable-next-line @next/next/no-img-element -- any URL the sender pastes, not an optimisable asset */}
                <img src={block.url} alt="" className="mx-auto max-h-36 object-contain" />
              </div>
            )}
            <Button type="button" variant="outline" className="w-full gap-2" onClick={onChooseImage}>
              <ImagePlus aria-hidden="true" />
              {block.url ? 'Replace image' : 'Upload image'}
            </Button>
            <FieldRow icon={Link2} title="Image link" htmlFor="block-image-url" note="Or paste one">
              <Input
                id="block-image-url"
                value={block.url}
                onChange={(event) => onChange({ ...block, url: event.target.value })}
                placeholder="https://"
              />
            </FieldRow>
            <FieldRow icon={Type} title="Description" htmlFor="block-image-alt">
              <Input
                id="block-image-alt"
                value={block.alt}
                onChange={(event) => onChange({ ...block, alt: event.target.value })}
                placeholder="A flat white on the counter"
                hint="Shown when images are off, and read aloud to people who can’t see them."
              />
            </FieldRow>
          </div>
        </SettingsSection>
        <SettingsSection title="Link and size">
          <div className="space-y-4">
            <FieldRow icon={ExternalLink} title="Opens" htmlFor="block-image-href" note="Optional">
              <Input
                id="block-image-href"
                value={block.href}
                onChange={(event) => onChange({ ...block, href: event.target.value })}
                placeholder="https://"
              />
            </FieldRow>
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
            {alignment}
          </div>
        </SettingsSection>
      </>
    );

  if (block.type === 'spacer')
    return (
      <>
        {header}
        <SettingsSection title="Size">
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
        </SettingsSection>
      </>
    );

  if (isColumnsBlock(block))
    return (
      <>
        {header}
        <SettingsSection title="Split">
          <div className="grid grid-cols-2 gap-2">
            {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange(relayoutColumns(block, value))}
                aria-pressed={block.layout === value}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                  block.layout === value ? 'border-primary bg-primary/6' : 'border-rule/60 bg-background hover:border-primary/40',
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
        </SettingsSection>
      </>
    );

  if (block.type === 'html')
    return (
      <>
        {header}
        <SettingsSection title="Code">
          <FieldRow icon={Braces} title="HTML" htmlFor="block-html">
            <textarea
              id="block-html"
              value={block.html}
              onChange={(event) => onChange({ ...block, html: event.target.value })}
              spellCheck={false}
              className={cn(TEXTAREA_CLASS, 'min-h-80')}
            />
          </FieldRow>
        </SettingsSection>
      </>
    );

  if (block.type === 'social')
    return (
      <>
        {header}
        <SettingsSection
          title="Links"
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-mr-2 gap-1.5"
              onClick={() => onChange({ ...block, links: [...block.links, { label: 'Website', url: 'https://' }] })}
            >
              <Plus aria-hidden="true" /> Add
            </Button>
          }
        >
          {block.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links yet — add one.</p>
          ) : (
            <div className="space-y-3">
              {block.links.map((link, index) => {
                const patch = (next: Partial<typeof link>) =>
                  onChange({ ...block, links: block.links.map((item, position) => (position === index ? { ...item, ...next } : item)) });
                return (
                  <div key={index} className="rounded-md border border-rule/55 bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <RowTile icon={Globe} />
                        <p className="truncate text-sm font-semibold text-foreground">{link.label || 'Untitled link'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${link.label || 'link'}`}
                        onClick={() => onChange({ ...block, links: block.links.filter((_, position) => position !== index) })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <Input
                        aria-label="Label"
                        value={link.label}
                        onChange={(event) => patch({ label: event.target.value })}
                        placeholder="Instagram"
                      />
                      <Input
                        aria-label="Link"
                        value={link.url}
                        onChange={(event) => patch({ url: event.target.value })}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSection>
      </>
    );

  // Divider: nothing to set beyond what it is.
  return header;
}
