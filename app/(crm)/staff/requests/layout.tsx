import { requireAnyRole } from '@/lib/auth/require-role';

export default async function StaffRequestsLayout({ children }: { children: React.ReactNode }) {
  await requireAnyRole(['franchise_owner', 'hr_manager']);
  return children;
}
