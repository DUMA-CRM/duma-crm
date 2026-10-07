import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function SettingsConnectorsLayout({ children }: { children: React.ReactNode }) {
  // Media storage is a connector too: its credentials are CMS integration keys.
  await requireAnyCapability('email.connections:write', 'payments.connections:write', 'cms.keys:write');
  return children;
}
