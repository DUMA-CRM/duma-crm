import { requireCapability } from '@/lib/auth/require-capability';

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  // `stock:read`, not `inventory:read` — till staff hold the latter to record waste.
  await requireCapability('stock:read');
  return children;
}
