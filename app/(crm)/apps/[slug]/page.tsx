import { MarketplacePage } from '@/components/marketplace/MarketplacePage';

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MarketplacePage slug={slug} />;
}
