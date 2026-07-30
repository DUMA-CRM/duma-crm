import { requireMinimumRole } from '@/lib/auth/require-role';

export default async function AuditLogLayout({ children }: { children: React.ReactNode }) {
  await requireMinimumRole('franchise_owner');
  return children;
}
