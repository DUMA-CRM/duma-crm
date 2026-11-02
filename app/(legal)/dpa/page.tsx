import type { Metadata } from 'next';
import Link from 'next/link';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { CONTACT_EMAIL, OPERATOR, OPERATOR_LEGAL_NAME } from '@/lib/marketing/site';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = marketingMetadata({
  title: 'Data Processing Agreement | DUMA',
  description: 'The terms on which DUMA processes personal data for the businesses that use it, under UK GDPR and EU GDPR Article 28.',
  path: '/dpa',
});

/*
 * Every factual line here — providers, hosting, security, erasure — must match
 * the Privacy Policy and the code. The subprocessor list is checked against
 * duma-api (lib/hostinger-mail.ts, lib/cms-storage.ts) and lib/analytics/client.ts.
 */
export default function DpaPage() {
  return (
    <LegalDocument title="Data Processing Agreement" updated="1 November 2026">
      <p>
        This agreement forms part of the <Link href="/terms">Terms of Service</Link> between {OPERATOR_LEGAL_NAME},{' '}
        {OPERATOR.status} of {OPERATOR.address.join(', ')} (&ldquo;DUMA&rdquo;, &ldquo;we&rdquo;), and the business that holds a DUMA workspace (&ldquo;the business&rdquo;,
        &ldquo;you&rdquo;). It applies whenever we process personal data on your behalf, and sets out the terms required by
        Article 28 of the UK GDPR and the EU GDPR. Using a workspace means accepting it; no signature is needed.
      </p>

      <h2>1. Roles</h2>
      <p>
        For the personal data you put into your workspace, you are the <strong>controller</strong> and DUMA is your{' '}
        <strong>processor</strong>. For our own account holders&apos; sign-in details and our service emails, DUMA is the
        controller, as described in the <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>2. What we process</h2>
      <ul>
        <li>
          <strong>Subject matter and duration</strong> — providing the DUMA service, for as long as your workspace exists,
          and then until the data is returned or deleted under section 9.
        </li>
        <li>
          <strong>Nature and purpose</strong> — storing, organising, displaying and transmitting data so that you can take
          orders and payments, run the kitchen, manage stock, staff, customers and content, and report on them.
        </li>
        <li>
          <strong>Data subjects</strong> — your staff, your customers, guests who order by QR code or book a table, people
          who submit your forms, and people named in your notes and content.
        </li>
        <li>
          <strong>Personal data</strong> — contact details, dates of birth and addresses; order, loyalty and booking
          history; marketing consent; staff records such as shifts, timesheets, leave, pay rate, tax code, National
          Insurance number, bank details and employment documents; and anything you write into notes or content.
        </li>
        <li>
          <strong>Special category data</strong> — only what you choose to record, such as allergies and dietary needs or
          fit notes, which can reveal health information. You are responsible for having a condition for processing it.
        </li>
      </ul>

      <h2>3. Your instructions</h2>
      <p>
        We process personal data only on your documented instructions. This agreement, the Terms and the way you configure
        and use your workspace are those instructions. If we are required by law to process it otherwise, we will tell you
        first unless the law forbids it. If we believe an instruction breaks data protection law, we will tell you.
      </p>

      <h2>4. Confidentiality</h2>
      <p>
        Anyone at DUMA who can access your personal data is bound by confidentiality, and accesses it only to provide,
        support or secure the service.
      </p>

      <h2>5. Security</h2>
      <p>We take appropriate technical and organisational measures, including:</p>
      <ul>
        <li>Encryption of all data in transit.</li>
        <li>
          Encryption at rest of National Insurance numbers, bank account details, payment provider credentials, email server
          passwords and connected-account tokens.
        </li>
        <li>A database with no public network route, on a server hosted in the United Kingdom.</li>
        <li>Access inside a workspace limited by the permissions you assign to each member of staff.</li>
        <li>An audit log of important actions, with who took them and when.</li>
        <li>Passwords stored only as a one-way hash.</li>
      </ul>

      <h2>6. Subprocessors</h2>
      <p>
        You authorise us to use the subprocessors below. Each is bound by written terms that protect personal data to the
        same standard as this agreement, and we remain responsible to you for their work.
      </p>
      <ul>
        <li>
          <strong>Hostinger</strong> — the server and database that run DUMA, in Manchester, United Kingdom; and the email
          service that sends account emails such as password resets.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the web app, and stores images added to notes and email templates.
        </li>
        <li>
          <strong>Cloudflare</strong> — stores media for website content, unless you connect your own storage.
        </li>
        <li>
          <strong>GitHub</strong> — stores encrypted database backups.
        </li>
        <li>
          <strong>PostHog</strong> (EU region) — product analytics on how the app is used. Session recording is off and
          on-screen text is masked; it receives the signed-in user&apos;s name and email, not your customers&apos; data.
        </li>
        <li>
          <strong>Google (Gemini) and OpenRouter</strong> — AI models for the Ask DUMA assistant and content tools. They
          receive only the request a user makes and the data needed to answer it.
        </li>
      </ul>
      <p>
        Services you connect yourself — payment providers such as Stripe, SumUp or Square, your own email server, your own
        storage bucket, or a user&apos;s Google Drive — act on your instructions under your own agreement with them, not as
        our subprocessors.
      </p>
      <p>
        We will tell you at least 30 days before adding or replacing a subprocessor, by email to the workspace owner and on
        this page. You may object on reasonable data protection grounds; if we cannot address the objection, you may close
        your workspace before the change takes effect.
      </p>

      <h2>7. International transfers</h2>
      <p>
        Your workspace data is stored in the United Kingdom. Some subprocessors process data outside the UK and EEA; where
        they do, we rely on adequacy decisions, or on the UK International Data Transfer Addendum and the EU standard
        contractual clauses.
      </p>

      <h2>8. Helping you meet your obligations</h2>
      <ul>
        <li>
          <strong>Requests from individuals</strong> — DUMA lets you export customer data and orders, correct records,
          handle access and erasure requests, and anonymise former employees after their retention period. If a request
          reaches us directly, we will pass it to you without undue delay and not answer it ourselves.
        </li>
        <li>
          <strong>Personal data breaches</strong> — we will notify you without undue delay after becoming aware of a breach
          affecting your data, with what we know about its nature, likely consequences and the measures taken, and keep you
          updated as we learn more.
        </li>
        <li>
          <strong>Impact assessments</strong> — we will give you the information we reasonably can for a data protection
          impact assessment or a consultation with a supervisory authority.
        </li>
      </ul>
      <p>
        When a customer is erased, their record is anonymised and their orders are kept without their identity, because
        financial records must be retained. Audit log entries and copies of sent emails are not yet removed by erasure; we
        are working to close that gap.
      </p>

      <h2>9. When the service ends</h2>
      <p>
        You can export your data while your workspace is open. When it closes, we will delete or return the personal data
        we process for you, at your choice, unless the law requires us to keep it. Encrypted backups expire on their normal
        cycle.
      </p>

      <h2>10. Information and audits</h2>
      <p>
        We will make available the information reasonably needed to show that we meet this agreement, and answer your
        written questions about it. Where that is not enough, we will allow and contribute to an audit by you or an auditor
        you appoint who is bound by confidentiality, on reasonable notice, during working hours, and no more than once a
        year unless a supervisory authority requires it or a breach has occurred.
      </p>

      <h2>11. Liability and order of precedence</h2>
      <p>
        Each party&apos;s liability under this agreement is subject to the limits in the Terms. If this agreement and the
        Terms conflict on the protection of personal data, this agreement wins.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this agreement, or to object to a subprocessor:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also <Link href="/gdpr">DUMA and GDPR</Link>.
      </p>
    </LegalDocument>
  );
}
