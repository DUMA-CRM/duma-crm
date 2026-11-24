import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { BAKERIES } from '@/lib/marketing/solutions/bakeries';

/** /solutions/bakeries — its words, and the claims they were checked against, are in lib/marketing/solutions/bakeries.tsx. */
export const metadata = solutionMetadata(BAKERIES);

export default function BakeriesPage() {
  return <SolutionPage content={BAKERIES} />;
}
