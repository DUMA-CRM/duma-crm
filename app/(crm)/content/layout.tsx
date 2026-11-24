import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function ContentLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('cms:read');
  await requireModule('cms');
  return children;
}
