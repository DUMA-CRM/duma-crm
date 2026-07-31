import { requireMinimumRole } from '@/lib/auth/require-role';

export default async function SettingsConnectorsLayout({ children }: { children: React.ReactNode }) {
  await requireMinimumRole('franchise_owner');
  return children;
}
