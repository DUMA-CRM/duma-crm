import { requireCapability } from '@/lib/auth/require-capability';

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('privacy:read');
  return children;
}
