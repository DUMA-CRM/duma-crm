import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { RETAIL } from '@/lib/marketing/solutions/retail';

/** /solutions/retail — its words, and the claims they were checked against, are in lib/marketing/solutions/retail.tsx. */
export const metadata = solutionMetadata(RETAIL);

export default function RetailPage() {
  return <SolutionPage content={RETAIL} />;
}
