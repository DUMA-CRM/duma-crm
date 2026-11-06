import type { Metadata } from 'next';
import Link from 'next/link';

import { marketingMetadata } from '@/lib/marketing/metadata';
import { CONTACT_EMAIL } from '@/lib/marketing/site';

import { LegalDocument } from '../LegalDocument';

export const metadata: Metadata = marketingMetadata({
  title: 'Deleting your social account data | DUMA',
  description:
    'How to disconnect a Facebook, Instagram, YouTube or TikTok account from DUMA and have the data DUMA keeps about it deleted.',
  path: '/data-deletion',
});

/*
 * The data deletion instructions URL Meta asks for on a Facebook / Instagram
 * app. Every statement matches the code: disconnecting clears the stored
 * token (duma-api routes/marketing.ts) and keeps the account record, drafts
 * and publishing history until someone asks for them to be deleted.
 */
export default function DataDeletionPage() {
  return (
    <LegalDocument title="Deleting your social account data" updated="6 November 2026">
      <p>
        A business can connect its Facebook Pages, Instagram, YouTube and TikTok accounts to DUMA to publish the posts it schedules. This
        page explains how to disconnect an account and how to have the data DUMA keeps about it deleted.
      </p>

      <h2>What DUMA keeps for a connected account</h2>
      <ul>
        <li>The account&apos;s name and ID, so it can be chosen as a destination.</li>
        <li>An encrypted access token, used only to publish the posts the business schedules.</li>
        <li>The posts, captions and media scheduled for it, and a history of each publishing attempt.</li>
      </ul>

      <h2>1. Disconnect the account in DUMA</h2>
      <p>
        In DUMA, open <strong>Settings → Connections</strong>, choose the platform, then the account&apos;s <strong>⋯</strong> menu and{' '}
        <strong>Disconnect</strong>. The access token is deleted straight away and nothing more is published to that account. The
        account&apos;s name, drafts and publishing history stay in DUMA until you ask for them to be deleted.
      </p>

      <h2>2. Remove DUMA from the platform</h2>
      <p>
        In Facebook or Instagram, open your account settings and remove DUMA from the apps and business integrations you have allowed. On
        YouTube, remove DUMA in your Google account&apos;s <a href="https://myaccount.google.com/permissions">security settings</a>. This
        stops DUMA&apos;s access on the platform&apos;s side too.
      </p>

      <h2>3. Ask us to delete the rest</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address you use for DUMA, with your workspace&apos;s name and
        the account you want deleted. We delete the account&apos;s record and the posts, media and publishing history kept for it, and
        confirm by email within one month.
      </p>
      <p>
        For everything else DUMA holds about you, see the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalDocument>
  );
}
