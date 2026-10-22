import { requireCapability } from '@/lib/auth/require-capability';

export default async function AutomationLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('email:read');
  return children;
}
