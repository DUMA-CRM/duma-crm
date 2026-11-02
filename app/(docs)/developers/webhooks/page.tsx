import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowRight, Lock, RefreshCw } from '@/components/icons';
import { CodeBlock } from '@/components/marketing/CodeBlock';
import { JsonLd } from '@/components/marketing/JsonLd';
import { DocsHero, DocsPage, FieldList, H2, InlineCode, SetupStep, Ticks, prose } from '@/components/marketing/docs/parts';
import { Faq, FeatureCard, SecondaryButton } from '@/components/marketing/sections';
import { buttonVariants } from '@/components/ui/button';

import type { DocField } from '@/lib/marketing/developers';
import { marketingMetadata } from '@/lib/marketing/metadata';
import { breadcrumbSchema } from '@/lib/marketing/schema';

export const metadata: Metadata = marketingMetadata({
  title: 'Webhooks — DUMA API',
  description:
    'Get a signed request when content is published, unpublished or deleted, or media changes. Events, payloads, headers, signature verification and retries.',
  path: '/developers/webhooks',
});

/*
 * Everything here is duma-api's contract — lib/cms-webhook-signing.ts (events,
 * signing, URL rules), lib/cms-publishing.ts (payload, headers, attempts) and
 * lib/provider-http.ts (which failures are retried). Check there before
 * changing a word.
 */

const TOC = [
  { href: '#setup', label: 'Set up' },
  { href: '#events', label: 'Events' },
  { href: '#payload', label: 'Payload' },
  { href: '#headers', label: 'Headers', indent: true },
  { href: '#verify', label: 'Verify signatures' },
  { href: '#retries', label: 'Retries' },
  { href: '#troubleshooting', label: 'Troubleshooting' },
];

const EVENTS = [
  { name: 'entry.published', when: 'An entry goes live — from the editor, or when its scheduled time comes.' },
  { name: 'entry.unpublished', when: 'A live entry is taken down, by hand or on its schedule.' },
  { name: 'entry.deleted', when: 'A published entry, or a content type that held published entries, is deleted.' },
  { name: 'asset.changed', when: 'A media file is added, replaced, edited or deleted.' },
  { name: 'ping', when: 'Only from “Send a test”. Never sent on its own.' },
];

const PAYLOADS = [
  {
    id: 'entry',
    label: 'entry.published',
    code: JSON.stringify(
      {
        id: '0f6b2c9e-4d1a-4b7e-9a51-2f3c8d7e6a10',
        event: 'entry.published',
        createdAt: '2026-10-30T09:41:00.000Z',
        data: {
          entry: {
            id: 'b7d1e0a2-5c3f-4e8a-91d4-6a2f0c9e8b17',
            entryId: '4c2a9f1e-7b6d-4e3a-8f05-1d9c2b7a6e43',
            type: 'blog-post',
            locale: 'en',
            slug: 'spring-menu',
            version: 4,
          },
          source: 'editor',
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'asset',
    label: 'asset.changed',
    code: JSON.stringify(
      {
        id: '8e3d5a1c-2f7b-4c9e-b6a0-5d1e4f2c8a93',
        event: 'asset.changed',
        createdAt: '2026-10-30T09:42:10.000Z',
        data: { asset: { id: '5e9a1c7b-2d4f-4b8e-a6c3-1f0d9e8b7a62' }, change: 'updated' },
      },
      null,
      2,
    ),
  },
  {
    id: 'ping',
    label: 'ping',
    code: JSON.stringify(
      {
        id: '2a7c9e1d-6b3f-4d8a-9e52-0c1f7b4d3e86',
        event: 'ping',
        createdAt: '2026-10-30T09:40:00.000Z',
        data: { webhook: { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', name: 'Rebuild website' } },
      },
      null,
      2,
    ),
  },
];

const PAYLOAD_FIELDS: DocField[] = [
  { name: 'id', type: 'string', required: false, description: 'The event. The same on every retry and redelivery — use it to ignore duplicates.' },
  { name: 'event', type: 'string', required: false, description: 'One of the events above.' },
  { name: 'createdAt', type: 'string', required: false, description: 'When the change happened, ISO 8601 in UTC — not when this request was sent.' },
  {
    name: 'data.entry',
    type: 'object',
    required: false,
    description:
      'Entry events. `id` is the document id the Content API returns; `entryId` is this language’s copy. `type` is the content type key, so you can rebuild only what changed.',
  },
  {
    name: 'data.source',
    type: 'string',
    required: false,
    description: '`editor` or `schedule`, on `entry.published` and `entry.unpublished`.',
    values: ['editor', 'schedule'],
  },
  {
    name: 'data.asset',
    type: 'object',
    required: false,
    description: '`asset.changed` only: the asset’s `id`, with `data.change` saying what happened.',
    values: ['created', 'updated', 'deleted'],
  },
];

const HEADERS: DocField[] = [
  { name: 'X-Duma-Signature', type: 'string', required: false, description: '`v1=` and the hex HMAC-SHA256 of `{timestamp}.{body}`, keyed with your signing secret.' },
  { name: 'X-Duma-Timestamp', type: 'string', required: false, description: 'Unix seconds when this attempt was signed. Signed with the body, so it can’t be swapped.' },
  { name: 'X-Duma-Event', type: 'string', required: false, description: 'The event name, so you can route before parsing the body.' },
  { name: 'X-Duma-Delivery', type: 'string', required: false, description: 'This webhook’s delivery of the event. The same across its retries; shown in the delivery history.' },
  { name: 'Content-Type', type: 'string', required: false, description: '`application/json`.' },
  { name: 'User-Agent', type: 'string', required: false, description: '`DUMA-CMS-Webhooks/1`.' },
];

const VERIFY = [
  {
    id: 'node',
    label: 'Node.js',
    code: `import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyDumaWebhook(secret, timestamp, body, signature) {
  if (!timestamp || !signature) return false;
  // Older than five minutes: a replayed request.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = Buffer.from(
    'v1=' + createHmac('sha256', secret).update(\`\${timestamp}.\${body}\`).digest('hex'),
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}`,
  },
  {
    id: 'next',
    label: 'Next.js route',
    code: `// app/api/duma-webhook/route.ts
export async function POST(request: Request) {
  // The raw body: parse only after the signature checks out.
  const body = await request.text();
  const ok = verifyDumaWebhook(
    process.env.DUMA_WEBHOOK_SECRET!,
    request.headers.get('x-duma-timestamp'),
    body,
    request.headers.get('x-duma-signature'),
  );
  if (!ok) return new Response('Invalid signature', { status: 401 });

  const event = JSON.parse(body);
  if (event.event === 'entry.published') {
    // Rebuild, or revalidate the page for event.data.entry.slug.
  }
  return Response.json({ received: true });
}`,
  },
  {
    id: 'python',
    label: 'Python',
    code: `import hashlib, hmac, time

def verify_duma_webhook(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    if not timestamp or not signature:
        return False
    # Older than five minutes: a replayed request.
    if abs(time.time() - int(timestamp)) > 300:
        return False
    digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"v1={digest}", signature)`,
  },
];

const OUTCOMES = [
  { reply: '2xx within 10 seconds', result: 'Delivered. The body of your reply is ignored.', tone: 'text-success' },
  { reply: '429, 5xx, a timeout or no connection', result: 'Retried, waiting longer each time — 8 attempts in all, then marked failed.', tone: 'text-stock' },
  { reply: 'Any other 4xx', result: 'Failed at once, not retried. A 401 for a bad signature is final.', tone: 'text-destructive' },
  { reply: 'A redirect', result: 'Not followed — it counts as no connection. Point the webhook at the final URL.', tone: 'text-stock' },
];

/** /developers/webhooks — the MCP guide's shape: hero, steps, then the contract. */
export default function WebhooksPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Public API', path: '/developers' },
          { name: 'Webhooks', path: '/developers/webhooks' },
        ])}
      />
      <DocsPage toc={TOC}>
        <DocsHero
          lead="Know the moment"
          mark="content changes."
          facts={['4 events', 'Signed with HMAC-SHA256', 'Retried up to 8 times']}
          actions={
            <>
              <Link href="/settings/developers" className={buttonVariants({ size: 'touch' })}>
                Add a webhook <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <SecondaryButton href="#verify">Verify a signature</SecondaryButton>
            </>
          }
        >
          DUMA sends a signed POST to your URL when an entry is published, unpublished or deleted, or when media changes — so your site
          rebuilds or clears its cache without a redeploy.
        </DocsHero>

        <section className="pt-12" aria-labelledby="setup">
          <H2 id="setup">Set up in three steps</H2>
          <ol className="mt-6">
            <SetupStep number={1} title="Add a webhook">
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
                In <strong className="text-foreground">Settings → Developers → Webhooks</strong>, choose New webhook. Give it a name, your HTTPS
                URL and the events to send. You can limit it to some content types — a blog rebuild only needs blog posts.
              </p>
              <Link
                href="/settings/developers"
                className="mt-3 inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-primary hover:underline"
              >
                Open Settings → Developers <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </SetupStep>
            <SetupStep number={2} title="Keep the signing secret">
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
                The secret starts <InlineCode>whsec_</InlineCode> and is shown once. Store it as an environment variable on your server. “New
                signing secret” replaces it, and the old one stops working straight away.
              </p>
            </SetupStep>
            <SetupStep number={3} title="Send a test">
              <p className="mt-1.5 text-pretty leading-relaxed text-[var(--mkt-ink-2)]">
                “Send a test” delivers a signed <InlineCode>ping</InlineCode> event now and shows what your endpoint answered. Reply with any
                2xx.
              </p>
            </SetupStep>
          </ol>
        </section>

        <section className="pt-12" aria-labelledby="events">
          <H2 id="events">Events</H2>
          <p className={`${prose} mt-3`}>A webhook receives only the events you picked. Changes to drafts send nothing.</p>
          <ul className="mkt-card mt-5 divide-y divide-[var(--mkt-line)]">
            {EVENTS.map((event) => (
              <li key={event.name} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                <code className="font-mono text-[0.875rem] font-semibold text-foreground">{event.name}</code>
                <span className="text-sm leading-relaxed text-[var(--mkt-ink-2)]">{event.when}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-12" aria-labelledby="payload">
          <H2 id="payload">Payload</H2>
          <p className={`${prose} mt-3`}>
            Every request is a JSON object with the same four fields. It says what changed, not the new content — fetch that from the Content
            API.
          </p>
          <CodeBlock className="mt-4" label="Request body" tabs={PAYLOADS} />
          <FieldList fields={PAYLOAD_FIELDS} />

          <h3 id="headers" className="mt-10 scroll-mt-20 text-[1.0625rem] font-semibold text-[var(--mkt-heading)]">
            Headers
          </h3>
          <FieldList fields={HEADERS} />
        </section>

        <section className="pt-12" aria-labelledby="verify">
          <H2 id="verify">Verify signatures</H2>
          <p className={`${prose} mt-3`}>
            Anyone can POST to your URL, so check every request before acting on it. Sign <InlineCode>{'{timestamp}.{body}'}</InlineCode> with
            your secret and compare it with <InlineCode>X-Duma-Signature</InlineCode>:
          </p>
          <ul className={`${prose} mt-3 flex list-disc flex-col gap-1.5 pl-5`}>
            <li>
              <Ticks text="Use the raw body, exactly as received. Parsing and re-serialising the JSON changes the bytes and the signature." />
            </li>
            <li>Refuse timestamps more than five minutes from your clock, so an old request can’t be replayed.</li>
            <li>Compare in constant time.</li>
          </ul>
          <CodeBlock className="mt-5" label="Verify a webhook" tabs={VERIFY} />
        </section>

        <section className="pt-12" aria-labelledby="retries">
          <H2 id="retries">Retries</H2>
          <p className={`${prose} mt-3`}>
            Each webhook tracks its own deliveries, so when one endpoint is down only that one is retried. What happens depends on your reply:
          </p>
          <ul className="mkt-card mt-5 divide-y divide-[var(--mkt-line)]">
            {OUTCOMES.map((outcome) => (
              <li key={outcome.reply} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-4">
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--mkt-heading)]">
                  <span className={`size-1.5 shrink-0 rounded-full bg-current ${outcome.tone}`} aria-hidden="true" />
                  {outcome.reply}
                </span>
                <span className="text-sm leading-relaxed text-[var(--mkt-ink-2)]">{outcome.result}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FeatureCard
              icon={RefreshCw}
              tag="Deliveries"
              title="Send any event again"
              body="A webhook’s Deliveries list shows each attempt with the status your endpoint returned. Redeliver sends one again now, with the same id."
            />
            <FeatureCard
              icon={Lock}
              tone="team"
              tag="URL rules"
              title="Public HTTPS only"
              body="The URL must use HTTPS, carry no username or password, and resolve to a public internet address. It is checked when you save and before every send."
            />
          </div>
        </section>

        <section className="pt-12 pb-10" aria-labelledby="troubleshooting">
          <H2 id="troubleshooting">Troubleshooting</H2>
          <div className="mt-4">
            <Faq
              items={[
                [
                  'The signature never matches',
                  'Check that you sign the raw request body, not a parsed and re-serialised copy, and that the secret is the current one — a new signing secret replaces the old immediately. Then check your server’s clock: a timestamp more than five minutes off is refused.',
                ],
                [
                  'The same event arrives twice',
                  'Retries and redeliveries resend the same event. Store the payload id, or X-Duma-Delivery, and skip ones you have already handled.',
                ],
                [
                  'The test works but real events never arrive',
                  'Check the webhook is switched on, subscribed to the event and not limited to other content types. Saving a draft sends nothing; publishing does.',
                ],
                [
                  'The URL is refused when I save it',
                  'It must be HTTPS and resolve to a public address — localhost, private networks and URLs with credentials are refused. To test locally, use a tunnel that gives you a public HTTPS URL.',
                ],
              ].map(([question, answer]) => ({ question, answer }))}
            />
          </div>
        </section>
      </DocsPage>
    </>
  );
}
