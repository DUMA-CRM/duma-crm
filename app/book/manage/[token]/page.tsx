import type { Metadata } from 'next';

import { GuestManageBooking } from '@/components/reservations/GuestManageBooking';

export const metadata: Metadata = {
  title: 'Your booking — DUMA',
  description: 'See or cancel your table booking.',
  robots: { index: false, follow: false },
};

export default async function GuestManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestManageBooking token={token} />;
}
