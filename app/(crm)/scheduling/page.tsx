'use client';

import { useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { MyRota } from '@/components/scheduling/MyRota';
import { ShiftsView } from '@/components/scheduling/ShiftsView';
import { TeamRota } from '@/components/scheduling/TeamRota';
import { SegmentedControl } from '@/components/shared/SegmentedControl';

import { roleAtLeast } from '@/lib/api/staff.service';
import { useAuthStore } from '@/stores/authStore';

type View = 'my' | 'team' | 'shifts';

const VIEW_TABS = [
  { value: 'my' as const, label: 'My Rota' },
  { value: 'team' as const, label: 'Team Rota' },
  { value: 'shifts' as const, label: 'Shifts' },
];

export default function SchedulingPage() {
  const role = useAuthStore((s) => s.role);
  const canManage = roleAtLeast(role, 'store_manager');
  const [view, setView] = useState<View>('my');

  // Managers get the full switcher; everyone else just sees their own rota.
  const active = canManage ? view : 'my';

  return (
    <PageLayout
      eyebrow="Scheduling"
      title="Schedule"
      fullHeight
      headerBorder={true}
      headerSlot={canManage ? <SegmentedControl options={VIEW_TABS} value={view} onChange={setView} /> : undefined}
    >
      {active === 'my' ? <MyRota /> : active === 'team' ? <TeamRota /> : <ShiftsView />}
    </PageLayout>
  );
}
