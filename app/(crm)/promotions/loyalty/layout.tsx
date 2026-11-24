import { requireCapability } from '@/lib/auth/require-capability';

/**
 * Loyalty programmes belong to Customers (they were /customers/loyalty, under
 * its customers:read guard) and show as a tab of Promotions. The guard is the
 * one it had — not the promotions one, so a workspace or a role with loyalty
 * but no promotions still reaches it.
 */
export default async function PromotionsLoyaltyLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('customers:read');
  return children;
}
