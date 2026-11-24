import { SolutionPage, solutionMetadata } from '@/components/marketing/SolutionPage';

import { BLOGS } from '@/lib/marketing/solutions/blogs';

/** /solutions/blogs — its words, and the claims they were checked against, are in lib/marketing/solutions/blogs.tsx. */
export const metadata = solutionMetadata(BLOGS);

export default function BlogsPage() {
  return <SolutionPage content={BLOGS} />;
}
