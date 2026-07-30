import { requireAnyRole } from '@/lib/auth/require-role';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireAnyRole(['franchise_owner', 'store_manager', 'hr_manager']);
  return children;
}
