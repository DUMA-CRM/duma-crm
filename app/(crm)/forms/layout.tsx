import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function FormsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('forms:read');
  await requireModule('forms');
  return children;
}
