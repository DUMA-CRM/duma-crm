'use client';

import { ArrowLeft, ImagePlus, Plus, Trash2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingRow, SettingRows } from '@/components/settings/controls';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { cn } from '@/lib/utils/cn';

import { VariablePalette } from './VariablePalette';
import { COLUMN_LAYOUTS, type TemplateBlock, type TemplateDesign, isColumnsBlock, relayoutColumns } from './templateDesign';

/** Most inboxes cut the preview line around here. */
const PREHEADER_LIMIT = 90;

const FONTS: { value: TemplateDesign['styles']['fontFamily']; label: string }[] = [
  { value: 'Arial', label: 'Arial — clean, modern' },
  { value: 'Verdana', label: 'Verdana — wide, easy to read' },
  { value: 'Georgia', label: 'Georgia — classic serif' },
];

const COLOURS: { key: 'backgroundColor' | 'contentColor' | 'textColor' | 'accentColor'; title: string; description: string }[] = [
  { key: 'accentColor', title: 'Buttons and links', description: 'Your main brand colour.' },
  { key: 'textColor', title: 'Text', description: 'Headings and paragraphs.' },
  { key: 'contentColor', title: 'Email body', description: 'Behind the content.' },
  { key: 'backgroundColor', title: 'Page background', description: 'Around the email.' },
];

const BLOCK_LABEL: Record<TemplateBlock['type'], string> = {
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  image: 'Image',
  divider: 'Divider',
  spacer: 'Spacer',
  social: 'Social links',
  columns: 'Column row',
};

const ALIGN_OPTIONS = [
  { value: 'left' as const, label: 'Left' },
  { value: 'center' as const, label: 'Centre' },
  { value: 'right' as const, label: 'Right' },
];

/**
 * The editor's right panel, laid out like a settings page: titled sections of
 * label-and-control rows. With nothing selected it holds the email's own
 * settings; with a block selected, that block's — and a way back.
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
  onFocusField,
  design,
  onStyles,
  variables,
  onInsertVariable,
  usedBy,
  canDelete,
  onDelete,
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
  /** Which text field a variable chip should land in. */
  onFocusField: (field: 'subject' | 'preheader') => void;
  design: TemplateDesign;
  onStyles: (patch: Partial<TemplateDesign['styles']>) => void;
  variables: string[];
  onInsertVariable: (token: string) => boolean;
  usedBy: { id: string; name: string }[];
  canDelete: boolean;
  onDelete: () => void;
  readOnly: boolean;
  htmlMode: boolean;
}) {
  if (selected && !htmlMode) {
    return (
      <div className="space-y-3 p-3">
        <button
          type="button"
          onClick={onDeselect}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
        >
          <ArrowLeft size={15} aria-hidden="true" /> Email settings
        </button>
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
          <BlockSettings block={selected} onChange={onBlockChange} onChooseImage={() => onChooseImage(selected.id)} />
        </fieldset>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      <fieldset disabled={readOnly} className="min-w-0 space-y-3">
        <SettingsSection title="Email details" description="What people see in their inbox before they open it.">
          <div className="space-y-4">
            <Input
              label="Subject line"
              value={subject}
              onChange={(event) => onSubject(event.target.value)}
              onFocus={() => onFocusField('subject')}
              required
              placeholder="Your order is ready"
            />
            <div>
              <Input
                label="Preview text"
                value={preheader}
                onChange={(event) => onPreheader(event.target.value)}
                onFocus={() => onFocusField('preheader')}
                placeholder="The line shown after the subject"
                disabled={htmlMode}
              />
              <p className={cn('mt-1 text-right text-micro tabular-nums', preheader.length > PREHEADER_LIMIT ? 'text-measured' : 'text-muted-foreground')}>
                {htmlMode ? 'Set in the HTML itself while editing HTML' : `${preheader.length}/${PREHEADER_LIMIT}`}
              </p>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Template" description="Only your team sees these.">
          <div className="space-y-4">
            <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} required placeholder="Order ready" />
            <div className="space-y-1.5">
              <p className="text-label uppercase text-muted-foreground">Category</p>
              <Select value={category} onValueChange={onCategory} options={categoryOptions} ariaLabel="Template category" className="w-full" />
              <p className="text-xs text-muted-foreground">{categoryHint}</p>
            </div>
          </div>
        </SettingsSection>

        {!htmlMode && (
          <SettingsSection title="Brand" description="Applies to the whole email.">
            <SettingRows>
              {COLOURS.map((colour) => (
                <SettingRow key={colour.key} title={colour.title} description={colour.description}>
                  <label className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase text-muted-foreground">{design.styles[colour.key]}</span>
                    <input
                      type="color"
                      value={design.styles[colour.key]}
                      onChange={(event) => onStyles({ [colour.key]: event.target.value })}
                      aria-label={colour.title}
                      className="size-9 cursor-pointer rounded-md border border-rule/60 bg-background p-0.5 disabled:cursor-not-allowed"
                    />
                  </label>
                </SettingRow>
              ))}
            </SettingRows>
            <div className="mt-4 space-y-1.5 border-t border-rule/40 pt-4">
              <p className="text-label uppercase text-muted-foreground">Font</p>
              <Select
                value={design.styles.fontFamily}
                onValueChange={(value) => onStyles({ fontFamily: value as TemplateDesign['styles']['fontFamily'] })}
                options={FONTS}
                ariaLabel="Font"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Fonts every inbox has, so it looks the same everywhere.</p>
            </div>
          </SettingsSection>
        )}
      </fieldset>

      {!readOnly && variables.length > 0 && (
        <SettingsSection title="Personalise" description="Click one to drop it into the field you were typing in.">
          <VariablePalette variables={variables} onInsert={onInsertVariable} hideHeading />
        </SettingsSection>
      )}

      {(usedBy.length > 0 || canDelete) && (
        <SettingsSection
          title="Used by"
          footnote={canDelete ? 'Deleting keeps what was already sent in History.' : undefined}
          actions={
            canDelete ? (
              <Button variant="ghost" size="sm" onClick={onDelete} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 /> Delete
              </Button>
            ) : undefined
          }
        >
          <p className="text-sm text-muted-foreground">
            {usedBy.length ? usedBy.map((item) => item.name).join(', ') : 'No automation sends this yet.'}
          </p>
        </SettingsSection>
      )}
    </div>
  );
}

function BlockSettings({ block, onChange, onChooseImage }: { block: TemplateBlock; onChange: (block: TemplateBlock) => void; onChooseImage: () => void }) {
  const title = BLOCK_LABEL[block.type];
  const alignment =
    'align' in block ? (
      <div className="space-y-1.5">
        <p className="text-label uppercase text-muted-foreground">Alignment</p>
        <SegmentedControl
          options={ALIGN_OPTIONS}
          value={block.align}
          onChange={(align) => onChange({ ...block, align })}
          ariaLabel="Alignment"
          className="w-full [&>button]:flex-1"
        />
      </div>
    ) : null;

  if (block.type === 'heading' || block.type === 'text')
    return (
      <SettingsSection title={title} description="Type straight on the email to change the words.">
        {alignment}
      </SettingsSection>
    );

  if (block.type === 'button')
    return (
      <SettingsSection title={title} description="The label is typed on the button itself. Its colour is your brand colour.">
        <div className="space-y-4">
          <Input
            label="Opens"
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://your-cafe.com/order"
            hint="Where the button takes people."
          />
          {alignment}
        </div>
      </SettingsSection>
    );

  if (block.type === 'image')
    return (
      <>
        <SettingsSection title="Image">
          <div className="space-y-4">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={onChooseImage}>
              <ImagePlus />
              {block.url ? 'Replace image' : 'Upload image'}
            </Button>
            <Input label="Or paste an image link" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="https://" />
            <Input
              label="Description"
              value={block.alt}
              onChange={(event) => onChange({ ...block, alt: event.target.value })}
              placeholder="A flat white on the counter"
              hint="Shown when images are off, and read aloud to people who can’t see them."
            />
          </div>
        </SettingsSection>
        <SettingsSection title="Link and size">
          <div className="space-y-4">
            <Input label="Opens" value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} placeholder="Optional — https://" />
            <div className="space-y-1.5">
              <p className="flex justify-between text-label uppercase text-muted-foreground">
                Width <span className="tabular-nums normal-case">{block.width}%</span>
              </p>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={block.width}
                onChange={(event) => onChange({ ...block, width: Number(event.target.value) })}
                aria-label="Width"
                className="w-full accent-primary"
              />
            </div>
            {alignment}
          </div>
        </SettingsSection>
      </>
    );

  if (block.type === 'spacer')
    return (
      <SettingsSection title={title} description="Empty space between blocks.">
        <div className="space-y-1.5">
          <p className="flex justify-between text-label uppercase text-muted-foreground">
            Height <span className="tabular-nums normal-case">{block.height}px</span>
          </p>
          <input
            type="range"
            min={8}
            max={120}
            step={4}
            value={block.height}
            onChange={(event) => onChange({ ...block, height: Number(event.target.value) })}
            aria-label="Height"
            className="w-full accent-primary"
          />
        </div>
      </SettingsSection>
    );

  if (isColumnsBlock(block))
    return (
      <SettingsSection title={title} description="Drag content from the left into each column. Changing the split keeps what's in them.">
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(relayoutColumns(block, value))}
              aria-pressed={block.layout === value}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-colors',
                block.layout === value ? 'border-primary bg-primary/6' : 'border-rule/60 bg-background hover:border-primary/40',
              )}
            >
              <span className="flex h-6 w-full items-stretch gap-1" aria-hidden="true">
                {widths.map((width, index) => (
                  <span key={index} style={{ width: `${width}%` }} className={cn('rounded-sm', block.layout === value ? 'bg-primary/25' : 'bg-band')} />
                ))}
              </span>
              <span className="text-micro font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </SettingsSection>
    );

  if (block.type === 'social')
    return (
      <SettingsSection title={title} description="Where customers can find you.">
        <div className="space-y-3">
          {block.links.map((link, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-md border border-rule/55 bg-background p-3">
              <div className="space-y-2">
                <Input
                  label="Label"
                  value={link.label}
                  onChange={(event) =>
                    onChange({ ...block, links: block.links.map((item, position) => (position === index ? { ...item, label: event.target.value } : item)) })
                  }
                />
                <Input
                  label="Link"
                  value={link.url}
                  onChange={(event) =>
                    onChange({ ...block, links: block.links.map((item, position) => (position === index ? { ...item, url: event.target.value } : item)) })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${link.label || 'link'}`}
                onClick={() => onChange({ ...block, links: block.links.filter((_, position) => position !== index) })}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => onChange({ ...block, links: [...block.links, { label: 'Website', url: 'https://' }] })}
          >
            <Plus />
            Add link
          </Button>
        </div>
      </SettingsSection>
    );

  return (
    <SettingsSection title={title}>
      <p className="text-sm text-muted-foreground">A thin line between sections. Nothing to set.</p>
    </SettingsSection>
  );
}
