import { MCP_PATH, PUBLIC_APIS, apiBase } from '@/lib/developers/api-reference';
import { API_ORIGIN } from '@/lib/marketing/developers';
import { absoluteUrl } from '@/lib/marketing/site';

type Link = { href: string; type?: string; title?: string };
type LinksetEntry = { anchor: string; 'service-desc'?: Link[]; 'service-doc': Link[]; status: Link[] };

/**
 * /.well-known/api-catalog (RFC 9727): every public DUMA API, for automated
 * discovery. Only the Store API has a `service-desc` — its OpenAPI document,
 * /v1/store/openapi.json, is the one served without a session. The full
 * /openapi.json is behind sign-in in production (duma-api `docsGuard`), so
 * the other APIs point at their docs here instead of at a 401.
 */
export function apiCatalog(): { linkset: LinksetEntry[] } {
  const status = [{ href: `${API_ORIGIN}/health`, type: 'application/json' }];
  const docs = (path: string, title: string) => [{ href: absoluteUrl(path), type: 'text/html', title }];

  return {
    linkset: [
      ...PUBLIC_APIS.map((api) => ({
        anchor: apiBase(API_ORIGIN, api),
        ...(api.id === 'store' && { 'service-desc': [{ href: `${API_ORIGIN}/v1/store/openapi.json`, type: 'application/vnd.oai.openapi+json' }] }),
        'service-doc': docs('/developers', `${api.name} — DUMA API docs`),
        status,
      })),
      { anchor: `${API_ORIGIN}${MCP_PATH}`, 'service-doc': docs('/developers/mcp', 'MCP server — DUMA API docs'), status },
    ],
  };
}
