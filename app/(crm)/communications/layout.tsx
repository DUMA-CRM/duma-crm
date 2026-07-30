import { requireAnyRole } from '@/lib/auth/require-role';

export default async function CommunicationsLayout({ children }: { children: React.ReactNode }) {
  await requireAnyRole(['franchise_owner', 'store_manager', 'marketing_manager']);
  return children;
}
