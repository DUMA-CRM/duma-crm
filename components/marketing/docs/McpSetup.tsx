'use client';

import { useState } from 'react';

import { CodeBlock } from '@/components/marketing/CodeBlock';
import { Segmented } from '@/components/marketing/docs/Segmented';

export function McpSetup({ url }: { url: string }) {
  const [client, setClient] = useState('claude');
  const clients = [
    { id: 'claude', name: 'Claude Code' },
    { id: 'cursor', name: 'Cursor' },
    { id: 'other', name: 'Other clients' },
  ];
  return (
    <div className="mt-4">
      <Segmented
        label="Choose your MCP client"
        options={clients.map((item) => ({ id: item.id, label: item.name }))}
        value={client}
        onChange={setClient}
      />
      <div className="space-y-4 pt-4">
        {client === 'claude' ? (
          <>
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Run this in your project’s terminal. Replace YOUR_API_KEY with your workspace key.
            </p>
            <CodeBlock
              label="Terminal"
              code={`claude mcp add --transport http duma ${url} \\\n  --header "Authorization: Bearer YOUR_API_KEY"`}
            />
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Open Claude Code and run <code className="font-mono text-foreground">/mcp</code> to check the connection.
            </p>
            <a href="https://code.claude.com/docs/en/mcp" className="inline-block text-xs text-primary hover:underline">
              Claude Code connection guide ↗
            </a>
          </>
        ) : client === 'cursor' ? (
          <>
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Add this server to your personal <code className="font-mono text-foreground">~/.cursor/mcp.json</code>. Merge it into your
              existing mcpServers object if you already have servers configured.
            </p>
            <CodeBlock
              label="mcp.json"
              code={JSON.stringify({ mcpServers: { duma: { url, headers: { Authorization: 'Bearer YOUR_API_KEY' } } } }, null, 2)}
            />
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Replace YOUR_API_KEY, save the file, then check that DUMA is enabled in Cursor’s MCP settings.
            </p>
            <a href="https://cursor.com/docs/mcp" className="inline-block text-xs text-primary hover:underline">
              Cursor connection guide ↗
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Use a client that supports remote Streamable HTTP servers and custom authentication headers. Configuration formats vary by
              client.
            </p>
            <CodeBlock label="Server URL" code={url} />
            <CodeBlock label="Authentication header" code="Authorization: Bearer YOUR_API_KEY" />
            <p className="text-sm text-[var(--mkt-ink-2)]">
              Choose HTTP as the transport, add the header, then connect and refresh the tool list.
            </p>
          </>
        )}
        <p className="border-t border-[var(--mkt-line)] pt-4 text-xs leading-relaxed text-[var(--mkt-ink-2)]">
          Keep secret keys in your local client configuration. Do not commit them to a repository or paste them into an assistant
          conversation.
        </p>
      </div>
    </div>
  );
}
