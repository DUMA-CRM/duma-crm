'use client';

import { Suspense } from 'react';

import { ReservationsWorkspace } from '@/components/reservations/ReservationsWorkspace';

export default function ReservationsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <ReservationsWorkspace />
    </Suspense>
  );
}
