import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { ANY_BUSINESS } from '@/lib/marketing/solutions/any-business';

/** /solutions/any-business — its words, and the claims they were checked against, are in lib/marketing/solutions/any-business.tsx. */
export const metadata = solutionMetadata(ANY_BUSINESS);

export default function AnyBusinessPage() {
  return <SolutionPage content={ANY_BUSINESS} />;
}
