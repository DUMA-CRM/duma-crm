import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function QrOrderingLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('qr-ordering:read', 'qr-ordering:write');
  return children;
}
