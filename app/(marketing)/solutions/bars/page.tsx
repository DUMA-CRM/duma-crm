import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { BARS } from '@/lib/marketing/solutions/bars';

/** /solutions/bars — its words, and the claims they were checked against, are in lib/marketing/solutions/bars.tsx. */
export const metadata = solutionMetadata(BARS);

export default function BarsPage() {
  return <SolutionPage content={BARS} />;
}
