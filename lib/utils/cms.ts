import type { CmsEntryStatus, CmsFieldDefinition, CmsFieldType } from '../api/cms.service.ts';
import { plainText } from './cms-seo.ts';
import { formatInstant, zonedParts, zonedToInstant } from './workspace-time.ts';

// ---------------------------------------------------------------------------
// Pure helpers for the Content (CMS) workspace. The API is the authority on
// what a valid model or entry is; these only shape input and explain state.
// ---------------------------------------------------------------------------

export interface FieldTypeInfo {
  type: CmsFieldType;
  label: string;
  description: string;
  group: 'Text' | 'Values' | 'Media & links' | 'Structure';
}

/** The field palette, in the order the "Add field" picker shows it. */
export const FIELD_TYPES: readonly FieldTypeInfo[] = [
  { type: 'text', label: 'Short text', description: 'Titles, names, one line', group: 'Text' },
  { type: 'longText', label: 'Long text', description: 'Plain paragraphs', group: 'Text' },
  { type: 'richText', label: 'Rich text', description: 'Markdown with headings, links and lists', group: 'Text' },
  { type: 'slug', label: 'Slug', description: 'URL-safe id, unique per locale', group: 'Text' },
  { type: 'email', label: 'Email', description: 'An email address', group: 'Text' },
  { type: 'url', label: 'URL', description: 'A full web address', group: 'Text' },
  { type: 'number', label: 'Number', description: 'Whole or decimal, with limits', group: 'Values' },
  { type: 'boolean', label: 'Yes / no', description: 'A switch', group: 'Values' },
  { type: 'date', label: 'Date', description: 'A calendar day', group: 'Values' },
  { type: 'dateTime', label: 'Date & time', description: 'A moment, stored in UTC', group: 'Values' },
  { type: 'select', label: 'Choice', description: 'One or several from a list', group: 'Values' },
  { type: 'color', label: 'Colour', description: 'A hex colour', group: 'Values' },
  { type: 'location', label: 'Location', description: 'Latitude and longitude', group: 'Values' },
  { type: 'media', label: 'Media', description: 'Images, video, documents', group: 'Media & links' },
  { type: 'reference', label: 'Reference', description: 'Link to other entries', group: 'Media & links' },
  { type: 'group', label: 'Group', description: 'Nested fields, optionally repeatable', group: 'Structure' },
  { type: 'json', label: 'JSON', description: 'Any structured data', group: 'Structure' },
];

export const fieldTypeLabel = (type: CmsFieldType) => FIELD_TYPES.find((entry) => entry.type === type)?.label ?? type;

const LIST_CAPABLE = new Set<CmsFieldType>(['select', 'media', 'reference', 'group']);
export const canHoldList = (type: CmsFieldType) => LIST_CAPABLE.has(type);
export const isListField = (field: CmsFieldDefinition) => Boolean(field.multiple) && LIST_CAPABLE.has(field.type);

/** `"Hero image"` → `"heroImage"`: the API key a new field gets from its label. */
export function fieldKeyFromLabel(label: string): string {
  const words = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  const key = words.map((word, index) => (index === 0 ? word.toLowerCase() : word[0]!.toUpperCase() + word.slice(1).toLowerCase())).join('');
  return /^[A-Za-z]/.test(key) ? key.slice(0, 64) : `field${key}`.slice(0, 64);
}

/** `"Blog post"` → `"blog-post"`: the API key a new content type gets from its name. */
export function typeKeyFromName(name: string): string {
  const key = slugify(name).slice(0, 64);
  return /^[a-z]/.test(key) ? key : key ? `type-${key}`.slice(0, 64) : '';
}

/** URL-safe slug, as the API's slug field accepts it. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

/** A unique key among siblings: `title`, `title2`, `title3`… */
export function uniqueKey(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let index = 2;
  while (taken.includes(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

export function newField(type: CmsFieldType, label: string, siblings: readonly CmsFieldDefinition[]): CmsFieldDefinition {
  const key = uniqueKey(fieldKeyFromLabel(label) || type, siblings.map((field) => field.key));
  const field: CmsFieldDefinition = { key, label: label.trim() || fieldTypeLabel(type), type };
  if (type === 'select') field.options = ['Option 1'];
  if (type === 'group') field.fields = [{ key: 'title', label: 'Title', type: 'text' }];
  if (type === 'slug') {
    const source = siblings.find((sibling) => sibling.type === 'text');
    if (source) field.slugSource = source.key;
    field.required = true;
    field.unique = true;
  }
  return field;
}

/** Move an item in a list, returning a new list. Out-of-range moves are a no-op. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** Problems the model editor can point at before the API is asked. */
export function fieldListProblems(fields: readonly CmsFieldDefinition[]): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const field of fields) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(field.key)) problems.push(`“${field.label}” needs an API key of letters, numbers and _`);
    if (keys.has(field.key)) problems.push(`Two fields share the key “${field.key}”`);
    keys.add(field.key);
    if (field.type === 'select' && !(field.options && field.options.length > 0)) problems.push(`“${field.label}” needs at least one choice`);
    if (field.type === 'group' && !(field.fields && field.fields.length > 0)) problems.push(`“${field.label}” needs at least one nested field`);
    if (field.type === 'group') problems.push(...fieldListProblems(field.fields ?? []).map((problem) => `${field.label} → ${problem}`));
  }
  if (fields.filter((field) => field.type === 'slug').length > 1) problems.push('Only one slug field per content type');
  return problems;
}

// ─── Entries ─────────────────────────────────────────────────────────────────

export interface StatusMeta {
  label: string;
  variant: 'success' | 'warning' | 'muted' | 'reference' | 'destructive';
  description: string;
}

export function entryStatusMeta(status: CmsEntryStatus): StatusMeta {
  switch (status) {
    case 'published':
      return { label: 'Published', variant: 'success', description: 'Live on the delivery API' };
    case 'changed':
      return { label: 'Changed', variant: 'warning', description: 'Live, with unpublished edits' };
    case 'archived':
      return { label: 'Archived', variant: 'muted', description: 'Hidden and read-only' };
    default:
      return { label: 'Draft', variant: 'reference', description: 'Not published yet' };
  }
}

/** The value an empty form control should start from. */
export function emptyValueFor(field: CmsFieldDefinition): unknown {
  if (isListField(field)) return [];
  if (field.type === 'boolean') return false;
  if (field.type === 'group') return {};
  return '';
}

/**
 * Strip the blanks the editor holds for unfilled controls ('' and empty lists)
 * so a save sends only what was written. Nested groups are cleaned too.
 */
export function cleanEntryData(fields: readonly CmsFieldDefinition[], data: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (field.type === 'group') {
      const clean = (item: unknown) => (item && typeof item === 'object' ? cleanEntryData(field.fields ?? [], item as Record<string, unknown>) : item);
      if (Array.isArray(value)) output[field.key] = value.map(clean);
      else {
        const cleaned = clean(value) as Record<string, unknown>;
        if (Object.keys(cleaned).length > 0) output[field.key] = cleaned;
      }
      continue;
    }
    if (field.type === 'number' && typeof value === 'string') {
      const number = Number(value);
      output[field.key] = value.trim() !== '' && Number.isFinite(number) ? number : value;
      continue;
    }
    output[field.key] = value;
  }
  return output;
}

/** Same data, regardless of key order or editor blanks? */
export function sameEntryData(fields: readonly CmsFieldDefinition[], a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return stableStringify(cleanEntryData(fields, a)) === stableStringify(cleanEntryData(fields, b));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Expand a content type's preview URL template for one entry:
 * `https://site.example/blog/{slug}?locale={locale}`.
 */
export function previewUrlFor(template: string | null, entry: { slug: string | null; documentId: string; locale: string; id: string }): string | null {
  if (!template) return null;
  const values: Record<string, string> = { slug: entry.slug ?? '', id: entry.documentId, documentId: entry.documentId, locale: entry.locale, entryId: entry.id };
  if (/\{slug\}/.test(template) && !entry.slug) return null;
  return template.replace(/\{(slug|id|documentId|locale|entryId)\}/g, (_, key: string) => encodeURIComponent(values[key] ?? ''));
}

/** Group field-level issues from the API under their top-level field. */
export function issuesByField(issues: ReadonlyArray<{ field: string; message: string }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const issue of issues) {
    const top = issue.field.split(/[.[]/)[0] || '';
    const detail = issue.field.includes('.') || issue.field.includes('[') ? `${issue.field.slice(top.length).replace(/^\./, '')}: ${issue.message}` : issue.message;
    map.set(top, [...(map.get(top) ?? []), detail]);
  }
  return map;
}

// ─── Media & developers ──────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export const isImage = (mimeType: string) => mimeType.startsWith('image/');
export const isVideo = (mimeType: string) => mimeType.startsWith('video/');

/** A clip's length the way players show it: `0:07`, `2:05`, `1:02:03`. Blank when unknown. */
export function formatClipLength(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// ─── Locales ─────────────────────────────────────────────────────────────────

/**
 * The order a reader asking for `code` is served in: itself, its fallbacks,
 * then the default. Mirrors the API's `localeChain`, and is cycle-safe for the
 * same reason — fallbacks are tenant data.
 */
export function fallbackChain(code: string, locales: ReadonlyArray<{ code: string; isDefault: boolean; fallbackCode: string | null }>): string[] {
  const byCode = new Map(locales.map((locale) => [locale.code, locale]));
  const defaultCode = locales.find((locale) => locale.isDefault)?.code;
  const chain: string[] = [];
  let current: string | null | undefined = code;
  while (current && byCode.has(current) && !chain.includes(current) && chain.length < 10) {
    chain.push(current);
    current = byCode.get(current)?.fallbackCode;
  }
  if (defaultCode && !chain.includes(defaultCode)) chain.push(defaultCode);
  return chain;
}

/** `fr-CA` → "Canadian French", via the platform's own names; '' when unknown. */
export function localeDisplayName(code: string): string {
  const tag = code.trim();
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag)) return '';
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(tag);
    return name && name !== tag ? name : '';
  } catch {
    return '';
  }
}

// ─── Date & time ─────────────────────────────────────────────────────────────

/**
 * An ISO instant split into the workspace's wall-clock date (`YYYY-MM-DD`, what
 * the shared DatePicker takes) and time (`HH:MM`). Empty parts for no value.
 * Workspace, not browser: "publish at 09:00" means 09:00 at the business, even
 * when the person scheduling it is abroad.
 */
export function isoToLocalParts(iso: string | null | undefined, timeZone?: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = timeZone ? zonedParts(date, timeZone) : zonedParts(date);
  return { date: parts.date, time: parts.time };
}

/** Workspace date + time back to an ISO instant; no date means no value. A missing time is 09:00. */
export function localPartsToIso(date: string, time: string, timeZone?: string): string | null {
  const clock = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const instant = timeZone ? zonedToInstant(date, clock, timeZone) : zonedToInstant(date, clock);
  return instant ? instant.toISOString() : null;
}

// ─── Markdown preview ────────────────────────────────────────────────────────

/**
 * A link target safe to put in an href, or null. Content is tenant-written
 * and previewed inside the CRM, so `javascript:` and `data:` must never reach
 * an attribute.
 */
export function safeHref(url: string | null | undefined): string | null {
  const value = (url ?? '').trim();
  if (!value) return null;
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (/^(\/(?!\/)|#|\?|\.\.?\/)/.test(value)) return value;
  return null;
}

/** An image source safe to load in the preview: http(s) or same-origin paths only. */
export function safeImageSrc(url: string | null | undefined): string | null {
  const value = (url ?? '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/(?!\/)/.test(value)) return value;
  return null;
}

// ─── Overview ────────────────────────────────────────────────────────────────

export type CmsAttentionKind = 'awaiting_review' | 'unpublished_changes' | 'never_published' | 'scheduled' | 'no_api_key';

export interface CmsAttention {
  kind: CmsAttentionKind;
  count: number;
  tone: 'exception' | 'measured' | 'info';
}

/**
 * What the Content overview's "needs you" card lists, worst first. Counts are
 * per entry (one entry in three languages is one). A missing API key only
 * matters once something is live, and only to someone who can make one.
 */
export function cmsAttention(
  overview: { entries: { live: number; changed: number; draft: number; scheduled: number; review?: number }; activeApiKeys: number },
  options: { canManageKeys: boolean; canPublish?: boolean },
): CmsAttention[] {
  const items: CmsAttention[] = [];
  if (options.canManageKeys && overview.entries.live > 0 && overview.activeApiKeys === 0) items.push({ kind: 'no_api_key', count: 1, tone: 'exception' });
  // Someone is waiting on a publisher — and only a publisher can act on it.
  if (options.canPublish && (overview.entries.review ?? 0) > 0) items.push({ kind: 'awaiting_review', count: overview.entries.review!, tone: 'measured' });
  if (overview.entries.changed > 0) items.push({ kind: 'unpublished_changes', count: overview.entries.changed, tone: 'measured' });
  if (overview.entries.draft > 0) items.push({ kind: 'never_published', count: overview.entries.draft, tone: 'measured' });
  if (overview.entries.scheduled > 0) items.push({ kind: 'scheduled', count: overview.entries.scheduled, tone: 'info' });
  return items;
}

/**
 * How much of the content exists in one language: its versions out of every
 * entry, as a whole percentage (never 100 until it is complete, never 0 once
 * started) and in words. `total` is entries, not versions — one entry in three
 * languages is one.
 */
export function translationCoverage(translated: number, total: number): { percent: number; label: string } {
  if (total <= 0) return { percent: 0, label: 'No entries yet' };
  const done = Math.min(translated, total);
  const raw = (done / total) * 100;
  const percent = done === total ? 100 : done === 0 ? 0 : Math.min(99, Math.max(1, Math.round(raw)));
  return { percent, label: done === total ? `All ${total}` : `${done} of ${total}` };
}

/**
 * The field entries are named by in lists — the model's title field, else its
 * first short-text field. The API's `entryTitle` reads it the same way.
 */
export function resolvedTitleKey(fields: readonly CmsFieldDefinition[], titleField: string | null | undefined): string | null {
  if (titleField && fields.some((field) => field.key === titleField)) return titleField;
  return fields.find((field) => field.type === 'text')?.key ?? null;
}

/** A field's rules in a few words, for its row: "Required", "2–80 characters", "Up to 5 items", "Private". */
export function fieldRules(field: CmsFieldDefinition): string[] {
  const range = (min: number | undefined, max: number | undefined, unit: string) =>
    min !== undefined && max !== undefined ? `${min}–${max}${unit}` : min !== undefined ? `At least ${min}${unit}` : max !== undefined ? `Up to ${max}${unit}` : null;
  const rules: Array<string | null | false | undefined> = [
    field.required && 'Required',
    field.unique && 'Unique',
    field.multiple && canHoldList(field.type) && (field.type === 'group' ? 'Repeatable' : 'List'),
    field.integer && 'Whole numbers',
    range(field.minLength, field.maxLength, ' characters'),
    range(field.min, field.max, ''),
    field.multiple && canHoldList(field.type) && range(field.minItems, field.maxItems, ' items'),
    field.pattern && 'Pattern',
    field.private && 'Private',
  ];
  return rules.filter((rule): rule is string => Boolean(rule));
}

/** A copy of a field placed beside it: "Hero image copy", with a key no sibling holds. */
export function duplicateField(field: CmsFieldDefinition, siblings: readonly CmsFieldDefinition[]): CmsFieldDefinition {
  const label = `${field.label} copy`;
  return { ...field, label, key: uniqueKey(fieldKeyFromLabel(label) || field.type, siblings.map((sibling) => sibling.key)) };
}

/**
 * A relabelled field, its API key following the label while that is still
 * safe: the field isn't saved yet (`savedKeys`) and its key is still the one
 * the old label would have made. A key someone typed, or one entries already
 * use, never moves on its own.
 */
export function relabelField(
  field: CmsFieldDefinition,
  label: string,
  siblings: readonly CmsFieldDefinition[],
  savedKeys: ReadonlySet<string>,
): CmsFieldDefinition {
  const others = siblings.filter((sibling) => sibling !== field).map((sibling) => sibling.key);
  const derived = (value: string) => uniqueKey(fieldKeyFromLabel(value) || field.type, others);
  const following = !savedKeys.has(field.key) && field.key === derived(field.label);
  return { ...field, label, key: following ? derived(label) : field.key };
}

/** Nothing written yet: empty text, no choice, an empty list or an empty group. */
function isBlankValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isBlankValue);
  return false;
}

/** The required fields (top level) still empty — what stands between this draft and publishing. */
export function requiredMissing(fields: readonly CmsFieldDefinition[], data: Record<string, unknown>): CmsFieldDefinition[] {
  return fields.filter((field) => field.required && field.type !== 'boolean' && isBlankValue(data[field.key]));
}

/** A field's value in a few words, for a row that shows it — or null when nothing is written. */
export function fieldValueInWords(field: CmsFieldDefinition, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (field.type === 'media') return count(value.length, 'file');
    if (field.type === 'reference') return count(value.length, 'link');
    if (field.type === 'group') return count(value.length, 'item');
    return value.map(String).join(', ');
  }
  switch (field.type) {
    case 'media':
      return 'Added';
    case 'reference':
      return 'Linked';
    case 'boolean':
      return value === true ? 'Yes' : 'No';
    case 'richText':
      return plainText(String(value)) || null;
    case 'dateTime': {
      const at = new Date(String(value));
      return Number.isNaN(at.getTime()) ? String(value) : formatInstant(at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    case 'date': {
      const [year, month, day] = String(value).split('-').map(Number);
      if (!year || !month || !day) return String(value);
      return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    case 'location': {
      const point = value as { lat?: unknown; lng?: unknown };
      return typeof point.lat === 'number' && typeof point.lng === 'number' ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : null;
    }
    case 'json':
      return 'Set';
    case 'group': {
      const filled = (field.fields ?? []).filter((sub) => fieldValueInWords(sub, (value as Record<string, unknown>)[sub.key]) !== null).length;
      return filled === 0 ? null : `${filled} of ${(field.fields ?? []).length} filled`;
    }
  }
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim() || null;
  return String(value);
}
