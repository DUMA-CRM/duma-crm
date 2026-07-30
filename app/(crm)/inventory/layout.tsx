import { requireMinimumRole } from '@/lib/auth/require-role';

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireMinimumRole('store_manager');
  return children;
}
