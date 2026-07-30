import { requireMinimumRole } from '@/lib/auth/require-role';

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  await requireMinimumRole('store_manager');
  return children;
}
