import { requireCapability } from '@/lib/auth/require-capability';

export default async function CustomersLayout({ children }: { children: React.ReactNode }) {
  // `marketing_manager` reaches this for the first time — see lib/auth/capabilities.ts.
  await requireCapability('customers:read');
  return children;
}
