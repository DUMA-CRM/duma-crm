import { requireCapability } from '@/lib/auth/require-capability';
import { requireModule } from '@/lib/auth/require-module';

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('notes:read');
  await requireModule('notes');
  return children;
}
