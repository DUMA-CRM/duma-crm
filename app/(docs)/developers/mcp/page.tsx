import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck } from '@/components/icons';
import { CodeBlock } from '@/components/marketing/CodeBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { McpSetup } from '@/components/marketing/docs/McpSetup';
import { McpTools } from '@/components/marketing/docs/McpTools';
import { DocsHero, DocsPage, H2, InlineCode, SetupStep, prose } from '@/components/marketing/docs/parts';
import { Faq, FeatureCard, SecondaryButton } from '@/components/marketing/sections';
import { buttonVariants } from '@/components/ui/button';

import { API_ORIGIN, MCP_TOOL_COUNT, RATE_LIMITS, mcpToolGroups } from '@/lib/marketing/developers';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema } from '@/lib/marketing/schema';

export const metadata: Metadata = marketingMetadata({
  title: 'MCP Server — DUMA API',
  description:
    'Connect an AI assistant to DUMA. Set up Claude Code, Cursor or another MCP client, choose workspace permissions, and explore the available tools.',
  path: '/developers/mcp',
});

const MCP_URL = `${API_ORIGIN}/v1/mcp`;
const MCP_LIMIT = RATE_LIMITS.find((limit) => limit.api === 'MCP server')!.perMinute;

const TOC = [
  { href: '#connect', label: 'Connect' },
  { href: '#permissions', label: 'Permissions' },
  { href: '#tools', label: 'Tools' },
  { href: '#troubleshooting', label: 'Connection help' },
];

/** Prompts to paste once connected; the first works with any key, the rest name their scopes. */
const PROMPTS = [
  {
    id: 'check',
    label: 'Check',
    scopes: [],
    code: 'Use DUMA’s workspace_info tool and summarize which APIs and permissions this connection has. Don’t change any data.',
  },
  {
    id: 'products',
    label: 'Products',
    scopes: ['catalog:read'],
    code: 'List the products currently for sale in DUMA, with their prices and availability. Don’t make any changes.',
  },
  {
    id: 'content',
    label: 'Content',
    scopes: ['content:read'],
    code: 'List my DUMA content types and explain the fields available for each one.',
  },
  {
    id: 'draft',
    label: 'Draft',
    scopes: ['content:read', 'content:write'],
    code: 'Help me draft a new entry in DUMA. First list the content types, ask me which to use and what to write, then inspect its fields. Save the entry as a draft for review.',
  },
];

/** /developers/mcp — a marketing-style hero over a docs-style guide. */
export default function McpPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Public API', path: '/developers' },
          { name: 'MCP', path: '/developers/mcp' },
        ])}
      />
      <DocsPage toc={TOC}>
        <DocsHero
          lead="Your workspace,"
          mark="connected to AI."
          facts={[`${MCP_TOOL_COUNT} tools`, 'Streamable HTTP', 'Workspace API keys']}
          actions={
            <>
              <Link href="/settings/developers" className={buttonVariants({ size: 'touch' })}>
                Create a workspace key <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <SecondaryButton href="#tools">Browse {MCP_TOOL_COUNT} tools</SecondaryButton>
            </>
          }
        >
          The DUMA MCP server lets your assistant work with products, content, media and notes. Connect your client once, then ask for what
          you need in plain language.
        </DocsHero>

        <section className="pt-12" aria-labelledby="connect">
          <H2 id="connect">Connect in three steps</H2>
          <ol className="mt-6">
            <SetupStep number={1} title="Create a workspace key">
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
                Start with a publishable key and <InlineCode>catalog:read</InlineCode> or <InlineCode>content:read</InlineCode> to explore
                your data. For drafting or management, use a secret key with the specific scopes you need.
              </p>
              <Link
                href="/settings/developers"
                className="mt-3 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-primary hover:underline"
              >
                Open Settings → Developers <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </SetupStep>
            <SetupStep number={2} title="Add DUMA to your client">
              <McpSetup url={MCP_URL} />
            </SetupStep>
            <SetupStep number={3} title="Check the connection">
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
                Ask your assistant to call <InlineCode>workspace_info</InlineCode>. It returns the key’s scopes, restrictions and available
                APIs.
              </p>
              <CodeBlock
                className="mt-4"
                prose
                label="Prompt"
                tabs={PROMPTS.map((prompt) => ({
                  ...prompt,
                  footer: (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <KeyRound className="size-3.5 text-primary" aria-hidden="true" />
                      {prompt.scopes.length ? (
                        <>
                          Needs
                          {prompt.scopes.map((scope) => (
                            <InlineCode key={scope}>{scope}</InlineCode>
                          ))}
                        </>
                      ) : (
                        'Works with any valid workspace key'
                      )}
                    </span>
                  ),
                }))}
              />
            </SetupStep>
          </ol>
        </section>

        <section className="pt-12" aria-labelledby="permissions">
          <H2 id="permissions">You choose what the assistant can do</H2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={ShieldCheck}
              tag="Scopes"
              title="Access follows your key"
              body="Tool discovery is filtered by scope. Calls also check enabled modules, resource restrictions and, for management tools, the key creator’s current permissions. Notes follow that person’s folder access."
              link={{ href: '/developers#scopes', label: 'View all API key scopes' }}
            />
            <FeatureCard
              icon={CheckCircle2}
              tone="team"
              tag="Audit log"
              title="Draft, publish and delete are separate"
              body={
                <>
                  Creating a content entry saves a draft. Publishing needs <InlineCode>content:publish</InlineCode>; deleting content needs{' '}
                  <InlineCode>content:delete</InlineCode>. Management changes are recorded in the workspace audit log.
                </>
              }
            />
          </div>
        </section>

        <section className="pt-12" aria-labelledby="tools">
          <H2 id="tools">Find a tool</H2>
          <p className={`${prose} mt-3`}>
            Filter by name, scope and action. Your assistant only receives the tools allowed by its key; linked tools open their API
            reference.
          </p>
          <McpTools groups={mcpToolGroups()} />
        </section>

        <section className="pt-12 pb-10" aria-labelledby="troubleshooting">
          <H2 id="troubleshooting">Connection help</H2>
          <div className="mt-4">
            <Faq
              items={[
                [
                  'The server rejects my key',
                  'Replace the placeholder with a valid workspace key and check that it has not expired or been revoked. Send it in the Authorization: Bearer header, or X-Api-Key. Legacy dcms_ content keys are not accepted.',
                ],
                [
                  'A tool is missing or access is denied',
                  'Check the key’s scopes first, then refresh the client’s tool list. A listed tool may still be denied by module settings, content-type restrictions or the key creator’s current access. Workspace-wide management also requires an unrestricted workspace key and owner access.',
                ],
                [
                  'Opening the server URL gives 405',
                  'This is expected for a browser GET request. Connect through an MCP client using Streamable HTTP. DUMA accepts JSON-RPC over POST; GET and DELETE return 405 because the server is stateless.',
                ],
                [
                  'A request is rate-limited',
                  `The MCP endpoint allows ${MCP_LIMIT} requests per minute per key. A 429 response means the limit was reached. Wait before retrying and reduce request frequency; the underlying APIs also enforce their limits.`,
                ],
                [
                  'How do media uploads work?',
                  'The remote server cannot read a file path on your computer. Import a public HTTPS image URL or send a small file as base64. MCP requests are capped at 1 MB; use the authenticated multipart upload URLs returned by workspace_info for larger files, up to 25 MB.',
                ],
              ].map(([question, answer]) => ({ question, answer }))}
            />
          </div>
        </section>
      </DocsPage>
    </>
  );
}
