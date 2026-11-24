import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { SHOPS } from '@/lib/marketing/solutions/shops';

/** /solutions/shops — its words, and the claims they were checked against, are in lib/marketing/solutions/shops.tsx. */
export const metadata = solutionMetadata(SHOPS);

export default function ShopsPage() {
  return <SolutionPage content={SHOPS} />;
}
