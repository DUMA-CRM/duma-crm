import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { CAFES } from '@/lib/marketing/solutions/cafes';

/** /solutions/cafes — its words, and the claims they were checked against, are in lib/marketing/solutions/cafes.tsx. */
export const metadata = solutionMetadata(CAFES);

export default function CafesPage() {
  return <SolutionPage content={CAFES} />;
}
