import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function PromotionsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('promotions:read');
  await requireModule('promotions');
  return children;
}
