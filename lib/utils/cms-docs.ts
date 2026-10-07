import type { CmsContentType, CmsFieldDefinition, CmsLocale } from '../api/cms.service.ts';

// ---------------------------------------------------------------------------
// Generated documentation for the CMS delivery API: TypeScript types, example
// payloads, and the integration prompt an AI coding assistant is handed.
//
// Everything here describes duma-api `routes/cms-delivery.ts` and
// `lib/cms-query.ts`. If those change, this file is the one to update — the
// prompt is copied into other people's projects, so a wrong claim here becomes
// a wrong integration there. It never contains a key.
// ---------------------------------------------------------------------------

export type DocsType = Pick<CmsContentType, 'key' | 'name' | 'kind' | 'description' | 'fields'>;
export type DocsLocale = Pick<CmsLocale, 'code' | 'name' | 'isDefault' | 'fallbackCode'>;

export const deliveryBase = (apiOrigin: string) => `${apiOrigin.replace(/\/$/, '')}/v1/cms/delivery`;

/** `blog-post` → `BlogPost`. */
export function pascalCase(key: string): string {
  const name = key
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Za-z]/.test(name) ? name : `T${name}`;
}

const publicFields = (fields: readonly CmsFieldDefinition[]) => fields.filter((field) => !field.private);
const isList = (field: CmsFieldDefinition) => Boolean(field.multiple) && ['select', 'media', 'reference', 'group'].includes(field.type);
const quote = (value: string) => JSON.stringify(value);

function tsTypeOf(field: CmsFieldDefinition, indent: string): string {
  let single: string;
  switch (field.type) {
    case 'number':
      single = 'number';
      break;
    case 'boolean':
      single = 'boolean';
      break;
    case 'select':
      single = field.options && field.options.length > 0 ? field.options.map(quote).join(' | ') : 'string';
      break;
    case 'location':
      single = '{ lat: number; lng: number }';
      break;
    case 'json':
      single = 'unknown';
      break;
    case 'media':
      single = 'DumaAsset';
      break;
    case 'reference':
      single = field.referenceTypes && field.referenceTypes.length === 1 ? `DumaLink<${pascalCase(field.referenceTypes[0]!)}Fields>` : 'DumaLink';
      break;
    case 'group':
      single = `{\n${fieldLines(field.fields ?? [], `${indent}  `)}\n${indent}}`;
      break;
    default:
      single = 'string';
  }
  if (!isList(field)) return single;
  return single.includes('|') && !single.startsWith('{') ? `Array<${single}>` : `${single}[]`;
}

function fieldLines(fields: readonly CmsFieldDefinition[], indent: string): string {
  return publicFields(fields)
    .map((field) => {
      const doc = field.description ? `${indent}/** ${field.description.replace(/\*\//g, '* /')} */\n` : '';
      return `${doc}${indent}${field.key}${field.required ? '' : '?'}: ${tsTypeOf(field, indent)};`;
    })
    .join('\n');
}

/** TypeScript for the delivery API's responses, shaped by this workspace's models. */
export function typeScriptTypes(types: readonly DocsType[]): string {
  const header = `// Generated from your DUMA content models. Fields marked private are never delivered.

export interface DumaAsset {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  title: string | null;
  altText: string | null;
}

export interface DumaEntry<TFields> {
  /** Document id — the same across every locale of this entry. */
  id: string;
  type: string;
  locale: string;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  firstPublishedAt: string | null;
  fields: TFields;
}

/** A resolved link, or just \`{ id }\` beyond the include depth or when unpublished. */
export type DumaLink<TFields = Record<string, unknown>> = DumaEntry<TFields> | { id: string };

export interface DumaList<TFields> {
  data: DumaEntry<TFields>[];
  meta: { total: number; limit: number; offset: number; page: number; pages: number; locale: string | null };
}`;
  const models = types.map((type) => `/** ${type.name}${type.kind === 'singleton' ? ' (singleton)' : ''} — \`${type.key}\` */\nexport interface ${pascalCase(type.key)}Fields {\n${fieldLines(type.fields, '  ') || '  // no public fields yet'}\n}`);
  return [header, ...models].join('\n\n');
}

function exampleValue(field: CmsFieldDefinition): unknown {
  const one = (): unknown => {
    switch (field.type) {
      case 'number':
        return field.min ?? (field.integer ? 1 : 4.5);
      case 'boolean':
        return true;
      case 'date':
        return '2026-10-06';
      case 'dateTime':
        return '2026-10-06T09:00:00.000Z';
      case 'select':
        return field.options?.[0] ?? 'option';
      case 'slug':
        return 'example-slug';
      case 'email':
        return 'hello@example.com';
      case 'url':
        return 'https://www.example.com';
      case 'color':
        return '#1f6f4a';
      case 'location':
        return { lat: 51.5072, lng: -0.1276 };
      case 'json':
        return { any: 'json' };
      case 'richText':
        return '## Heading\n\nSome **Markdown**.';
      case 'media':
        return { id: '7d9…', url: 'https://…/v1/cms/delivery/assets/7d9…/file/hero.jpg', mimeType: 'image/jpeg', width: 1600, height: 900, altText: '…' };
      case 'reference':
        return { id: '3c1…', type: field.referenceTypes?.[0] ?? 'entry', slug: 'linked-entry', fields: { '…': '…' } };
      case 'group':
        return Object.fromEntries(publicFields(field.fields ?? []).map((child) => [child.key, exampleValue(child)]));
      default:
        return field.label;
    }
  };
  return isList(field) ? [one()] : one();
}

/** A plausible delivered entry for a type, for the docs' response example. */
export function exampleEntry(type: DocsType, locale = 'en'): Record<string, unknown> {
  const slugField = type.fields.find((field) => field.type === 'slug');
  return {
    id: '0b6f2c1e-…',
    type: type.key,
    locale,
    slug: slugField ? 'example-slug' : null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-05T16:20:00.000Z',
    publishedAt: '2026-10-05T16:20:00.000Z',
    firstPublishedAt: '2026-10-01T08:30:00.000Z',
    fields: Object.fromEntries(publicFields(type.fields).map((field) => [field.key, exampleValue(field)])),
  };
}

const fieldSummary = (field: CmsFieldDefinition): string => {
  const flags = [field.required && 'required', field.unique && 'unique', isList(field) && 'list'].filter(Boolean).join(', ');
  const extra =
    field.type === 'select' && field.options ? ` one of ${field.options.map(quote).join(', ')}` : field.type === 'reference' && field.referenceTypes?.length ? ` → ${field.referenceTypes.join(' | ')}` : '';
  return `${field.key}: ${field.type}${extra}${flags ? ` (${flags})` : ''}`;
};

function modelOutline(types: readonly DocsType[]): string {
  if (types.length === 0) return '(No content types yet — fetch GET /content-types at runtime once some exist.)';
  return types
    .map((type) => {
      const lines = publicFields(type.fields).flatMap((field) => {
        const line = `    - ${fieldSummary(field)}`;
        if (field.type !== 'group') return [line];
        return [line, ...publicFields(field.fields ?? []).map((child) => `        - ${fieldSummary(child)}`)];
      });
      const route = type.kind === 'singleton' ? `GET /singletons/${type.key}` : `GET /entries/${type.key}`;
      return `- ${type.name} — key \`${type.key}\`, ${type.kind} (${route})${type.description ? `\n    ${type.description}` : ''}\n${lines.join('\n') || '    (no public fields)'}`;
    })
    .join('\n');
}

/**
 * The brief handed to an AI coding assistant to wire a project to this
 * workspace's content. Complete enough to work without the docs page, and
 * free of secrets: keys are referenced by environment variable only.
 */
export function buildAiPrompt({ apiOrigin, types, locales }: { apiOrigin: string; types: readonly DocsType[]; locales: readonly DocsLocale[] }): string {
  const base = deliveryBase(apiOrigin);
  const defaultLocale = locales.find((locale) => locale.isDefault)?.code ?? 'en';
  const localeLine =
    locales.length > 0
      ? locales.map((locale) => `${locale.code} (${locale.name}${locale.isDefault ? ', default' : locale.fallbackCode ? `, falls back to ${locale.fallbackCode}` : ''})`).join(', ')
      : 'en (default)';
  const sample = types.find((type) => type.kind === 'collection') ?? types[0];
  const sampleKey = sample?.key ?? 'blog-post';

  return `You are integrating this project with DUMA Content, a headless CMS. Read this whole brief, inspect the project (framework, router, data-fetching conventions, TypeScript or not), then implement the integration in the project's own idiom.

## Goal
Fetch published content from the DUMA Content delivery API and render it in this project. Create a small typed client module, wire pages/components to it, and support live updates via a webhook if the project is server-rendered or statically generated.

## Connection
- Base URL: ${base}
- Auth: send \`Authorization: Bearer <key>\` on every request (the \`X-Api-Key: <key>\` header also works).
- Keys (never hard-code them; read from environment variables):
  - DUMA_CMS_URL=${base}
  - DUMA_CMS_TOKEN=dcms_live_…   # delivery key: published content only; safe in a browser
  - DUMA_CMS_PREVIEW_TOKEN=dcms_prev_…   # preview key: also reads drafts — SERVER-SIDE ONLY, never ship to the client
- Add those names to .env.example (without real values) and document them in the README.
- Keys are created in DUMA → Content → API & webhooks. A key may be limited to some content types and to listed browser origins; requests outside its scope get 404 (type) or 403 (origin).

## Endpoints (all GET, all JSON)
- /content-types — the models this key can read (keys, fields)
- /content-types/{typeKey} — one model's schema
- /locales — the workspace's languages and fallbacks
- /entries/{typeKey} — list entries of a collection
- /entries/{typeKey}/{idOrSlug} — one entry by document id (UUID) or slug
- /singletons/{typeKey} — the single entry of a singleton type
- /assets/{id} — media metadata
- Media files are public and keyless at the \`url\` each asset carries — use it directly as an image source.

## Response shapes
List: { "data": Entry[], "meta": { "total", "limit", "offset", "page", "pages", "locale" } }
Single: { "data": Entry }
Entry: { "id" (document id, same across locales), "type", "locale", "slug", "createdAt", "updatedAt", "publishedAt", "firstPublishedAt", "fields": { …the model's public fields… } }
Asset (when resolved): { "id", "url", "fileName", "mimeType", "sizeBytes", "width", "height", "title", "altText" }
Linked entries resolve to full Entry objects up to the include depth; beyond it, or when the target is unpublished or outside the key's scope, a link is just { "id" }. Always handle both.

## Query parameters (lists; single/singleton accept locale, fallback, fields, include, status)
- filter[field][op]=value — ops: eq, ne, lt, lte, gt, gte, in, nin (comma-separated), contains, startsWith, exists (true/false). filter[field]=value means eq.
  - System fields: id, slug, createdAt, updatedAt, publishedAt. Nested group fields use dots: filter[seo.title][contains]=x.
  - List fields (multi-select, media, references): contains = holds the value; in = holds any of them.
- sort=-publishedAt,title — up to 3 keys, "-" for descending. Default: newest published first.
- limit (1–100, default 25) with page (1-based) or offset — not both.
- fields=title,hero — return only these fields.
- include=0..3 — resolve media and references this many levels deep (default 1).
- locale=${defaultLocale} and fallback=true|false — content is per language; with fallback (default true) a missing translation falls back along the chain to the default.
- q=… — full-text search over published text fields.
- status=draft — drafts instead of published content; preview keys only.
Unknown fields or unsupported operators return 400 with a message — fix the query rather than ignoring the error.

## This workspace's content models
Locales: ${localeLine}
${modelOutline(types)}

## Caching, limits, errors
- Responses carry an ETag; send If-None-Match to get 304 Not Modified. Cache-Control is private, max-age=30. Preview responses are no-store.
- Rate limit: about 600 requests per minute per key (429 when exceeded). Cache on your side; do not fetch per render in a hot loop.
- Errors are JSON { "error": string, "code"?: string }. 400 invalid_filter · 401 unauthorized (missing/unknown/revoked/expired key) · 403 origin not allowed or module disabled · 404 not found or not published · 429 rate_limited.

## Webhooks (for rebuilds / cache revalidation)
If the project prerenders or caches content, add an endpoint DUMA can POST to when content changes, and register its URL in DUMA → Content → API & webhooks.
- Headers: X-Duma-Event, X-Duma-Delivery, X-Duma-Timestamp (unix seconds), X-Duma-Signature: v1=<hex>.
- Verify: v1 = HMAC-SHA256(secret, \`\${timestamp}.\${rawBody}\`) in hex; compare in constant time; reject if |now - timestamp| > 300s. Use the RAW request body, before JSON parsing. Secret env var: DUMA_CMS_WEBHOOK_SECRET.
- Body: { "id", "event", "createdAt", "data" }. Events: entry.published, entry.unpublished, entry.deleted (data.entry = { id, entryId, type, locale, slug, version }), asset.changed (data.asset = { id }, data.change), and ping (a test from the dashboard).
- On an entry event, revalidate the pages that show that type/slug (e.g. Next.js revalidatePath/revalidateTag); respond 2xx quickly. Non-2xx responses are retried with backoff, up to 8 attempts.

## Implementation requirements
1. A single client module (e.g. lib/duma-cms.ts) exposing typed helpers such as getEntries(type, params), getEntry(type, idOrSlug, params), getSingleton(type, params). Build query strings with URLSearchParams, including the bracketed filter keys.
2. TypeScript types for each model above (the docs page in DUMA can generate them: Content → API docs).
3. Fetch on the server where the framework allows; use the preview key only server-side and only when preview mode is on.
4. Rich-text fields are GitHub-flavoured Markdown (tables, task lists, strikethrough, fenced code, autolinks). Render them with a GFM-capable renderer that sanitises or drops raw HTML; always render images with their altText.
5. Handle 404 as "not found" pages, and treat unresolved links ({ id } only) gracefully.
6. Add the webhook route if the project caches or prerenders, verifying the signature as described.
7. Do not invent endpoints or parameters beyond this brief. Example request to start with:
   GET ${base}/entries/${sampleKey}?sort=-publishedAt&limit=10&include=1&locale=${defaultLocale}
`;
}
