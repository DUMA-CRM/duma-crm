import Link from 'next/link';

import { CodeBlock } from '@/components/marketing/CodeBlock';
import { DocsHero, DocsPage, H2, InlineCode, prose } from '@/components/marketing/docs/parts';
import { buttonVariants } from '@/components/ui/button';
import { API_ORIGIN } from '@/lib/marketing/developers';
import { marketingMetadata } from '@/lib/marketing/metadata';

export const metadata = marketingMetadata({
  title: 'Build an App for DUMA',
  description: 'Submit and test a workspace widget, editor, page, or integration, and learn how DUMA app installations authenticate.',
  path: '/developers/apps',
});

const toc = [
  { href: '#submit', label: 'Submit and test a release' },
  { href: '#workspace-page', label: 'Workspace pages' },
  { href: '#extensions', label: 'Widgets and tools' },
  { href: '#content', label: 'Published Content API' },
  { href: '#events', label: 'Signed events' },
];

export default function DeveloperAppsPage() {
  return (
    <DocsPage toc={toc}>
      <DocsHero
        id="overview"
        lead="Build an app for"
        mark="DUMA."
        facts={['Widgets and tools', 'Workspace pages', 'Signed events']}
        actions={<Link href="/app-publisher" className={buttonVariants({ size: 'touch' })}>Open publisher dashboard</Link>}
      >
        Add custom widgets, embed an editor next to DUMA data, or connect your own backend. Each workspace grants access when it installs the app.
      </DocsHero>

      <section className="space-y-3 pt-10" aria-labelledby="submit">
        <H2 id="submit">Submit and test a release</H2>
        <ol className={`${prose} list-decimal space-y-2 pl-5`}>
          <li>Ask DUMA for publisher access using the verified email on your DUMA account.</li>
          <li>Host your app over HTTPS. In the publisher dashboard, add your listing, placements, optional page URL, and webhook subscriptions. Explain why you need each permission and give reviewers steps to test it.</li>
          <li>Open the App Store in a demo workspace you manage and select <strong>Test release</strong>. Save the installation ID, token, and any signing secret on your server.</li>
          <li>Use the publisher dashboard to see review feedback. After approval, workspace admins can install your app or approve an update. Updates and re-enabling issue fresh credentials.</li>
        </ol>
      </section>

      <section className="space-y-3 pt-10" aria-labelledby="workspace-page">
        <H2 id="workspace-page">Workspace pages</H2>
        <p className={prose}>DUMA loads your page in an isolated frame. Read <InlineCode>duma_launch</InlineCode> and <InlineCode>installation</InlineCode> from the URL fragment, then forward the code to your own backend.</p>
        <p className={prose}>Your backend exchanges the code using the matching installation token. The code works once and expires after two minutes. Serve private data after a successful exchange. The frame has an opaque browser origin, so a browser request to your backend will use <InlineCode>Origin: null</InlineCode>.</p>
        <CodeBlock label="Exchange a launch code" code={`POST ${API_ORIGIN}/v1/marketplace-runtime/launch/exchange
Authorization: Bearer dma_…
Content-Type: application/json

{"code":"dml_…"}`} />
        <p className={prose}>The response contains <InlineCode>installationId</InlineCode> and an installation-specific <InlineCode>viewerId</InlineCode>.</p>
      </section>

      <section className="space-y-3 pt-10" aria-labelledby="extensions">
        <H2 id="extensions">Widgets and tools</H2>
        <p className={prose}>Give each placement a title and a version-specific HTTPS URL. DUMA loads your interface in a sandboxed browser frame. You can use any frontend framework and host your own backend.</p>
        <ul className={`${prose} list-disc space-y-2 pl-5`}>
          <li><InlineCode>dashboard</InlineCode> adds an inline widget.</li>
          <li><InlineCode>order.detail</InlineCode> provides the open order’s total as a decimal string, plus the formatted amount DUMA displays.</li>
          <li><InlineCode>menu.photo</InlineCode> can load a DUMA-hosted photo and offer a generated image for the user to apply to the item.</li>
          <li><InlineCode>media.preview</InlineCode> can load the selected image or video and offer a generated image for the user to save as new media.</li>
        </ul>
        <CodeBlock label="Connect to DUMA from a placement" code={`const channel = new MessageChannel();
channel.port1.onmessage = ({ data }) => {
  if (data.type === 'context') {
    // data.surface, data.order?.total, data.order?.formattedTotal, data.hasSource
  }
  if (data.type === 'source') {
    // data.file is the selected asset as a File
  }
};
window.parent.postMessage('duma:connect:v1', '*', [channel.port2]);`} />
        <p className={prose}>When the user asks to load the source, send <InlineCode>{`{ type: 'request-source' }`}</InlineCode> over the port. Handle <InlineCode>source-error</InlineCode> for assets that are unavailable or over 24 MB.</p>
        <p className={prose}>Return a PNG, JPEG or WebP blob up to 10 MB as <InlineCode>{`{ type: 'offer-image', image }`}</InlineCode>. DUMA shows the result for the user to approve before applying it to a menu item or uploading a new media file.</p>
      </section>

      <section className="space-y-3 pt-10" aria-labelledby="content">
        <H2 id="content">Published Content API</H2>
        <p className={prose}>Request <InlineCode>cms.published:read</InlineCode> to list metadata such as slug, locale, and publication time. Make this request from your backend. Disabling or uninstalling the app revokes its credential.</p>
        <CodeBlock label="List published entry metadata" code={`GET ${API_ORIGIN}/v1/marketplace-runtime/content/published?limit=25
Authorization: Bearer dma_…`} />
      </section>

      <section className="space-y-3 py-10" aria-labelledby="events">
        <H2 id="events">Signed events</H2>
        <p className={prose}>Subscribe to entry publish, unpublish, delete, or media changes. Use <InlineCode>installationId</InlineCode> in the body to select the installation’s signing secret.</p>
        <p className={prose}>Verify <InlineCode>X-Duma-Signature</InlineCode> against the HMAC-SHA256 of the <InlineCode>X-Duma-Timestamp</InlineCode> header, a period, and the raw request body. Reject stale timestamps and use the event ID to deduplicate retries.</p>
        <Link className="text-primary underline" href="/developers/webhooks">See the webhook signing format</Link>
      </section>
    </DocsPage>
  );
}
