import { requireCapability } from '@/lib/auth/require-capability';

export default async function SettingsWorkspacesLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('settings:write');
  return children;
}
