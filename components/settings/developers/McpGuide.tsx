'use client';

import { MCP_TOOLS, SCOPES, mcpClientConfigs, mcpUrl } from '@/lib/developers/api-reference';

import { API_ORIGIN, C, CodeBlock, DocCopyButton, DocSection, DocTable, Note } from './docs-blocks';

export const MCP_GUIDE_SECTIONS = [{ id: 'mcp', label: 'MCP server' }] as const;

/** Connect an AI coding assistant to this workspace with the same key a website uses. */
export function McpGuide() {
  const url = mcpUrl(API_ORIGIN);
  return (
    <DocSection
      id="mcp"
      title="MCP server"
      lead="Connect Claude Code, Codex or another MCP client to read and manage this workspace. Secret keys can opt into CMS authoring and publishing, media, Notes, catalogue and workspace setup. Each tool requires its own scope."
    >
      <div className="flex items-center gap-2 rounded-lg border border-rule/60 bg-control py-1.5 pl-3 pr-1.5">
        <span className="shrink-0 rounded-sm bg-momentum/12 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-momentum">MCP</span>
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{url}</code>
        <DocCopyButton text={url} label="MCP URL" />
      </div>
      <CodeBlock tabs={mcpClientConfigs(API_ORIGIN)} />
      <Note>
        Set DUMA_API_KEY in the client environment. A publishable key reads published content and the catalogue. Use a secret key with{' '}
        <C>content:preview</C> to let the assistant read drafts too, or <C>orders:write</C> (with a location to sell from) to price baskets.
        Keep the key in your environment, not in a committed config file.
      </Note>
      <DocTable
        head={['Tool', 'Does', 'Needs']}
        rows={MCP_TOOLS.map((tool) => [
          <C key={tool.name}>{tool.name}</C>,
          tool.writes ? `${tool.summary} · writes` : tool.summary,
          tool.scope ? (
            <span key="s">
              <C>{tool.scope}</C>
              {!SCOPES[tool.scope].publishable && ' · secret key'}
            </span>
          ) : (
            'Any key'
          ),
        ])}
      />
      <Note>
        Management scopes are opt-in and checked against the key creator’s current access on every call. Use a separate key without a location restriction for workspace setup. CMS PATCH needs the version you read; DELETE has a separate scope and keeps reference protection. Notes keep their owner and folder permissions.
      </Note>
      <Note>
        Call <C>workspace_info</C> first. Use <C>idempotencyKey</C> on management writes you may retry; the server must have Redis configured. Small files can be uploaded through MCP; larger files use the multipart upload URL from workspace_info (up to 25 MB). Publishing is an explicit operation requiring <C>content:publish</C>.
      </Note>
    </DocSection>
  );
}
