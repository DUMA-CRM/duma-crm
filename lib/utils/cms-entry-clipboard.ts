import type { CmsContentType, CmsFieldDefinition, CmsLocale } from '@/lib/api/cms.service';

// ---------------------------------------------------------------------------
// Copying an entry as JSON and pasting it into another workspace — usually the
// same model on local and on production. The model is matched by its `key`
// (ids differ between environments). Media and references are ids too: they
// mean nothing in another workspace and the API refuses a link it can't find,
// so they are cleared on the way in and listed for the editor to pick again.
// ---------------------------------------------------------------------------

export const ENTRY_CLIPBOARD_FORMAT = 'duma-cms-entry';

export interface EntryClipboard {
  format: typeof ENTRY_CLIPBOARD_FORMAT;
  version: 1;
  /** Where it was copied from — a paste into the same workspace keeps its links. */
  source: { origin: string; tenantId: string };
  contentType: { key: string; name: string };
  locale: string;
  title: string | null;
  data: Record<string, unknown>;
}

export interface EntryWorkspace {
  origin: string;
  tenantId: string;
}

export function entryClipboard(
  entry: { locale: string; title: string | null; contentType: { key: string; name: string } },
  data: Record<string, unknown>,
  source: EntryWorkspace,
): EntryClipboard {
  return {
    format: ENTRY_CLIPBOARD_FORMAT,
    version: 1,
    source,
    contentType: { key: entry.contentType.key, name: entry.contentType.name },
    locale: entry.locale,
    title: entry.title,
    data,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The copied entry, or null for anything else on the clipboard. */
export function parseEntryClipboard(text: string): EntryClipboard | null {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (!isRecord(value) || value.format !== ENTRY_CLIPBOARD_FORMAT || value.version !== 1) return null;
  const { source, contentType, locale, title, data } = value;
  if (!isRecord(source) || typeof source.origin !== 'string' || typeof source.tenantId !== 'string') return null;
  if (!isRecord(contentType) || typeof contentType.key !== 'string' || typeof contentType.name !== 'string') return null;
  if (typeof locale !== 'string' || !isRecord(data)) return null;
  return {
    format: ENTRY_CLIPBOARD_FORMAT,
    version: 1,
    source: { origin: source.origin, tenantId: source.tenantId },
    contentType: { key: contentType.key, name: contentType.name },
    locale,
    title: typeof title === 'string' ? title : null,
    data,
  };
}

/** A CMS asset addressed by id in a URL — rich text images uploaded to the source workspace. */
const ASSET_URL = /\/cms\/(?:delivery\/)?assets\/[0-9a-f-]{36}/i;

interface Carried {
  data: Record<string, unknown>;
  /** Dotted paths of media/reference values left out. */
  cleared: string[];
  /** Top-level keys the target model doesn't have. */
  unknown: string[];
  /** Rich text fields whose images still point at the source workspace. */
  linkedImages: string[];
}

function carryFields(
  fields: readonly CmsFieldDefinition[],
  input: Record<string, unknown>,
  keepLinks: boolean,
  path: string,
  out: Omit<Carried, 'data' | 'unknown'>,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.key in input)) continue;
    const value = input[field.key];
    const at = `${path}${field.key}`;
    if (field.type === 'media' || field.type === 'reference') {
      const empty = value === null || value === undefined || (Array.isArray(value) && value.length === 0);
      if (keepLinks || empty) data[field.key] = value;
      else out.cleared.push(at);
    } else if (field.type === 'group' && Array.isArray(value)) {
      data[field.key] = value.map((item, index) =>
        isRecord(item) ? carryFields(field.fields ?? [], item, keepLinks, `${at}.${index}.`, out) : item,
      );
    } else if (field.type === 'group' && isRecord(value)) {
      data[field.key] = carryFields(field.fields ?? [], value, keepLinks, `${at}.`, out);
    } else {
      if (!keepLinks && field.type === 'richText' && typeof value === 'string' && ASSET_URL.test(value)) out.linkedImages.push(at);
      data[field.key] = value;
    }
  }
  return data;
}

export type EntryPastePlan =
  | {
      ok: true;
      contentTypeId: string;
      typeName: string;
      /** Undefined: the workspace's default language (the copied one isn't set up here). */
      locale: string | undefined;
      sameWorkspace: boolean;
      data: Record<string, unknown>;
      cleared: string[];
      unknown: string[];
      linkedImages: string[];
    }
  | { ok: false; error: string };

/** What pasting `clip` here would create: the model it lands in and the values it keeps. */
export function planEntryPaste(
  clip: EntryClipboard,
  here: EntryWorkspace,
  types: ReadonlyArray<Pick<CmsContentType, 'id' | 'key' | 'name' | 'fields'>>,
  locales: ReadonlyArray<Pick<CmsLocale, 'code'>>,
): EntryPastePlan {
  const type = types.find((candidate) => candidate.key === clip.contentType.key);
  if (!type)
    return { ok: false, error: `This workspace has no “${clip.contentType.name}” model (key ${clip.contentType.key}). Create it first.` };
  const sameWorkspace = clip.source.origin === here.origin && clip.source.tenantId === here.tenantId;
  const out = { cleared: [] as string[], linkedImages: [] as string[] };
  const data = carryFields(type.fields, clip.data, sameWorkspace, '', out);
  const known = new Set(type.fields.map((field) => field.key));
  return {
    ok: true,
    contentTypeId: type.id,
    typeName: type.name,
    locale: locales.some((row) => row.code === clip.locale) ? clip.locale : undefined,
    sameWorkspace,
    data,
    cleared: out.cleared,
    unknown: Object.keys(clip.data).filter((key) => !known.has(key)),
    linkedImages: out.linkedImages,
  };
}
