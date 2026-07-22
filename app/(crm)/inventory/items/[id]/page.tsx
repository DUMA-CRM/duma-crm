import { InventoryItemDetailPage } from '@/components/inventory/InventoryItemDetailPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryItemDetailPage stockItemId={id} />;
}
