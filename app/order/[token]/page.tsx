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
  searchParams: Promise<{ order?: string; payment?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  return <QrOrderExperience token={token} initialTrackingToken={query.order ?? null} paymentCancelled={query.payment === 'cancelled'} />;
}
