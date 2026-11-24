import { requireAnyCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function QrOrderingLayout({ children }: { children: React.ReactNode }) {
  await requireAnyCapability('qr-ordering:read', 'qr-ordering:write');
  await requireModule('qr-ordering');
  return children;
}
