import type { Metadata } from 'next';
import Link from 'next/link';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { CONTACT_EMAIL } from '@/lib/marketing/site';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = marketingMetadata({
  title: 'DUMA and GDPR | DUMA',
  description: 'How DUMA handles personal data under UK GDPR and EU GDPR: who is responsible for what, where data is stored, and the tools you have.',
  path: '/gdpr',
});

/*
 * Plain-language companion to the DPA. Claims follow the business profile's
 * guardrails (Obsidian, Platform/DUMA Business Profile §9–10): no "GDPR
 * compliant" or "certified", no automatic-backup or full-export promise.
 */
export default function GdprPage() {
  return (
    <LegalDocument title="DUMA and GDPR" updated="31 October 2026">
      <p>
        If you run a café, a shop or any business in the UK or Europe, the GDPR applies to the personal data you keep about
        your customers and staff. This page explains how DUMA fits in: what we do, what stays your responsibility, and the
        tools DUMA gives you. The legal terms are in the <Link href="/dpa">Data Processing Agreement</Link>.
      </p>

      <h2>Who is responsible for what</h2>
      <p>
        You decide what data to keep about your customers and staff and why, so your business is the{' '}
        <strong>controller</strong>. DUMA stores and processes that data only to run the service for you, so we are your{' '}
        <strong>processor</strong>. Our duties as processor are set out in the <Link href="/dpa">Data Processing Agreement</Link>
        , which is part of the Terms — you do not need to sign anything separately.
      </p>

      <h2>Where your data lives</h2>
      <ul>
        <li>Your workspace data is stored on a server in Manchester, United Kingdom.</li>
        <li>
          A short list of providers helps us run the service — hosting, email, media storage, backups, analytics and AI. They
          are named in the <Link href="/dpa">Data Processing Agreement</Link>, and we give 30 days&apos; notice before adding
          one.
        </li>
        <li>You can keep website media in your own Cloudflare R2 or Vercel Blob storage instead of ours.</li>
      </ul>

      <h2>Tools DUMA gives you</h2>
      <ul>
        <li>
          <strong>Access requests</strong> — export a customer&apos;s data and their orders.
        </li>
        <li>
          <strong>Erasure</strong> — erase a customer: their record is anonymised and their orders are kept without their
          identity, because you must keep financial records.
        </li>
        <li>
          <strong>Former staff</strong> — anonymise an employee once their retention period has passed.
        </li>
        <li>
          <strong>Marketing consent</strong> — recorded on each customer, so you only email the people who agreed.
        </li>
        <li>
          <strong>Permissions</strong> — each member of staff sees only what their role allows; payroll and bank details stay
          with the people who need them.
        </li>
        <li>
          <strong>Audit log</strong> — important actions are recorded with who took them and when.
        </li>
      </ul>

      <h2>How we protect it</h2>
      <ul>
        <li>Everything is encrypted in transit.</li>
        <li>
          National Insurance numbers, bank details, payment and email credentials and connected-account tokens are also
          encrypted at rest.
        </li>
        <li>The database has no public network route.</li>
        <li>Card numbers never reach DUMA — your payment provider handles them.</li>
        <li>We do not sell personal data or use it for advertising.</li>
      </ul>

      <h2>What stays with you</h2>
      <ul>
        <li>Telling your customers and staff how you use their data, in your own privacy notice.</li>
        <li>Having a lawful basis for what you record, and a condition for health information such as allergies or fit notes.</li>
        <li>Answering requests from your customers and staff — DUMA gives you the tools, and we will help if you ask.</li>
        <li>Keeping data only as long as you need it.</li>
      </ul>

      <h2>What we are still improving</h2>
      <p>
        We would rather tell you than have you find out. Erasing a customer does not yet remove them from audit log entries
        or from copies of emails already sent. And some AI models behind the Ask DUMA assistant are offered free by their
        providers, who may retain prompts — so leave personal data out of an assistant request unless it is needed.
      </p>

      <h2>Questions</h2>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For how we handle our own account holders&apos;
        data, see the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalDocument>
  );
}
