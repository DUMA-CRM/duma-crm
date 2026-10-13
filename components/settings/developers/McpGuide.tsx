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
      lead="Give Claude Code, Cursor or any MCP client direct access to this workspace: its models, entries, products and prices — and, if you let it, new models and draft entries. It uses the same workspace key, and offers only the tools that key’s scopes allow."
    >
      <div className="flex items-center gap-2 rounded-lg border border-rule/60 bg-control py-1.5 pl-3 pr-1.5">
        <span className="shrink-0 rounded-sm bg-momentum/12 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-momentum">MCP</span>
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{url}</code>
        <DocCopyButton text={url} label="MCP URL" />
      </div>
      <CodeBlock tabs={mcpClientConfigs(API_ORIGIN)} />
      <Note>
        A publishable key is enough to build with: it reads published content and the catalogue. Use a secret key with{' '}
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
        Every tool answers exactly as its REST endpoint would — the same scopes, content-type limits and rate limits, plus about 120 MCP
        calls a minute per key. A failed call comes back as an error result carrying the API’s status, code and message. Only two tools
        write, and only with opt-in scopes: <C>content_create_type</C> adds a model and <C>content_create_entry</C> saves a draft that an
        editor publishes. Nothing an assistant does through it records an order or puts content live.
      </Note>
    </DocSection>
  );
}
