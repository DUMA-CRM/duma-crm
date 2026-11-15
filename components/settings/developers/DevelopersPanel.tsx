'use client';

import { RowTile } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import { BookOpen, ChevronRight, Download, ExternalLink, FileText, type IconComponent, Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow } from '@/components/settings/controls';
import { Button } from '@/components/ui/button';

import { PUBLIC_APIS, apiBase, isContentApi, mcpUrl } from '@/lib/developers/api-reference';
import { toast } from '@/lib/toast';
import { envTemplate } from '@/lib/utils/developers';

import { ApiKeysSection } from './ApiKeysSection';
import { API_ICON } from './NewApiKeyDialog';
import { WebhooksSection } from './WebhooksSection';
import { API_ORIGIN, DocCopyButton } from './docs-blocks';
import { useDeveloperAccess } from './useDeveloperAccess';

/**
 * Settings → Developers, in the Settings → Account layout: the keys and
 * webhooks a workspace's own website, app or AI assistant uses, each list a
 * `RecordGroup`. The rail holds what a developer copies into their project —
 * the addresses, as read-only `ChangeRow`s with a copy button — and the way
 * into the public docs; everything longer lives there.
 */
export function DevelopersPanel() {
  const access = useDeveloperAccess();
  // Content is offered only where it can answer: the module on, and its models readable.
  const apis = PUBLIC_APIS.filter((api) => !isContentApi(api.id) || access.canReadContent);
  return (
    // No rail — it holds only a live preview, and this page has none. Two stacked columns:
    // what you manage (keys, webhooks) | what you copy or open (addresses, docs).
    <SettingsTabBody>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <ApiKeysSection access={access} />
          {access.canManageContent && <WebhooksSection />}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection
            title="Connection details"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (await copyText(envTemplate(API_ORIGIN, apis))) toast('success', 'Copied — paste it into your project’s .env.');
                  else toast('error', 'Copy failed.');
                }}
              >
                <FileText aria-hidden="true" /> Copy .env
              </Button>
            }
            footnote={
              <>
                Send a key as <code className="font-mono text-foreground">Authorization: Bearer dk_…</code> on every request.
              </>
            }
          >
            <div>
              {apis.map((api) => (
                <AddressRow key={api.id} icon={API_ICON[api.id]} label={api.name} value={apiBase(API_ORIGIN, api)} />
              ))}
              <AddressRow icon={Sparkles} label="MCP server" value={mcpUrl(API_ORIGIN)} />
            </div>
          </SettingsSection>

          <SettingsSection title="Documentation">
            <div className="-mx-2 flex flex-col gap-0.5">
              <DocLink href="/developers" icon={BookOpen} title="API reference" subtitle="Endpoints, examples and errors" />
              <DocLink
                href="/developers/mcp"
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
        </div>
      </div>
    </SettingsTabBody>
  );
}

/** An address someone pastes into their project: a read-only row, the copy button its one action. */
function AddressRow({ icon, label, value }: { icon: IconComponent; label: string; value: string }) {
  return (
    <ChangeRow
      icon={icon}
      label={label}
      value={<code className="truncate font-mono text-xs font-medium">{value}</code>}
      trailing={<DocCopyButton text={value} label={label} />}
    />
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
      {download ? (
        <ChevronRight
          size={14}
          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      ) : (
        <ExternalLink size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </>
  );
  const className =
    'group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring';
  // A file is a plain download; a page is the public developer docs, opened in a new tab.
  return download ? (
    <a href={href} download={download} className={className}>
      {body}
    </a>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
