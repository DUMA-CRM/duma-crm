import { requireCapability } from '@/lib/auth/require-capability';

export default async function KdsLayout({ children }: { children: React.ReactNode }) {
  // Bumping a kitchen ticket changes order status, so the terminal belongs only
  // to operators who can perform that action rather than every order reader.
  await requireCapability('orders:status');
  return children;
}
