import type { Metadata } from 'next';

import { ComparePage, compareMetadata } from '@/components/marketing/compare/ComparePage';

import { DUMA_VS_SHOPIFY } from '@/lib/marketing/compare';

export const metadata: Metadata = compareMetadata(DUMA_VS_SHOPIFY);

/** /compare/duma-vs-shopify — words and sources in lib/marketing/compare.ts. */
export default function DumaVsShopifyPage() {
  return <ComparePage content={DUMA_VS_SHOPIFY} />;
}
