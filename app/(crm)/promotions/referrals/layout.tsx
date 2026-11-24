import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

/** Refer a friend is its own module, on top of promotions (whose layout wraps this one). */
export default async function ReferralsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('referrals:read');
  await requireModule('referrals');
  return children;
}
