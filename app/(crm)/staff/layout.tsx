import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('staff:read', 'hr.people:read');
  return children;
}
