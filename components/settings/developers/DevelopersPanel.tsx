'use client';

import Link from 'next/link';

import { ActionRow, ActionRows, RowTile } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import { BookOpen, ChevronRight, Download, FileText, type IconComponent, Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';

import { PUBLIC_APIS, apiBase, isContentApi, mcpUrl } from '@/lib/developers/api-reference';
import { toast } from '@/lib/toast';
import { envTemplate } from '@/lib/utils/developers';

import { ApiKeysSection } from './ApiKeysSection';
import { WebhooksSection } from './WebhooksSection';
import { API_ORIGIN } from './docs-blocks';
import { CopyRow } from './rows';
import { useDeveloperAccess } from './useDeveloperAccess';

/**
 * Settings → Developers: the keys and webhooks a workspace's own website, app
 * or AI assistant uses. The rail holds what a developer copies into their
 * project — the addresses — and the way into the reference; everything longer
 * lives in the reference.
 */
export function DevelopersPanel() {
  const access = useDeveloperAccess();
  // Content is offered only where it can answer: the module on, and its models readable.
  const apis = PUBLIC_APIS.filter((api) => !isContentApi(api.id) || access.canReadContent);
  return (
    <SettingsTabBody
      narrowAside
      aside={
        <>
          <SettingsSection title="Connection details">
            <div className="space-y-3">
              {apis.map((api) => (
                <CopyRow key={api.id} label={api.name} value={apiBase(API_ORIGIN, api)} />
              ))}
              <CopyRow label="MCP server, for AI assistants" value={mcpUrl(API_ORIGIN)} />
            </div>
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              Send a key as <code className="font-mono text-foreground">Authorization: Bearer dk_…</code> on every request.
            </p>
            <div className="mt-3">
              <ActionRows>
                <ActionRow
                  icon={FileText}
                  label="Copy a .env template"
                  onClick={async () => {
                    if (await copyText(envTemplate(API_ORIGIN, apis))) toast('success', 'Copied — paste it into your project’s .env.');
                    else toast('error', 'Copy failed.');
                  }}
                />
              </ActionRows>
            </div>
          </SettingsSection>

          <SettingsSection title="Documentation">
            <div className="-mx-2 flex flex-col gap-0.5">
              <DocLink href="/settings/developers/docs" icon={BookOpen} title="API reference" subtitle="Endpoints, examples and errors" />
              <DocLink
                href="/settings/developers/docs#api-mcp"
                icon={Sparkles}
                title="Connect an AI assistant"
                subtitle="Claude Code, Cursor or Codex, over MCP"
              />
              <DocLink
                href="/settings/developers/openapi.json"
                download="duma.openapi.json"
                icon={Download}
                title="OpenAPI file"
                subtitle="For Postman or generating a client"
              />
            </div>
          </SettingsSection>
        </>
      }
    >
      <ApiKeysSection access={access} />
      {access.canManageContent && <WebhooksSection />}
    </SettingsTabBody>
  );
}

/** A row that goes somewhere: tile, title over a line saying what's there, and a chevron that nudges on hover. */
function DocLink({
  href,
  icon,
  title,
  subtitle,
  download,
}: {
  href: string;
  icon: IconComponent;
  title: string;
  subtitle: string;
  download?: string;
}) {
  const body = (
    <>
      <RowTile icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight
        size={14}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </>
  );
  const className =
    'group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring';
  // A file is a plain download; a page is client navigation.
  return download ? (
    <a href={href} download={download} className={className}>
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
