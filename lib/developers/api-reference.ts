// ---------------------------------------------------------------------------
// The public APIs a workspace's own website or app calls, in one registry.
//
// Settings → Developers renders from this: the endpoint lists in the API
// reference, the scope choices when creating a key, and the base URLs in the
// aside. To document a new call, add a row to its API's `endpoints`; to add a
// new public API, add an entry to `PUBLIC_APIS` (and, if it needs prose beyond
// its endpoint list, a guide component in components/settings/developers/).
//
// One workspace key (`dk_pub_…` / `dk_sec_…`, duma-api routes/api-keys.ts)
// opens all of them; what it may do is its scopes. Mirrors duma-api
// `lib/storefront.ts` — if a scope or its capability changes there, change it
// here, or the dialog offers what the API refuses.
// ---------------------------------------------------------------------------

export type ApiKeyKind = 'publishable' | 'secret';

export const API_KEY_SCOPES = [
  'content:read',
  'content:preview',
  'content:write',
  'content:models',
  'catalog:read',
  'orders:write',
  'customers:write',
  'newsletter:write',
] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export type PublicApiId = 'content' | 'manage' | 'store';

type GrantCapability = 'cms.keys:write' | 'cms:write' | 'cms.schema:write' | 'settings:write';

/**
 * Each scope, who may grant it, and whether a browser-safe key may hold it.
 * Granting needs every listed capability, so nobody hands a key more than
 * they could do themselves. `optIn` scopes are never ticked by default.
 */
export const SCOPES: Record<
  ApiKeyScope,
  {
    api: PublicApiId;
    label: string;
    detail: string;
    capabilities: readonly GrantCapability[];
    publishable: boolean;
    optIn?: boolean;
  }
> = {
  'content:read': {
    api: 'content',
    label: 'Read content',
    detail: 'Published entries, models, languages and media',
    capabilities: ['cms.keys:write'],
    publishable: true,
  },
  'content:preview': {
    api: 'content',
    label: 'Read drafts',
    detail: 'Unpublished entries, with status=draft',
    capabilities: ['cms.keys:write'],
    publishable: false,
  },
  'content:write': {
    api: 'manage',
    label: 'Create entries',
    detail: 'New entries, saved as drafts — an editor publishes them',
    capabilities: ['cms.keys:write', 'cms:write'],
    publishable: false,
    optIn: true,
  },
  'content:models': {
    api: 'manage',
    label: 'Create models',
    detail: 'New content types and their fields',
    capabilities: ['cms.keys:write', 'cms.schema:write'],
    publishable: false,
    optIn: true,
  },
  'catalog:read': {
    api: 'store',
    label: 'Read the catalogue',
    detail: 'Products, sizes, prices and stock',
    capabilities: ['settings:write'],
    publishable: true,
  },
  'orders:write': {
    api: 'store',
    label: 'Record orders',
    detail: 'Quotes and paid orders',
    capabilities: ['settings:write'],
    publishable: false,
  },
  'customers:write': {
    api: 'store',
    label: 'Refer a friend',
    detail: 'A shopper’s own referral code',
    capabilities: ['settings:write'],
    publishable: false,
  },
  'newsletter:write': {
    api: 'store',
    label: 'Newsletter',
    detail: 'Sign-ups and unsubscribes',
    capabilities: ['settings:write'],
    publishable: false,
  },
};

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Relative to the API's base, `{param}` style. */
  path: string;
  summary: string;
  /** The scope a key needs. Null: no key at all (a public file, a signed link). */
  scope: ApiKeyScope | null;
}

export interface PublicApi {
  id: PublicApiId;
  name: string;
  /** Under the API origin. */
  basePath: string;
  summary: string;
  /** The workspace module that must be on for the API to answer. */
  moduleId: 'cms' | 'catalog';
  endpoints: readonly ApiEndpoint[];
}

export const PUBLIC_APIS: readonly PublicApi[] = [
  {
    id: 'content',
    name: 'Content API',
    basePath: '/v1/cms/delivery',
    summary: 'Read-only: your published entries, models, languages and media.',
    moduleId: 'cms',
    endpoints: [
      { method: 'GET', path: '/content-types', summary: 'The models this key can read, with their public fields', scope: 'content:read' },
      { method: 'GET', path: '/content-types/{typeKey}', summary: 'One model’s schema', scope: 'content:read' },
      { method: 'GET', path: '/locales', summary: 'Languages and their fallbacks', scope: 'content:read' },
      { method: 'GET', path: '/entries/{typeKey}', summary: 'A page of a collection’s entries', scope: 'content:read' },
      { method: 'GET', path: '/entries/{typeKey}/{idOrSlug}', summary: 'One entry, by document id or slug', scope: 'content:read' },
      { method: 'GET', path: '/singletons/{typeKey}', summary: 'A singleton’s one entry', scope: 'content:read' },
      { method: 'GET', path: '/assets/{id}', summary: 'Media metadata', scope: 'content:read' },
      { method: 'GET', path: '/assets/{id}/file/{name}', summary: 'The file itself — for an image or video source', scope: null },
      { method: 'GET', path: '/sync', summary: 'What changed since a moment — for mirroring', scope: 'content:read' },
      { method: 'GET', path: '/preview/{token}', summary: 'One draft, for a shared preview link', scope: null },
    ],
  },
  {
    id: 'manage',
    name: 'Content Management API',
    basePath: '/v1/cms/manage',
    summary: 'Write: create content models, and entries as drafts. Nothing is published — an editor does that in DUMA.',
    moduleId: 'cms',
    endpoints: [
      { method: 'POST', path: '/content-types', summary: 'Create a model with its fields', scope: 'content:models' },
      { method: 'POST', path: '/entries/{typeKey}', summary: 'Create an entry, as a draft', scope: 'content:write' },
    ],
  },
  {
    id: 'store',
    name: 'Store API',
    basePath: '/v1/store',
    summary: 'Sell through DUMA: show products, price a basket, record paid orders, add subscribers.',
    moduleId: 'catalog',
    endpoints: [
      { method: 'GET', path: '/products', summary: 'Products, sizes, prices and stock', scope: 'catalog:read' },
      { method: 'GET', path: '/products/{idOrSlug}', summary: 'One product', scope: 'catalog:read' },
      { method: 'GET', path: '/categories', summary: 'Categories with products for sale', scope: 'catalog:read' },
      { method: 'GET', path: '/locales', summary: 'The languages and currencies it sells in', scope: 'catalog:read' },
      { method: 'POST', path: '/orders/quote', summary: 'Price a basket before payment — records nothing', scope: 'orders:write' },
      { method: 'POST', path: '/orders', summary: 'A paid order', scope: 'orders:write' },
      { method: 'POST', path: '/referral-code', summary: 'A shopper’s refer-a-friend code', scope: 'customers:write' },
      { method: 'POST', path: '/newsletter', summary: 'A newsletter sign-up', scope: 'newsletter:write' },
      { method: 'POST', path: '/newsletter/unsubscribe', summary: 'Take an address off the list', scope: 'newsletter:write' },
    ],
  },
];

export const publicApi = (id: PublicApiId): PublicApi => PUBLIC_APIS.find((api) => api.id === id)!;

/** APIs served by the Content module — documented and offered only while it is on. */
export const isContentApi = (id: PublicApiId): boolean => publicApi(id).moduleId === 'cms';

export const apiBase = (apiOrigin: string, api: PublicApi): string => `${apiOrigin.replace(/\/$/, '')}${api.basePath}`;

/** Whether a key of this kind may ever hold the scope. */
export const kindAllows = (kind: ApiKeyKind, scope: ApiKeyScope): boolean => kind === 'secret' || SCOPES[scope].publishable;

/**
 * The scopes this person may put on a key of this kind — the API refuses the
 * rest (duma-api `grantableScopes`). Order follows `API_KEY_SCOPES`.
 */
export function grantableScopes(kind: ApiKeyKind, capabilities: readonly string[]): ApiKeyScope[] {
  return API_KEY_SCOPES.filter((scope) => kindAllows(kind, scope) && SCOPES[scope].capabilities.every((c) => capabilities.includes(c)));
}

/** Whether this person may change or revoke a key holding these scopes. */
export const canManageKey = (scopes: readonly string[], capabilities: readonly string[]): boolean =>
  scopes.every((scope) => scope in SCOPES && SCOPES[scope as ApiKeyScope].capabilities.every((c) => capabilities.includes(c)));

/** The APIs a key's scopes open, in registry order. */
export const apisOf = (scopes: readonly string[]): PublicApi[] =>
  PUBLIC_APIS.filter((api) => scopes.some((scope) => scope in SCOPES && SCOPES[scope as ApiKeyScope].api === api.id));

/** A secret key that records orders sells from a location; until it has one, orders are refused. */
export const keyNeedsLocation = (key: { kind: ApiKeyKind; scopes: readonly string[]; locationId: string | null }): boolean =>
  key.kind === 'secret' && key.scopes.includes('orders:write') && !key.locationId;

/** A secret key's choices, adjusted for a change of kind: a publishable key keeps only what is safe in a browser. */
export const scopesForKind = (kind: ApiKeyKind, scopes: readonly ApiKeyScope[]): ApiKeyScope[] =>
  scopes.filter((scope) => kindAllows(kind, scope));

// ─── MCP ─────────────────────────────────────────────────────────────────────
//
// The same key, for AI coding assistants: a remote MCP server (Streamable HTTP)
// whose tools wrap the public REST endpoints above, so each answers exactly as
// its endpoint would. It writes only what an editor still reviews — models and
// draft entries, with opt-in scopes — and never records orders or publishes.
// Mirrors duma-api `lib/mcp-tools.ts`.

export const MCP_PATH = '/v1/mcp';

export interface McpTool {
  name: string;
  summary: string;
  /** The scope a key needs for the tool to be listed. Null: any valid key. */
  scope: ApiKeyScope | null;
  /** Creates something. Only ever drafts and models — never orders, never published content. */
  writes?: boolean;
}

export const MCP_TOOLS: readonly McpTool[] = [
  { name: 'workspace_info', summary: 'The key, its scopes, the APIs it opens and their base URLs', scope: null },
  { name: 'content_list_types', summary: 'The models this key can read', scope: 'content:read' },
  { name: 'content_get_type', summary: 'One model’s schema', scope: 'content:read' },
  { name: 'content_list_locales', summary: 'Languages and their fallbacks', scope: 'content:read' },
  { name: 'content_list_entries', summary: 'A page of entries — filter, sort, locale, search', scope: 'content:read' },
  { name: 'content_get_entry', summary: 'One entry, by id or slug', scope: 'content:read' },
  { name: 'content_get_singleton', summary: 'A singleton’s one entry', scope: 'content:read' },
  { name: 'content_get_asset', summary: 'Media metadata and URLs', scope: 'content:read' },
  { name: 'content_sync', summary: 'What changed since a moment', scope: 'content:read' },
  { name: 'content_create_type', summary: 'Create a model with its fields', scope: 'content:models', writes: true },
  { name: 'content_create_entry', summary: 'Create an entry, as a draft', scope: 'content:write', writes: true },
  { name: 'store_list_products', summary: 'Products, sizes, prices and stock', scope: 'catalog:read' },
  { name: 'store_get_product', summary: 'One product', scope: 'catalog:read' },
  { name: 'store_list_categories', summary: 'Categories with products for sale', scope: 'catalog:read' },
  { name: 'store_list_locales', summary: 'The languages and currencies it sells in', scope: 'catalog:read' },
  { name: 'store_quote_order', summary: 'Price a basket — records nothing', scope: 'orders:write' },
];

export const mcpUrl = (apiOrigin: string): string => `${apiOrigin.replace(/\/$/, '')}${MCP_PATH}`;

/** The tools a key with these scopes is offered — the server lists the same. */
export const mcpToolsFor = (scopes: readonly string[]): McpTool[] => MCP_TOOLS.filter((tool) => !tool.scope || scopes.includes(tool.scope));

/** Ready-to-paste client set-ups. The key stays in an environment variable, never in the file. */
export function mcpClientConfigs(apiOrigin: string): Array<{ label: string; language: string; code: string }> {
  const url = mcpUrl(apiOrigin);
  return [
    {
      label: 'Claude Code',
      language: 'shell',
      code: `claude mcp add --transport http duma ${url} \\\n  --header "Authorization: Bearer $DUMA_PUBLISHABLE_KEY"`,
    },
    {
      label: 'Cursor',
      language: '.cursor/mcp.json',
      code: JSON.stringify({ mcpServers: { duma: { url, headers: { Authorization: 'Bearer ${env:DUMA_PUBLISHABLE_KEY}' } } } }, null, 2),
    },
    {
      label: 'Any client',
      language: 'JSON',
      code: JSON.stringify({ type: 'http', url, headers: { Authorization: 'Bearer <your dk_ key>' } }, null, 2),
    },
  ];
}
