import type { Metadata } from 'next';

import { GuestBooking } from '@/components/reservations/GuestBooking';

export const metadata: Metadata = {
  title: 'Book a table — DUMA',
  description: 'Choose a day, a time and how many, and book a table.',
  robots: { index: false, follow: false },
};

export default async function PublicBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GuestBooking token={token} />;
}
