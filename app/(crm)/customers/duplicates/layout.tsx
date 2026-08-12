import { requireCapability } from '@/lib/auth/require-capability';

export default async function CustomerDuplicatesLayout({ children }: { children: React.ReactNode }) {
  // Merging is destructive-ish even though it is reversible, so the review queue
  // is gated on the same capability as the merge itself.
  await requireCapability('customers:merge');
  return children;
}
