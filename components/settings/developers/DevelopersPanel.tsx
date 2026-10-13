'use client';

import Link from 'next/link';

import { BookOpen, Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Button } from '@/components/ui/button';

import { PUBLIC_APIS, apiBase, mcpUrl } from '@/lib/developers/api-reference';

import { ApiKeysSection } from './ApiKeysSection';
import { DevelopersNav } from './DevelopersNav';
import { WebhooksSection } from './WebhooksSection';
import { API_ORIGIN, DocCopyButton } from './docs-blocks';
import { useDeveloperAccess } from './useDeveloperAccess';

/**
 * Settings → Developers: every key and webhook a workspace's own website or
 * app uses, in one place. How to use them is the API reference beside it.
 */
export function DevelopersPanel() {
  const access = useDeveloperAccess();
  return (
    <SettingsTabBody
      aside={
        <>
          <DevelopersNav className="hidden lg:flex" />
          <BuildSection contentOn={access.canReadContent} />
          <McpSection />
        </>
      }
      narrowAside
      asideLeft
    >
      {/* The sidebar stacks below on narrow screens; the switch stays on top. */}
      <DevelopersNav className="lg:hidden" />
      <ApiKeysSection access={access} />
      {access.canManageContent && <WebhooksSection />}
    </SettingsTabBody>
  );
}

/** The aside: where each API lives, and the way into the reference. */
function BuildSection({ contentOn }: { contentOn: boolean }) {
  return (
    <SettingsSection
      title="Build with the API"
      description="Endpoints, examples, your content models as TypeScript, and briefs for an AI coding assistant — in the API reference."
    >
      <ul className="space-y-2">
        {PUBLIC_APIS.filter((api) => api.id !== 'content' || contentOn).map((api) => {
          const base = apiBase(API_ORIGIN, api);
          return (
            <li key={api.id}>
              <p className="mb-1 text-xs font-semibold text-foreground">{api.name}</p>
              <div className="flex items-center gap-2 rounded-md border border-rule/50 bg-background/60 py-1 pl-3 pr-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{base}</code>
                <DocCopyButton text={base} label={`${api.name} base URL`} />
              </div>
            </li>
          );
        })}
      </ul>
      <Button asChild variant="outline" className="mt-3 w-full gap-1.5">
        <Link href="/settings/developers/docs">
          <BookOpen aria-hidden="true" /> Open the API reference
        </Link>
      </Button>
    </SettingsSection>
  );
}

/** The MCP server: the same keys, for an AI coding assistant. */
function McpSection() {
  const url = mcpUrl(API_ORIGIN);
  return (
    <SettingsSection
      title="Use with AI"
      description="Connect Claude Code, Cursor or any MCP client with one of these keys. It can read your content and catalogue while it builds — never record orders."
    >
      <div className="flex items-center gap-2 rounded-md border border-rule/50 bg-background/60 py-1 pl-3 pr-1">
        <Sparkles size={13} className="shrink-0 text-primary" aria-hidden="true" />
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{url}</code>
        <DocCopyButton text={url} label="MCP URL" />
      </div>
      <Button asChild variant="outline" className="mt-3 w-full">
        <Link href="/settings/developers/docs#api-mcp">How to connect</Link>
      </Button>
    </SettingsSection>
  );
}
