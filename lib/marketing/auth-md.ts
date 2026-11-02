import { MCP_PATH, PUBLIC_APIS, apiBase } from '@/lib/developers/api-reference';
import { API_ORIGIN, RATE_LIMITS, docScopes } from '@/lib/marketing/developers';
import { absoluteUrl } from '@/lib/marketing/site';

/**
 * /auth.md — how an AI agent gets credentials for DUMA (the Auth.md
 * convention). DUMA has no OAuth authorization server and no self-service
 * agent registration: a person in the workspace creates a scoped key in
 * Settings → Developers and gives it to the agent. So this file is the
 * self-contained form of auth.md, and there is deliberately no
 * /.well-known/oauth-protected-resource — publishing one would advertise a
 * flow that does not exist. Built from the same registries as /developers,
 * so a new scope or API appears here without an edit.
 */
export function authMd(): string {
  const scopes = docScopes()
    .map((s) => `| \`${s.scope}\` | ${s.detail} | ${s.publishable ? 'publishable or secret' : 'secret only'} |`)
    .join('\n');
  const apis = PUBLIC_APIS.map((api) => `- **${api.name}** — \`${apiBase(API_ORIGIN, api)}\`: ${api.summary}`).join('\n');
  const limits = RATE_LIMITS.map((limit) => `- ${limit.api}: ${limit.perMinute} requests a minute per key`).join('\n');

  return `# DUMA auth.md

How an AI agent authenticates to DUMA — the business software for cafés, restaurants, bars and small shops.

## Audience

Agents acting for one DUMA workspace: coding assistants building a storefront or website on its catalogue and content, and assistants connected to the workspace over MCP.

## Registration

DUMA has no self-service agent registration and no OAuth flow. There is no endpoint an agent can call to create an account or a credential.

An agent gets a credential from a person in the workspace:

1. The person signs in at ${absoluteUrl('/sign-in')} (or creates a free workspace at ${absoluteUrl('/sign-up')}).
2. In **Settings → Developers** (${absoluteUrl('/settings/developers')}) they create an API key, choosing its kind and scopes.
3. They give the key to the agent — as an environment variable or the agent's MCP configuration, never in a prompt or a repository.

A key never gets more than the person who created it could do in DUMA themselves. It is shown once, when it is made; only a fingerprint is stored. Revoking it in Settings → Developers takes effect within 30 seconds.

## Credential types

- **Publishable key** \`dk_pub_…\` — safe in a browser or an app. It can hold only read scopes: products, categories and published content.
- **Secret key** \`dk_sec_…\` — for a server or an agent's own environment only. Orders, sign-ups, drafts and every management operation need one.

## Using the credential

Send the key on every request, either way:

\`\`\`
Authorization: Bearer dk_sec_…
X-Api-Key: dk_sec_…
\`\`\`

APIs:

${apis}
- **MCP server** — \`${API_ORIGIN}${MCP_PATH}\`: MCP Streamable HTTP, stateless. The tools offered depend on the key's scopes.

${limits}

A \`429 Too Many Requests\` means the limit was reached: wait before retrying.

## Scopes

| Scope | Lets a key | Key kind |
| --- | --- | --- |
${scopes}

## More

- API reference: ${absoluteUrl('/developers')}
- Connecting an AI assistant over MCP: ${absoluteUrl('/developers/mcp')}
- Site map for agents: ${absoluteUrl('/llms.txt')}
`;
}
