'use client';

import { useRouter } from 'next/navigation';

import { Gift, TicketPercent } from '@/components/icons';
import { SectionTabs } from '@/components/shared/SectionTabs';

import { hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { useAuthStore } from '@/stores/authStore';

type Tab = 'promotions' | 'referrals';
const HREF: Record<Tab, string> = { promotions: '/promotions', referrals: '/promotions/referrals' };

/**
 * Promotions | Referrals — referrals is its own module, so its tab appears
 * only when the workspace has it on and the viewer can read it. Each tab is
 * its own route; the shared animation id lets the indicator slide between them.
 */
export function PromotionsTabs({ value }: { value: Tab }) {
  const router = useRouter();
  const referralsOn = useModuleEnabled('referrals');
  const canRead = hasCapability(
    useAuthStore((state) => state.capabilities),
    'referrals:read',
  );
  if (!(referralsOn && canRead) && value === 'promotions') return null;
  return (
    <SectionTabs<Tab>
      tabs={[
        { value: 'promotions', label: 'Promotions', icon: TicketPercent },
        { value: 'referrals', label: 'Refer a friend', icon: Gift },
      ]}
      value={value}
      onChange={(next) => router.push(HREF[next])}
      ariaLabel="Promotions sections"
      animationId="promotions-tabs"
    />
  );
}
