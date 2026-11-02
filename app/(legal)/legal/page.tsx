import type { Metadata } from 'next';
import Link from 'next/link';

import { CONTACT_EMAIL, OPERATOR, OPERATOR_LEGAL_NAME, SITE_URL } from '@/lib/marketing/site';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = {
  title: 'Company information',
  description: `Who provides DUMA: ${OPERATOR_LEGAL_NAME}, ${OPERATOR.address.join(', ')}.`,
};

/**
 * /legal — the UK equivalent of an imprint: who provides DUMA and how to reach
 * them, as the Electronic Commerce Regulations 2002 (reg. 6) and Companies Act
 * 2006 Part 41 ask. Every detail comes from OPERATOR in lib/marketing/site.ts.
 */
export default function CompanyInformationPage() {
  return (
    <LegalDocument title="Company information" updated="1 November 2026">
      <p>
        DUMA is provided by <strong>{OPERATOR.name}</strong>, {OPERATOR.status} trading as {OPERATOR.tradingAs}. DUMA is not a
        registered company.
      </p>

      <h2>Business details</h2>
      <ul>
        <li>
          <strong>Legal name</strong> — {OPERATOR.name}
        </li>
        <li>
          <strong>Trading name</strong> — {OPERATOR.tradingAs}
        </li>
        <li>
          <strong>Status</strong> — Sole trader, based in England
        </li>
        <li>
          <strong>Address</strong> — {OPERATOR.address.join(', ')}
        </li>
        <li>
          <strong>Email</strong> — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          <strong>Website</strong> — <a href={SITE_URL}>{SITE_URL.replace(/^https?:\/\//, '')}</a>
        </li>
      </ul>
      <p>The address above is also where legal notices and documents can be sent.</p>

      <h2>Related</h2>
      <p>
        How we provide the service is set out in the <Link href="/terms">Terms of Service</Link>, how we handle personal data in
        the <Link href="/privacy">Privacy Policy</Link>, and our duties when we process data for your business in the{' '}
        <Link href="/dpa">Data Processing Agreement</Link>.
      </p>
    </LegalDocument>
  );
}
