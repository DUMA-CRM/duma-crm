import { StockUnitDetailPage } from '@/components/inventory/StockUnitDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StockUnitDetailPage stockUnitId={id} />;
}
