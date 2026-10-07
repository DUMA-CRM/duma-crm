import type { CmsFieldDefinition, CmsFieldType, CmsMediaGroup } from '../api/cms.service.ts';

import { FIELD_TYPES, canHoldList, fieldKeyFromLabel, uniqueKey } from './cms.ts';

const CMS_FIELD_TYPES: readonly string[] = FIELD_TYPES.map((entry) => entry.type);

// ---------------------------------------------------------------------------
// Turning a model's description, as an AI wrote it, into fields the model
// editor will accept. The AI is asked for the right shape; this makes sure of
// it — unknown types are mapped or dropped, keys are derived and unique,
// choices have options, nesting stays within limits, references only point at
// models that exist. Pure, so every rule is tested.
// ---------------------------------------------------------------------------

export interface ModelDraft {
  name: string;
  description: string;
  kind: 'collection' | 'singleton';
  /** The key of the field entries are named by, or null for the first text field. */
  titleField: string | null;
  fields: CmsFieldDefinition[];
  /** Add the standard SEO block — for content that is a page on a site. */
  seo: boolean;
  /**
   * False when the request is a different kind of content from the model it
   * was asked on — team members on a blog post model. The fields are then the
   * whole new set, and the person decides: replace the model's fields, or add.
   */
  related: boolean;
  /** Fields the AI asked for that were left out, and why — shown, not silently lost. */
  skipped: Array<{ label: string; reason: string }>;
}

/**
 * What every entry already has without a field — the Status and Schedule
 * cards, the record's own timestamps, the SEO block. An AI asked for "a blog
 * post" reaches for these anyway; a second "Publish date" next to the
 * Schedule card is a field nobody knows which one wins.
 */
const BUILT_IN: Array<{ pattern: RegExp; reason: string; seoOnly?: boolean }> = [
  {
    pattern:
      /^(date )?(publish|published|publishing|publication|go live|release|live)( date| at| on| time| from)?$|^(publish|go live) (date|time)$/,
    reason: 'the Schedule card sets when it goes live',
  },
  {
    pattern: /^(unpublish|unpublished|expiry|expires|expiration|take down|end|archive)( date| at| on| time)?$|^(publish|show) (until|end)$/,
    reason: 'the Schedule card sets when it comes down',
  },
  {
    pattern: /^(status|state|draft|published|is published|visible|visibility|is visible|hidden|is live)$/,
    reason: 'the Status card publishes and unpublishes',
  },
  {
    pattern: /^(date )?(created|updated|modified|last updated|last modified|edited)( date| at| on| by)?$/,
    reason: 'every entry records when and by whom',
  },
  { pattern: /^(language|locale|translation|translations)$/, reason: 'languages are versions of the entry' },
  {
    pattern:
      /^(seo|seo title|seo description|meta|meta title|meta description|meta keywords|keywords|focus keyword|og title|og description|og image|open graph image|social image|share image|social title|social description|canonical|canonical url|no ?index)$/,
    reason: 'the SEO & sharing block covers it',
    seoOnly: true,
  },
];

const plain = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Why a field duplicates something built in, or null when it doesn't. */
export function builtInReason(label: string, seo: boolean): string | null {
  const text = plain(label);
  return BUILT_IN.find((entry) => (!entry.seoOnly || seo) && entry.pattern.test(text))?.reason ?? null;
}

/** The words a model reaches for, mapped to the types the CMS has. */
const TYPE_ALIASES: Record<string, CmsFieldType> = {
  string: 'text',
  title: 'text',
  shorttext: 'text',
  textarea: 'longText',
  paragraph: 'longText',
  longtext: 'longText',
  markdown: 'richText',
  html: 'richText',
  richtext: 'richText',
  body: 'richText',
  integer: 'number',
  int: 'number',
  float: 'number',
  decimal: 'number',
  price: 'number',
  currency: 'number',
  bool: 'boolean',
  checkbox: 'boolean',
  toggle: 'boolean',
  datetime: 'dateTime',
  timestamp: 'dateTime',
  enum: 'select',
  dropdown: 'select',
  choice: 'select',
  tags: 'select',
  image: 'media',
  images: 'media',
  file: 'media',
  video: 'media',
  photo: 'media',
  link: 'url',
  website: 'url',
  relation: 'reference',
  relationship: 'reference',
  object: 'group',
  repeater: 'group',
  colour: 'color',
  geo: 'location',
};

const MEDIA_GROUPS: readonly CmsMediaGroup[] = ['image', 'video', 'audio', 'document'];
const MAX_FIELDS = 30;
const MAX_NESTED = 15;

const str = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

export function resolveFieldType(value: unknown): CmsFieldType | null {
  if (typeof value !== 'string') return null;
  if (CMS_FIELD_TYPES.includes(value)) return value as CmsFieldType;
  return TYPE_ALIASES[value.toLowerCase().replace(/[^a-z]/g, '')] ?? null;
}

interface FieldContext {
  referenceKeys: readonly string[];
  /** Whether the SEO block is coming — SEO-ish fields then duplicate it. */
  seo: boolean;
  skipped: Array<{ label: string; reason: string }>;
}

function normaliseFields(raw: unknown, depth: number, taken: string[], context: FieldContext): CmsFieldDefinition[] {
  if (!Array.isArray(raw)) return [];
  const keys = [...taken];
  const labels = new Set<string>();
  const out: CmsFieldDefinition[] = [];
  for (const item of raw.slice(0, depth === 0 ? MAX_FIELDS : MAX_NESTED)) {
    if (!item || typeof item !== 'object') continue;
    const input = item as Record<string, unknown>;
    let type = resolveFieldType(input.type);
    if (!type) continue;
    // Slugs live at the top level; groups nest one level only.
    if (depth > 0 && (type === 'slug' || type === 'group')) continue;
    if (type === 'slug' && out.some((field) => field.type === 'slug')) continue;
    const label = str(input.label, 80) || str(input.key, 80);
    if (!label) continue;
    // One field per thing: a label already used (here or on the model) is a repeat.
    if (labels.has(plain(label)) || keys.includes(fieldKeyFromLabel(label))) {
      if (depth === 0) context.skipped.push({ label, reason: 'it’s already there' });
      continue;
    }
    const builtIn = depth === 0 ? builtInReason(label, context.seo) : null;
    if (builtIn) {
      context.skipped.push({ label, reason: builtIn });
      continue;
    }
    const key = uniqueKey(fieldKeyFromLabel(label) || type, keys);
    const field: CmsFieldDefinition = { key, label, type };
    const description = str(input.description, 200);
    if (description) field.description = description;
    if (input.required === true) field.required = true;
    if (input.multiple === true && canHoldList(type)) field.multiple = true;

    if (type === 'select') {
      const options = Array.isArray(input.options)
        ? [...new Set(input.options.map((option) => str(option, 60)).filter(Boolean))].slice(0, 30)
        : [];
      if (options.length === 0) {
        // A choice with nothing to choose is a short text the editor can tighten later.
        type = 'text';
        field.type = 'text';
      } else field.options = options;
    }
    if (type === 'text' || type === 'longText') {
      const maxLength = num(input.maxLength);
      if (maxLength && maxLength > 0) field.maxLength = Math.min(Math.round(maxLength), type === 'text' ? 255 : 10_000);
    }
    if (type === 'number') {
      if (input.integer === true) field.integer = true;
      const min = num(input.min);
      const max = num(input.max);
      if (min !== undefined) field.min = min;
      if (max !== undefined && (min === undefined || max >= min)) field.max = max;
    }
    if (type === 'media') {
      const groups = Array.isArray(input.mediaGroups)
        ? input.mediaGroups.filter((group): group is CmsMediaGroup => MEDIA_GROUPS.includes(group as CmsMediaGroup))
        : [];
      // "image" as the type said which group it meant.
      const implied = /^(image|images|photo)$/i.test(String(input.type)) ? ['image' as const] : [];
      const chosen = groups.length > 0 ? groups : implied;
      if (chosen.length > 0) field.mediaGroups = [...new Set(chosen)];
    }
    if (type === 'reference' && Array.isArray(input.referenceTypes)) {
      const linked = input.referenceTypes.filter((key): key is string => typeof key === 'string' && context.referenceKeys.includes(key));
      if (linked.length > 0) field.referenceTypes = linked;
    }
    if (type === 'slug') {
      field.required = true;
      field.unique = true;
    }
    if (type === 'group') {
      const children = normaliseFields(input.fields, depth + 1, [], context);
      if (children.length === 0) continue;
      field.fields = children;
    }
    keys.push(key);
    labels.add(plain(label));
    out.push(field);
  }
  // A slug is made from the first short text, as the editor would set it.
  const slug = out.find((field) => field.type === 'slug');
  const source = out.find((field) => field.type === 'text');
  if (slug && source) slug.slugSource = source.key;
  return out;
}

/**
 * The AI's model description, made safe for the editor. `existingKeys` are the
 * fields the model already has (new fields never reuse them); `referenceKeys`
 * the models a reference may point at. Null when nothing usable came back.
 */
export function normaliseModelDraft(
  raw: unknown,
  context: { existingKeys?: readonly string[]; referenceKeys: readonly string[] },
): ModelDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const related = input.related !== false;
  // An unrelated request is a model of its own: its fields are judged on their
  // own, not against the ones it may replace.
  const existing = related ? (context.existingKeys ?? []) : [];
  // A model that already has the SEO block keeps SEO out of its fields too.
  const seo = input.seo === true || existing.includes('seo');
  const skipped: ModelDraft['skipped'] = [];
  const fields = normaliseFields(input.fields, 0, [...existing, 'seo'], { referenceKeys: context.referenceKeys, seo, skipped });
  // Nothing new is still an answer when the AI asked for things that exist.
  if (fields.length === 0 && skipped.length === 0) return null;
  const wanted = str(input.titleField, 80);
  const titleField =
    fields.find((field) => field.type === 'text' && (field.key === wanted || field.label.toLowerCase() === wanted.toLowerCase()))?.key ??
    fields.find((field) => field.type === 'text')?.key ??
    null;
  return {
    name: str(input.name, 80),
    description: str(input.description, 300),
    kind: input.kind === 'singleton' ? 'singleton' : 'collection',
    titleField,
    fields,
    seo: input.seo === true,
    related,
    skipped,
  };
}

/** "Blog post", or "Blog post 2" when that name is taken — the next free number, case-insensitively. */
export function uniqueModelName(name: string, taken: readonly string[]): string {
  const base = name.trim().replace(/\s+\d+$/, '') || name.trim();
  const used = new Set(taken.map((entry) => entry.trim().toLowerCase()));
  if (!used.has(name.trim().toLowerCase())) return name.trim();
  for (let n = 2; ; n += 1) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/**
 * A draft put into a model's fields. `replace` swaps them for the draft's
 * (an unrelated request the person chose to start over with); `add` appends
 * what isn't there yet, under keys of its own. The SEO block joins when the
 * draft asks for it and the result lacks one.
 */
export function mergeDraftFields(
  current: readonly CmsFieldDefinition[],
  draft: Pick<ModelDraft, 'fields' | 'seo'>,
  mode: 'add' | 'replace',
  seoBlock: CmsFieldDefinition,
): { fields: CmsFieldDefinition[]; added: number } {
  let fields: CmsFieldDefinition[];
  let added: number;
  if (mode === 'replace') {
    fields = [...draft.fields];
    added = fields.length;
  } else {
    const keys = current.map((field) => field.key);
    const labels = new Set(current.map((field) => plain(field.label)));
    const fresh: CmsFieldDefinition[] = [];
    for (const field of draft.fields) {
      if (labels.has(plain(field.label))) continue;
      const key = uniqueKey(field.key, keys);
      keys.push(key);
      labels.add(plain(field.label));
      fresh.push(key === field.key ? field : { ...field, key });
    }
    fields = [...current, ...fresh];
    added = fresh.length;
  }
  if (draft.seo && !fields.some((field) => field.key === seoBlock.key)) fields.push(seoBlock);
  return { fields, added };
}
