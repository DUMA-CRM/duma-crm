import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function SettingsConnectorsLayout({ children }: { children: React.ReactNode }) {
  // Media storage is a connector too: its credentials are CMS integration keys.
  // Google Drive is each person's own, for Notes — so anyone who writes notes gets here,
  // and sees only the connectors their capabilities allow (the grid filters per card).
  await requireAnyCapability('email.connections:write', 'payments.connections:write', 'cms.keys:write', 'notes:write');
  return children;
}
