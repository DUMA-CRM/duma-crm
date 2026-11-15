import type { Metadata } from 'next';

import { QrOrderExperience } from '@/components/ordering/QrOrderExperience';

export const metadata: Metadata = {
  title: 'Order for collection — DUMA',
  description: 'Browse the menu and prepare a collection order.',
  robots: { index: false, follow: false },
};

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ order?: string; payment?: string; preview?: string; location?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return (
    <QrOrderExperience
      token={token}
      initialTrackingToken={query.order ?? null}
      paymentCancelled={query.payment === 'cancelled'}
      // The settings page's phone: the menu built from the draft (a staff-only call), not the published one.
      previewLocationId={query.preview === '1' ? (query.location ?? null) : null}
    />
  );
}
