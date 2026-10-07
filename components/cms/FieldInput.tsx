'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronDown, ChevronUp, FileText, ImageIcon, Link2, Plus, Trash2, X } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type CmsFieldDefinition, getCmsAssets, getCmsEntries } from '@/lib/modules/cms/client';
import { emptyValueFor, isImage, isListField, moveItem, slugify } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { DateTimeField } from './DateTimeField';
import { MarkdownEditor } from './MarkdownEditor';
import { MediaPicker } from './MediaPicker';
import { ReferencePicker } from './ReferencePicker';
import { FIELD_ICONS } from './fieldIcons';
import { EntryStatusBadge, FIELD_LABEL_CLASS, TEXTAREA_CLASS, assetPreviewSrc, cmsKeys } from './shared';

type Data = Record<string, unknown>;

/**
 * Renders a whole field set: every field of a type, or of one group item.
 * `issues` are the API's messages keyed by top-level field.
 */
export function FieldSet({
  fields,
  value,
  onChange,
  issues,
  disabled,
  locale,
  headlineKey,
}: {
  fields: CmsFieldDefinition[];
  value: Data;
  onChange: (next: Data) => void;
  issues?: Map<string, string[]>;
  disabled?: boolean;
  locale: string;
  /** The entry's title field: drawn as the page's headline and moved to the top. */
  headlineKey?: string | null;
}) {
  const headline = headlineKey ? fields.find((field) => field.key === headlineKey && field.type === 'text') : undefined;
  const ordered = headline ? [headline, ...fields.filter((field) => field !== headline)] : fields;
  return (
    <div className="space-y-5">
      {ordered.map((field) => (
        <FieldInput
          key={field.key}
          headline={field === headline}
          field={field}
          value={value[field.key]}
          siblings={value}
          onChange={(next) => onChange({ ...value, [field.key]: next })}
          errors={issues?.get(field.key)}
          disabled={disabled}
          locale={locale}
        />
      ))}
    </div>
  );
}

function FieldInput({
  field,
  value,
  siblings,
  onChange,
  errors,
  disabled,
  locale,
  headline = false,
}: {
  headline?: boolean;
  field: CmsFieldDefinition;
  value: unknown;
  siblings: Data;
  onChange: (next: unknown) => void;
  errors?: string[];
  disabled?: boolean;
  locale: string;
}) {
  const id = `cms-field-${field.key}`;
  const error = errors?.join(' · ');
  const label = (
    <span className="flex items-center gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {field.label}
        {field.required && (
          <span className="text-exception" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {field.private && <span className="text-micro font-semibold uppercase text-muted-foreground/80">· not delivered</span>}
    </span>
  );
  const help = (field.description || error) && (
    <p className={cn('mt-1 text-xs', error ? 'text-exception' : 'text-muted-foreground')} id={`${id}-help`}>
      {error ?? field.description}
    </p>
  );
  const text = typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);

  if (headline) {
    // The title as the page's headline: large, borderless, read before anything else.
    return (
      <div>
        <label htmlFor={id} className="sr-only">
          {field.label}
        </label>
        <input
          id={id}
          type="text"
          value={text}
          disabled={disabled}
          maxLength={field.maxLength ?? 255}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help`}
          placeholder={field.label}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'w-full rounded-md bg-transparent px-1 py-1 -mx-1 text-2xl font-semibold leading-tight tracking-headline text-foreground outline-none transition-colors placeholder:text-muted-foreground/45 hover:bg-band/40 focus-visible:bg-band/40 disabled:opacity-60 sm:text-3xl',
            error && 'text-exception',
          )}
        />
        {help}
      </div>
    );
  }

  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <div>
          {label}
          <Input
            id={id}
            className="mt-1"
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
            value={text}
            disabled={disabled}
            maxLength={field.maxLength ?? (field.type === 'url' ? 2000 : 255)}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            placeholder={field.type === 'url' ? 'https://' : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {help}
        </div>
      );
    case 'slug': {
      const source = field.slugSource ? siblings[field.slugSource] : undefined;
      return (
        <div>
          {label}
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <Input
                id={id}
                value={text}
                disabled={disabled}
                className="font-mono"
                aria-invalid={Boolean(error)}
                aria-describedby={`${id}-help`}
                onChange={(event) => onChange(event.target.value.toLowerCase())}
              />
            </div>
            {typeof source === 'string' && source && !disabled && (
              <Button type="button" variant="outline" onClick={() => onChange(slugify(source))} title="Generate from the title">
                Generate
              </Button>
            )}
          </div>
          {help}
        </div>
      );
    }
    case 'longText':
      return (
        <div>
          {label}
          <textarea
            id={id}
            rows={5}
            className={cn(TEXTAREA_CLASS, 'mt-1', error && 'border-exception')}
            value={text}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            onChange={(event) => onChange(event.target.value)}
          />
          {help}
        </div>
      );
    case 'richText':
      return (
        <MarkdownEditor
          id={id}
          locale={locale}
          label={label}
          help={
            help ?? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                GitHub-flavoured Markdown: headings, lists and task lists, tables, code, links, quotes and images.
              </p>
            )
          }
          value={text}
          disabled={disabled}
          error={Boolean(error)}
          onChange={onChange}
        />
      );
    case 'number':
      return (
        <div>
          {label}
          <Input
            id={id}
            className="mt-1 max-w-56"
            type="number"
            inputMode={field.integer ? 'numeric' : 'decimal'}
            step={field.integer ? 1 : 'any'}
            min={field.min}
            max={field.max}
            value={text}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            onChange={(event) => onChange(event.target.value)}
          />
          {help}
        </div>
      );
    case 'boolean':
      return (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-rule/60 bg-control px-3 py-2.5">
          <div>
            {label}
            {help}
          </div>
          <Switch checked={value === true} onChange={onChange} label={field.label} disabled={disabled} />
        </div>
      );
    case 'date':
      return (
        <div>
          {label}
          <Input
            id={id}
            className="mt-1 max-w-64"
            type="date"
            value={text}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help`}
            onChange={(event) => onChange(event.target.value)}
          />
          {help}
        </div>
      );
    case 'dateTime':
      // The shared DatePicker plus a time box — never the browser's own
      // date-time control, which looks and behaves differently in every browser.
      return (
        <div className="max-w-md">
          <DateTimeField
            label={
              <>
                {field.label}
                {field.required && (
                  <span className="text-exception" aria-hidden="true">
                    {' '}
                    *
                  </span>
                )}
              </>
            }
            value={text}
            disabled={disabled}
            error={error}
            hint={field.description}
            onChange={onChange}
          />
        </div>
      );
    case 'color':
      return (
        <div>
          {label}
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              aria-label={`${field.label} picker`}
              className="h-9 w-12 cursor-pointer rounded-sm border border-rule bg-field"
              value={/^#[0-9a-f]{6}$/i.test(text) ? text : '#000000'}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
            <Input
              id={id}
              className="w-32 font-mono"
              value={text}
              placeholder="#1a2b3c"
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          {help}
        </div>
      );
    case 'location': {
      const point = (value && typeof value === 'object' ? value : {}) as { lat?: unknown; lng?: unknown };
      const set = (key: 'lat' | 'lng', raw: string) => {
        const next = { lat: point.lat ?? '', lng: point.lng ?? '', [key]: raw === '' ? '' : Number(raw) };
        onChange(next.lat === '' && next.lng === '' ? '' : next);
      };
      return (
        <div>
          {label}
          <div className="mt-1 flex gap-2">
            <Input
              aria-label={`${field.label} latitude`}
              type="number"
              step="any"
              placeholder="Latitude"
              value={String(point.lat ?? '')}
              disabled={disabled}
              onChange={(event) => set('lat', event.target.value)}
            />
            <Input
              aria-label={`${field.label} longitude`}
              type="number"
              step="any"
              placeholder="Longitude"
              value={String(point.lng ?? '')}
              disabled={disabled}
              onChange={(event) => set('lng', event.target.value)}
            />
          </div>
          {help}
        </div>
      );
    }
    case 'json':
      return <JsonInput id={id} label={label} help={help} value={value} disabled={disabled} onChange={onChange} />;
    case 'select':
      return isListField(field) ? (
        <fieldset>
          <legend className={FIELD_LABEL_CLASS}>
            {field.label}
            {field.required && (
              <span className="text-exception" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(field.options ?? []).map((option) => {
              const list = Array.isArray(value) ? (value as string[]) : [];
              const on = list.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => onChange(on ? list.filter((item) => item !== option) : [...list, option])}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-rule text-foreground hover:bg-band',
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {help}
        </fieldset>
      ) : (
        <div>
          {label}
          <Select
            id={id}
            className="mt-1 max-w-80"
            ariaLabel={field.label}
            value={text}
            disabled={disabled}
            onValueChange={onChange}
            placeholder="Choose…"
            options={[
              ...(field.required ? [] : [{ value: '', label: '— None —' }]),
              ...(field.options ?? []).map((option) => ({ value: option, label: option })),
            ]}
          />
          {help}
        </div>
      );
    case 'media':
      return <MediaInput field={field} label={label} help={help} value={value} disabled={disabled} onChange={onChange} />;
    case 'reference':
      return (
        <ReferenceInput field={field} label={label} help={help} value={value} disabled={disabled} onChange={onChange} locale={locale} />
      );
    case 'group':
      return <GroupInput field={field} help={help} value={value} disabled={disabled} onChange={onChange} locale={locale} />;
  }
}

function JsonInput({
  id,
  label,
  help,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: React.ReactNode;
  help: React.ReactNode;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}) {
  const [draft, setDraft] = useState(() => (value === undefined || value === '' ? '' : JSON.stringify(value, null, 2)));
  const [invalid, setInvalid] = useState(false);
  return (
    <div>
      {label}
      <textarea
        id={id}
        rows={6}
        spellCheck={false}
        className={cn(TEXTAREA_CLASS, 'mt-1 font-mono text-sm', invalid && 'border-exception')}
        value={draft}
        disabled={disabled}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!event.target.value.trim()) {
            setInvalid(false);
            onChange('');
            return;
          }
          try {
            onChange(JSON.parse(event.target.value));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid ? <p className="mt-1 text-xs text-exception">Not valid JSON yet — the last valid value is kept.</p> : help}
    </div>
  );
}

function MediaInput({
  field,
  label,
  help,
  value,
  disabled,
  onChange,
}: {
  field: CmsFieldDefinition;
  label: React.ReactNode;
  help: React.ReactNode;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [picking, setPicking] = useState(false);
  const multiple = isListField(field);
  const ids = (Array.isArray(value) ? value : value ? [value] : []).filter((item): item is string => typeof item === 'string');
  const assetsQuery = useQuery({
    queryKey: cmsKeys.assets(tenantId, { ids: ids.join(',') }),
    queryFn: () => getCmsAssets({ ids: ids.join(',') }, tenantId ?? undefined),
    enabled: !!tenantId && ids.length > 0,
  });
  const byId = new Map((assetsQuery.data?.data ?? []).map((asset) => [asset.id, asset]));

  return (
    <div>
      {label}
      <div className="mt-1.5 flex flex-wrap gap-2">
        {ids.map((id, index) => {
          const asset = byId.get(id);
          return (
            <div key={id} className="group relative w-32 overflow-hidden rounded-md border border-rule/60 bg-band/40">
              {asset && isImage(asset.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element -- tenant media from the API, not a static asset
                <img src={assetPreviewSrc(asset)} alt={asset.altText ?? ''} className="aspect-4/3 w-full object-cover" />
              ) : (
                <div className="flex aspect-4/3 items-center justify-center text-muted-foreground">
                  <FileText size={22} aria-hidden="true" />
                </div>
              )}
              <p className="truncate px-2 py-1 text-xs text-muted-foreground">
                {asset?.fileName ?? (assetsQuery.isPending ? 'Loading…' : 'Missing asset')}
              </p>
              {!disabled && (
                <span className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  {multiple && index > 0 && (
                    <IconButton label="Move earlier" onClick={() => onChange(moveItem(ids, index, index - 1))}>
                      <ChevronUp size={12} className="-rotate-90" aria-hidden="true" />
                    </IconButton>
                  )}
                  <IconButton
                    label={`Remove ${asset?.fileName ?? 'asset'}`}
                    onClick={() => onChange(multiple ? ids.filter((item) => item !== id) : '')}
                  >
                    <X size={12} aria-hidden="true" />
                  </IconButton>
                </span>
              )}
            </div>
          );
        })}
        {!disabled && (multiple || ids.length === 0) && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex aspect-4/3 w-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-rule bg-control text-xs text-muted-foreground hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ImageIcon size={18} aria-hidden="true" />
            {multiple && ids.length > 0 ? 'Add more' : 'Choose media'}
          </button>
        )}
      </div>
      {help}
      {picking && (
        <MediaPicker
          multiple={multiple}
          groups={field.mediaGroups}
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            setPicking(false);
            if (multiple) onChange([...ids, ...picked.filter((id) => !ids.includes(id))]);
            else onChange(picked[0] ?? '');
          }}
        />
      )}
    </div>
  );
}

function ReferenceInput({
  field,
  label,
  help,
  value,
  disabled,
  onChange,
  locale,
}: {
  field: CmsFieldDefinition;
  label: React.ReactNode;
  help: React.ReactNode;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
  locale: string;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [picking, setPicking] = useState(false);
  const multiple = isListField(field);
  const ids = (Array.isArray(value) ? value : value ? [value] : []).filter((item): item is string => typeof item === 'string');
  const linkedQuery = useQuery({
    queryKey: cmsKeys.entries(tenantId, { documentIds: ids.join(',') }),
    queryFn: () => getCmsEntries({ documentIds: ids.join(',') }, tenantId ?? undefined),
    enabled: !!tenantId && ids.length > 0,
  });
  // One document has a row per locale; show the one in the editor's locale.
  const byDocument = new Map<string, NonNullable<typeof linkedQuery.data>['data'][number]>();
  for (const row of linkedQuery.data?.data ?? []) {
    const current = byDocument.get(row.documentId);
    if (!current || row.locale === locale) byDocument.set(row.documentId, row);
  }

  return (
    <div>
      {label}
      <ul className="mt-1.5 space-y-1.5">
        {ids.map((id, index) => {
          const linked = byDocument.get(id);
          return (
            <li key={id} className="flex items-center gap-2 rounded-md border border-rule/60 bg-control px-3 py-2">
              <Link2 size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {linked?.title ?? (linkedQuery.isPending ? 'Loading…' : 'Missing entry')}
                </span>
                {linked && <span className="text-xs text-muted-foreground">{linked.contentType.name}</span>}
              </span>
              {linked && <EntryStatusBadge status={linked.status} />}
              {!disabled && multiple && (
                <>
                  <IconButton label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(ids, index, index - 1))}>
                    <ChevronUp size={13} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === ids.length - 1}
                    onClick={() => onChange(moveItem(ids, index, index + 1))}
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </IconButton>
                </>
              )}
              {!disabled && (
                <IconButton label="Remove link" onClick={() => onChange(multiple ? ids.filter((item) => item !== id) : '')}>
                  <X size={13} aria-hidden="true" />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {!disabled && (multiple || ids.length === 0) && (
        <Button type="button" size="sm" variant="outline" className="mt-1.5 gap-1.5" onClick={() => setPicking(true)}>
          <Link2 size={13} aria-hidden="true" /> {ids.length > 0 ? 'Link another' : 'Link an entry'}
        </Button>
      )}
      {help}
      {picking && (
        <ReferencePicker
          allowedTypeKeys={field.referenceTypes}
          exclude={ids}
          locale={locale}
          onClose={() => setPicking(false)}
          onPick={(documentId) => {
            setPicking(false);
            onChange(multiple ? [...ids, documentId] : documentId);
          }}
        />
      )}
    </div>
  );
}

function GroupInput({
  field,
  help,
  value,
  disabled,
  onChange,
  locale,
}: {
  field: CmsFieldDefinition;
  help: React.ReactNode;
  value: unknown;
  disabled?: boolean;
  onChange: (next: unknown) => void;
  locale: string;
}) {
  const fields = field.fields ?? [];
  if (!isListField(field)) {
    const item = (value && typeof value === 'object' && !Array.isArray(value) ? value : {}) as Data;
    return (
      <fieldset>
        <legend className="w-full">
          <GroupHeader field={field} />
        </legend>
        <div className="mt-2 rounded-lg border border-rule/60 bg-control p-4">
          <FieldSet fields={fields} value={item} onChange={onChange} disabled={disabled} locale={locale} />
        </div>
        {help}
      </fieldset>
    );
  }

  const items = (Array.isArray(value) ? value : []) as Data[];
  const blank = () => Object.fromEntries(fields.map((child) => [child.key, emptyValueFor(child)]));
  const titleOf = (item: Data) => {
    const first = fields.find((child) => child.type === 'text');
    const text = first ? item[first.key] : undefined;
    return typeof text === 'string' && text ? text : null;
  };

  return (
    <fieldset>
      <legend className="w-full">
        <GroupHeader field={field} count={`${items.length} ${items.length === 1 ? 'item' : 'items'}`} />
      </legend>
      <ol className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="rounded-lg border border-rule/60 bg-control">
            <div className="flex items-center gap-1 border-b border-rule/50 px-3 py-1.5">
              <span className="flex-1 truncate text-xs font-semibold text-muted-foreground">
                {index + 1}. {titleOf(item) ?? field.label}
              </span>
              {!disabled && (
                <>
                  <IconButton label="Move up" disabled={index === 0} onClick={() => onChange(moveItem(items, index, index - 1))}>
                    <ChevronUp size={13} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => onChange(moveItem(items, index, index + 1))}
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label={`Remove item ${index + 1}`}
                    onClick={() => onChange(items.filter((_, position) => position !== index))}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </>
              )}
            </div>
            <div className="p-3">
              <FieldSet
                fields={fields}
                value={item}
                disabled={disabled}
                locale={locale}
                onChange={(next) => onChange(items.map((existing, position) => (position === index ? next : existing)))}
              />
            </div>
          </li>
        ))}
      </ol>
      {!disabled && (field.maxItems === undefined || items.length < field.maxItems) && (
        <Button type="button" size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => onChange([...items, blank()])}>
          <Plus size={13} aria-hidden="true" /> Add {field.label.toLowerCase()}
        </Button>
      )}
      {help}
    </fieldset>
  );
}

/** A group's header in the side cards' shape: its type tile, its name, a count on the right. */
function GroupHeader({ field, count }: { field: CmsFieldDefinition; count?: string }) {
  const Icon = FIELD_ICONS[field.type];
  return (
    <span className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {field.label}
          {field.required && (
            <span className="text-exception" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </span>
      </span>
      {count && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-6 items-center justify-center rounded-sm bg-card/90 text-muted-foreground hover:bg-band hover:text-foreground disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}
