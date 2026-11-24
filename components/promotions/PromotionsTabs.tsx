'use client';

import { useRouter } from 'next/navigation';

import { Award, Gift, TicketPercent } from '@/components/icons';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';

import { hasAllCapabilities } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { useAuthStore } from '@/stores/authStore';

export type PromotionsTab = 'promotions' | 'loyalty' | 'referrals';
const HREF: Record<PromotionsTab, string> = {
  promotions: '/promotions',
  loyalty: '/promotions/loyalty',
  referrals: '/promotions/referrals',
};

/** Each tab's name — also the page title while it is open. */
export const PROMOTIONS_TAB_LABEL: Record<PromotionsTab, string> = {
  promotions: 'Promotions',
  loyalty: 'Loyalty',
  referrals: 'Refer a friend',
};

/**
 * Promotions | Loyalty | Refer a friend. Each is its own route with its own
 * module and guard, so each tab shows only when that route would let the
 * viewer in:
 * - Promotions: the promotions module and `promotions:read`.
 * - Loyalty: belongs to Customers — `customers:read` to open it and
 *   `customers:points` to manage it (the same rule as its Customers button).
 * - Refer a friend: the referrals module and `referrals:read`, on top of the
 *   promotions guard its route repeats.
 *
 * The open tab always shows. The strip hides when it would hold only that
 * one; the shared animation id lets the indicator slide between routes.
 */
export function PromotionsTabs({ value }: { value: PromotionsTab }) {
  const router = useRouter();
  const capabilities = useAuthStore((state) => state.capabilities);
  const promotionsOn = useModuleEnabled('promotions');
  const customersOn = useModuleEnabled('customers');
  const referralsOn = useModuleEnabled('referrals');

  const promotions = promotionsOn && hasAllCapabilities(capabilities, 'promotions:read');
  const visible: Record<PromotionsTab, boolean> = {
    promotions,
    loyalty: customersOn && hasAllCapabilities(capabilities, 'customers:read', 'customers:points'),
    referrals: promotions && referralsOn && hasAllCapabilities(capabilities, 'referrals:read'),
  };

  const all: SectionTab<PromotionsTab>[] = [
    { value: 'promotions', label: PROMOTIONS_TAB_LABEL.promotions, icon: TicketPercent },
    { value: 'loyalty', label: PROMOTIONS_TAB_LABEL.loyalty, icon: Award },
    { value: 'referrals', label: PROMOTIONS_TAB_LABEL.referrals, icon: Gift },
  ];
  const tabs = all.filter((tab) => tab.value === value || visible[tab.value]);
  if (tabs.length < 2) return null;

  return (
    <SectionTabs<PromotionsTab>
      tabs={tabs}
      value={value}
      onChange={(next) => router.push(HREF[next])}
      ariaLabel="Promotions sections"
      animationId="promotions-tabs"
    />
  );
}
