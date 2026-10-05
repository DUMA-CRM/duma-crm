import { requireCapability } from '@/lib/auth/require-capability';

export default async function SettingsModulesLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('settings:write');
  return children;
}
