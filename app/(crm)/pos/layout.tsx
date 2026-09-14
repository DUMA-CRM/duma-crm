import { requireCapability } from '@/lib/auth/require-capability';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  // The till creates orders. A read-only role may inspect order history, but
  // rendering the POS would lead them into a checkout the API must refuse.
  await requireCapability('orders:create');
  return children;
}
