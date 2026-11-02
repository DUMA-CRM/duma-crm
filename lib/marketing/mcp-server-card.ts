import { MCP_PATH } from '@/lib/developers/api-reference';
import { API_ORIGIN } from '@/lib/marketing/developers';
import { absoluteUrl } from '@/lib/marketing/site';

/**
 * duma-api `routes/mcp.ts` constructs its server with exactly these — change
 * them together. Tools only: no resources, no prompts.
 */
const SERVER = { name: 'duma', title: 'DUMA', version: '1.0.0' } as const;
/** The MCP SDK duma-api runs (`SUPPORTED_PROTOCOL_VERSIONS`, @modelcontextprotocol/sdk). */
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const DESCRIPTION =
  'Connect an AI assistant to a DUMA workspace: read the catalogue and published content, write CMS drafts and Notes, manage media and configure the workspace. The tools listed depend on the workspace API key’s scopes.';

/**
 * /.well-known/mcp/server-card.json — the MCP Server Card (SEP-1649/2127).
 * Carries both shapes in use: the accepted SEP's identity fields and
 * `remotes` (the MCP registry's server.json form), and the `serverInfo`,
 * `transport` and `capabilities` that discovery scanners still read. Tools are
 * left out on purpose — they vary by key, and an agent lists them with
 * `tools/list` once connected.
 */
export function mcpServerCard() {
  const endpoint = `${API_ORIGIN}${MCP_PATH}`;
  return {
    name: SERVER.name,
    title: SERVER.title,
    version: SERVER.version,
    description: DESCRIPTION,
    websiteUrl: absoluteUrl('/developers/mcp'),
    icons: [{ src: absoluteUrl('/icon.svg'), mimeType: 'image/svg+xml' }],
    remotes: [
      {
        type: 'streamable-http',
        url: endpoint,
        supportedProtocolVersions: PROTOCOL_VERSIONS,
        headers: [
          {
            name: 'Authorization',
            description: `Bearer and a DUMA workspace API key (dk_…), created in Settings → Developers. How to get one: ${absoluteUrl('/auth.md')}`,
            isRequired: true,
            isSecret: true,
          },
        ],
      },
    ],
    serverInfo: SERVER,
    protocolVersion: PROTOCOL_VERSIONS[0],
    transport: { type: 'streamable-http', endpoint },
    capabilities: { tools: {} },
    authentication: { required: true, schemes: ['bearer'], documentation: absoluteUrl('/auth.md') },
    documentationUrl: absoluteUrl('/developers/mcp'),
  };
}
