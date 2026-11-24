import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function ReservationsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('reservations:read');
  await requireModule('reservations');
  return children;
}
