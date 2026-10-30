import { API_KEY_SCOPES, type ApiEndpoint, PUBLIC_APIS, type PublicApiId, SCOPES } from '@/lib/developers/api-reference';
import { MANAGEMENT_REFERENCE } from '@/lib/developers/management-reference';
import { type DocField, ENDPOINT_DOCS, type EndpointDoc } from '@/lib/marketing/api-docs-endpoints';
import source from '@/openapi.json';

/**
 * The public developer docs (/developers and one page per endpoint), after
 * seline.com/api. Sources, in order of authority:
 *
 * - PUBLIC_APIS (lib/developers/api-reference.ts) — which endpoints are public
 *   and the scope each needs; the same registry Settings → Developers uses.
 * - ENDPOINT_DOCS (lib/marketing/api-docs-endpoints.ts) — parameters, bodies
 *   and example responses for the Store, Content and Content Management APIs,
 *   read from the duma-api handlers (openapi.json has none for them).
 * - openapi.json — body schemas and response codes for the management API,
 *   whose operations are MANAGEMENT_REFERENCE (the list the MCP server registers).
 *
 * Facts that live in none of those are below, each with its duma-api source.
 */

/** Production API origin — api.duma-business.com since the domain move (2026-10-27). */
export const API_ORIGIN = 'https://api.duma-business.com';

/** Default per-key limits, per minute: duma-api middleware/rate-limit.ts (store, cmsDelivery, cmsManage, mcp). */
export const RATE_LIMITS: readonly { api: string; perMinute: number }[] = [
  { api: 'Store API', perMinute: 600 },
  { api: 'Content API', perMinute: 600 },
  { api: 'Content Management API', perMinute: 60 },
  { api: 'MCP server', perMinute: 120 },
];

export type { DocField };

export type DocEndpoint = {
  slug: string;
  api: PublicApiId;
  apiName: string;
  /** The sidebar group — the API's name, or the area for management operations. */
  group: string;
  /** Short, for the sidebar and heading ("List products"). */
  title: string;
  /** The registry's one-line summary. */
  summary: string;
  method: ApiEndpoint['method'];
  fullPath: string;
  scope: string | null;
  /** Whether the scope can sit on a publishable (browser) key. */
  publishable: boolean;
  description: string;
  pathParams: DocField[];
  queryParams: DocField[];
  bodyFields: DocField[];
  exampleBody?: unknown;
  /** A JSON example, when the response shape is known from the source. */
  exampleResponse?: unknown;
  /** Otherwise, the response codes the operation can answer with. */
  responses?: { status: string; description: string }[];
  successStatus?: number;
  notes: string[];
  destructive: boolean;
};

type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});
const spec = source as unknown as { paths: Record<string, Json> };

/** Page slugs for the hand-documented APIs, with the short title each page and sidebar shows. */
const PAGES: Record<string, [slug: string, title: string]> = {
  'store GET /products': ['list-products', 'List products'],
  'store GET /products/{idOrSlug}': ['get-product', 'Get a product'],
  'store GET /categories': ['list-categories', 'List categories'],
  'store GET /locales': ['store-locales', 'Languages and currencies'],
  'store POST /orders/quote': ['quote-order', 'Quote a basket'],
  'store POST /orders': ['create-order', 'Create an order'],
  'store POST /referral-code': ['referral-code', 'Referral code'],
  'store POST /newsletter': ['newsletter-subscribe', 'Subscribe'],
  'store POST /newsletter/unsubscribe': ['newsletter-unsubscribe', 'Unsubscribe'],
  'content GET /content-types': ['list-content-types', 'List content types'],
  'content GET /content-types/{typeKey}': ['get-content-type', 'Get a content type'],
  'content GET /locales': ['content-locales', 'Languages'],
  'content GET /entries/{typeKey}': ['list-entries', 'List entries'],
  'content GET /entries/{typeKey}/{idOrSlug}': ['get-entry', 'Get an entry'],
  'content GET /singletons/{typeKey}': ['get-singleton', 'Get a singleton'],
  'content GET /assets/{id}': ['get-asset', 'Get an asset'],
  'content GET /assets/{id}/file/{name}': ['asset-file', 'Asset file'],
  'content GET /sync': ['sync', 'Sync changes'],
  'content GET /preview/{token}': ['preview', 'Preview a draft'],
  'manage POST /content-types': ['create-content-type', 'Create a content type'],
  'manage POST /entries/{typeKey}': ['create-entry', 'Create a draft entry'],
};

const MANAGEMENT_AREA: Record<string, string> = {
  cms: 'Content',
  notes: 'Notes',
  workspace: 'Workspace',
  setup: 'Workspace',
  trading: 'Workspace',
  locations: 'Locations',
  catalog: 'Catalogue',
  categories: 'Catalogue',
  products: 'Catalogue',
};

const AREA_ORDER = ['Content', 'Media', 'Notes', 'Catalogue', 'Locations', 'Workspace'];

/** Selling and reading first, then writing, then the management API. */
const API_ORDER: PublicApiId[] = ['store', 'content', 'manage', 'management'];
const orderedApis = () => API_ORDER.map((id) => PUBLIC_APIS.find((api) => api.id === id)!);

type ManagementOp = {
  name: string;
  title: string;
  domain: string;
  method: ApiEndpoint['method'];
  path: string;
  scope: string;
  destructive: boolean;
  writes: boolean;
};

const sentence = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const areaOf = (op: ManagementOp) => (op.name.startsWith('media_') ? 'Media' : (MANAGEMENT_AREA[op.domain] ?? 'Workspace'));

/** A schema's type in one word: `string`, `number[]`, `object`, `string | null`. */
function typeOf(schema: Json): string {
  if (Array.isArray(schema.anyOf)) return [...new Set((schema.anyOf as Json[]).map((s) => typeOf(obj(s))))].join(' | ');
  if (schema.type === 'array') return `${typeOf(obj(schema.items))}[]`;
  if (typeof schema.type === 'string') return schema.type;
  if (typeof schema.$ref === 'string') return 'object';
  return 'value';
}

/** Words for a schema's limits — openapi.json's own descriptions here are generated ("name for create type."). */
function constraints(schema: Json): string {
  const parts: string[] = [];
  if (typeof schema.minLength === 'number' && typeof schema.maxLength === 'number')
    parts.push(`${schema.minLength}–${schema.maxLength} characters`);
  else if (typeof schema.maxLength === 'number') parts.push(`up to ${schema.maxLength} characters`);
  if (typeof schema.maxItems === 'number') parts.push(`up to ${schema.maxItems} items`);
  if (schema.format === 'uuid') parts.push('a UUID');
  else if (typeof schema.format === 'string') parts.push(schema.format);
  if (typeof schema.minimum === 'number') parts.push(`at least ${schema.minimum}`);
  if (Array.isArray(schema.anyOf) && (schema.anyOf as Json[]).some((s) => s.type === 'null')) parts.push('can be null');
  const own = typeof schema.description === 'string' && !/ for [a-z ]+\.$/i.test(schema.description) ? schema.description : '';
  return [own, parts.length ? `${sentence(parts.join(', '))}.` : ''].filter(Boolean).join(' ');
}

function enumOf(schema: Json): string[] | undefined {
  const values = Array.isArray(schema.enum)
    ? schema.enum
    : Array.isArray(schema.anyOf)
      ? (schema.anyOf as Json[]).flatMap((s) => (Array.isArray(s.enum) ? s.enum : []))
      : [];
  return values.length ? values.map(String) : undefined;
}

function bodyFieldsOf(op: Json): DocField[] {
  const schema = obj(obj(obj(obj(op.requestBody).content)['application/json']).schema);
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  return Object.entries(obj(schema.properties)).map(([name, raw]) => {
    const field = obj(raw);
    return { name, type: typeOf(field), required: required.has(name), description: constraints(field), values: enumOf(field) };
  });
}

function paramsOf(item: Json, op: Json, where: 'path' | 'query'): DocField[] {
  return [...((item.parameters as unknown[]) ?? []), ...((op.parameters as unknown[]) ?? [])]
    .map(obj)
    .filter((p) => p.in === where && typeof p.name === 'string')
    .map((p) => ({
      name: p.name as string,
      type: typeOf(obj(p.schema)),
      required: Boolean(p.required),
      description: constraints(obj(p.schema)) || (typeof p.description === 'string' ? p.description : ''),
    }));
}

const publishableScope = (scope: string | null) => Boolean(scope && SCOPES[scope as keyof typeof SCOPES]?.publishable);

let cache: DocEndpoint[] | null = null;

/** Every public endpoint, in sidebar order, each to be rendered as its own page. */
export function docEndpoints(): DocEndpoint[] {
  if (cache) return cache;
  const docs = new Map<string, EndpointDoc>(ENDPOINT_DOCS.map((doc) => [`${doc.api} ${doc.method} ${doc.path}`, doc]));
  const endpoints: DocEndpoint[] = [];

  for (const api of orderedApis().filter((a) => a.id !== 'management')) {
    for (const endpoint of api.endpoints) {
      const key = `${api.id} ${endpoint.method} ${endpoint.path}`;
      const doc = docs.get(key);
      const [slug, title] = PAGES[key] ?? [key.toLowerCase().replace(/[^a-z0-9]+/g, '-'), sentence(endpoint.summary)];
      endpoints.push({
        slug,
        api: api.id,
        apiName: api.name,
        group: api.name,
        title,
        summary: sentence(endpoint.summary),
        method: endpoint.method,
        fullPath: `${api.basePath}${endpoint.path}`,
        scope: endpoint.scope,
        publishable: publishableScope(endpoint.scope),
        description: doc?.description ?? `${sentence(endpoint.summary)}.`,
        pathParams: doc?.pathParams ?? [],
        queryParams: doc?.queryParams ?? [],
        bodyFields: doc?.bodyFields ?? [],
        exampleBody: doc?.exampleBody,
        exampleResponse: doc?.exampleResponse,
        successStatus: doc?.successStatus,
        // The page states the scope and key kind itself, so notes that only repeat them are dropped.
        notes: (doc?.notes ?? []).filter((note) => !/^(Secret key only|Scope `)/.test(note)),
        destructive: false,
      });
    }
  }

  const management = PUBLIC_APIS.find((a) => a.id === 'management')!;
  const ops = [...(MANAGEMENT_REFERENCE.operations as readonly ManagementOp[])].sort(
    (a, b) => AREA_ORDER.indexOf(areaOf(a)) - AREA_ORDER.indexOf(areaOf(b)),
  );
  for (const op of ops) {
    // MANAGEMENT_REFERENCE paths are relative to the area: /v1/manage/{domain}{path}, `:id` written `{id}`.
    const specPath = `${management.basePath}/${op.domain}${op.path.replace(/:([A-Za-z]+)/g, '{$1}')}`;
    const item = obj(spec.paths[specPath]);
    const opSpec = obj(item[op.method.toLowerCase()]);
    endpoints.push({
      slug: op.name.replace(/_/g, '-'),
      api: 'management',
      apiName: management.name,
      group: areaOf(op),
      title: sentence(op.title),
      summary: sentence(op.title),
      method: op.method,
      fullPath: specPath.replace(/\/$/, ''),
      scope: op.scope,
      publishable: false,
      description: `${sentence(op.title)}, with the permissions the key’s creator has in DUMA today.`,
      pathParams: paramsOf(item, opSpec, 'path'),
      queryParams: paramsOf(item, opSpec, 'query'),
      bodyFields: bodyFieldsOf(opSpec),
      responses: Object.entries(obj(opSpec.responses)).map(([status, r]) => ({ status, description: String(obj(r).description ?? '') })),
      notes: op.destructive ? ['Deletes data — check the target before sending.'] : [],
      destructive: op.destructive,
    });
  }
  cache = endpoints;
  return endpoints;
}

export function docEndpoint(slug: string): DocEndpoint | undefined {
  return docEndpoints().find((endpoint) => endpoint.slug === slug);
}

export type DocsNavLink = { href: string; label: string; method?: string; path?: string };
export type DocsNavSection = { title: string; groups: { title?: string; links: DocsNavLink[] }[] };

/** The docs sidebar: the guides, then every endpoint grouped by API — and the management API by area. */
export function docsNav(): DocsNavSection[] {
  const endpoints = docEndpoints();
  const link = (e: DocEndpoint): DocsNavLink => ({ href: `/developers/${e.slug}`, label: e.title, method: e.method, path: e.fullPath });
  const apiGroups = orderedApis()
    .filter((a) => a.id !== 'management')
    .map((api) => ({ title: api.name, links: endpoints.filter((e) => e.api === api.id).map(link) }));
  const managementGroups = AREA_ORDER.map((area) => ({
    title: `Manage · ${area}`,
    links: endpoints.filter((e) => e.api === 'management' && e.group === area).map(link),
  })).filter((group) => group.links.length > 0);
  return [
    {
      title: 'Public API',
      groups: [
        {
          links: [
            { href: '/developers', label: 'Overview' },
            { href: '/developers/mcp', label: 'MCP' },
          ],
        },
      ],
    },
    { title: 'Endpoints', groups: [...apiGroups, ...managementGroups] },
  ];
}

/** The public APIs in docs order. */
export const docApis = orderedApis;

/** Every scope a key can hold, in words, and whether a browser-safe key may hold it. */
export function docScopes() {
  return API_KEY_SCOPES.map((scope) => ({ scope, ...SCOPES[scope] }));
}

/**
 * The MCP server's core tools — duma-api lib/mcp-tools.ts. They wrap the
 * Content, Content Management and Store APIs; the management tools after them
 * come from MANAGEMENT_REFERENCE, the same list the server registers.
 */
const CORE_TOOLS: readonly { name: string; scope: string }[] = [
  { name: 'workspace_info', scope: 'any key' },
  { name: 'content_list_types', scope: 'content:read' },
  { name: 'content_get_type', scope: 'content:read' },
  { name: 'content_list_locales', scope: 'content:read' },
  { name: 'content_list_entries', scope: 'content:read' },
  { name: 'content_get_entry', scope: 'content:read' },
  { name: 'content_get_singleton', scope: 'content:read' },
  { name: 'content_get_asset', scope: 'content:read' },
  { name: 'content_sync', scope: 'content:read' },
  { name: 'content_create_type', scope: 'content:models' },
  { name: 'content_create_entry', scope: 'content:write' },
  { name: 'store_list_products', scope: 'catalog:read' },
  { name: 'store_get_product', scope: 'catalog:read' },
  { name: 'store_list_categories', scope: 'catalog:read' },
  { name: 'store_list_locales', scope: 'catalog:read' },
  { name: 'store_get_order', scope: 'orders:write' },
  { name: 'store_quote_order', scope: 'orders:write' },
];

export type McpTool = { name: string; scope: string; writes: boolean; destructive: boolean; slug?: string };

/** MCP tools grouped for the docs: core reads and drafts, then management by area, linked to their endpoint pages. */
export function mcpToolGroups(): { title: string; tools: McpTool[] }[] {
  const groups = new Map<string, McpTool[]>();
  const add = (title: string, tool: McpTool) => groups.set(title, [...(groups.get(title) ?? []), tool]);
  for (const tool of CORE_TOOLS) {
    // A quote prices a basket and records nothing, so only the create tools write.
    add(tool.name.startsWith('store_') ? 'Store' : tool.name === 'workspace_info' ? 'Workspace' : 'Content', {
      ...tool,
      writes: tool.name.includes('create'),
      destructive: false,
    });
  }
  for (const op of MANAGEMENT_REFERENCE.operations as readonly ManagementOp[]) {
    add(areaOf(op), { name: op.name, scope: op.scope, writes: op.writes, destructive: op.destructive, slug: op.name.replace(/_/g, '-') });
  }
  const order = ['Content', 'Store', ...AREA_ORDER.filter((a) => a !== 'Content')];
  return order.filter((title) => groups.has(title)).map((title) => ({ title, tools: groups.get(title)! }));
}

export const MCP_TOOL_COUNT = CORE_TOOLS.length + MANAGEMENT_REFERENCE.operations.length;
