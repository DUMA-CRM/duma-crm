import type { Metadata } from 'next';

import { ComparePage, compareMetadata } from '@/components/marketing/compare/ComparePage';

import { DUMA_VS_SQUARE } from '@/lib/marketing/compare';

export const metadata: Metadata = compareMetadata(DUMA_VS_SQUARE);

/** /compare/duma-vs-square — words and sources in lib/marketing/compare.ts. */
export default function DumaVsSquarePage() {
  return <ComparePage content={DUMA_VS_SQUARE} />;
}
