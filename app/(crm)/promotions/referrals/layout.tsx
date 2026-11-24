import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

/**
 * Refer a friend is its own module, on top of promotions. The promotions guard
 * no longer wraps every /promotions route (Loyalty is reachable without it), so
 * it is repeated here first — access is exactly what it was.
 */
export default async function ReferralsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('promotions:read');
  await requireModule('promotions');
  await requireCapability('referrals:read');
  await requireModule('referrals');
  return children;
}
