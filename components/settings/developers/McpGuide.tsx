'use client';

import { mcpClientConfigs, mcpUrl } from '@/lib/developers/api-reference';

import { API_ORIGIN, C, CodeBlock, DocSection, Note } from './docs-blocks';
import { CopyRow } from './rows';

export const MCP_GUIDE_SECTIONS = [{ id: 'mcp', label: 'Connect over MCP' }] as const;

/**
 * Connect an AI coding assistant to this workspace with the same key a
 * website uses — or hand it a brief to read. The assistant is offered only
 * the tools the key's permissions allow, so the list isn't repeated here.
 */
export function McpGuide({ briefs }: { briefs?: React.ReactNode }) {
  return (
    <DocSection
      id="mcp"
      title="AI assistants"
      lead="Connect Claude Code, Cursor or Codex to this workspace. The assistant can do only what its key’s permissions allow."
    >
      <CopyRow label="MCP server" value={mcpUrl(API_ORIGIN)} />
      <CodeBlock tabs={mcpClientConfigs(API_ORIGIN)} />
      <Note>
        Put the key in <C>DUMA_API_KEY</C> in the assistant’s environment — never in a committed file. Ask it to call <C>workspace_info</C>{' '}
        first to check what the key can reach.
      </Note>
      {briefs && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Or paste a brief — endpoints, rules and your models, no keys — into any assistant’s chat.
          </p>
          <div className="flex flex-wrap gap-2">{briefs}</div>
        </div>
      )}
    </DocSection>
  );
}
