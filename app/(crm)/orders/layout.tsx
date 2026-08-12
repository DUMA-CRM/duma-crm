import { requireCapability } from '@/lib/auth/require-capability';

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  // The management surface — refunds, bulk status, export. Every till user holds
  // `orders:read` for their own order flow, which is not enough for this page.
  await requireCapability('orders:bulk');
  return children;
}
