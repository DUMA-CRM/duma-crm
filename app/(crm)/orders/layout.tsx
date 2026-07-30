import { requireMinimumRole } from '@/lib/auth/require-role';

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireMinimumRole('store_manager');
  return children;
}
