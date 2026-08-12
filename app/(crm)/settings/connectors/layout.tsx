import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function SettingsConnectorsLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('email.connections:write', 'payments.connections:write');
  return children;
}
