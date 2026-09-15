import { requireCapability } from '@/lib/auth/require-capability';

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('orders:read');
  return children;
}
