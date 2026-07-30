'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { MyRota } from '@/components/scheduling/MyRota';

/** Your own rota. The team rota and shift cover are tabs of the staff workspace. */
export default function MyRotaPage() {
  return (
    <PageLayout eyebrow="Scheduling" title="My Rota" fullHeight headerBorder={false}>
      <MyRota />
    </PageLayout>
  );
}
