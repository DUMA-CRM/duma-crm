import { requireCapability } from '@/lib/auth/require-capability';

export default async function SettingsRolesLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('staff:access');
  return children;
}
