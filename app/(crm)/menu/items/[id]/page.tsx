import { MenuItemDetail } from '@/components/menu/MenuItemDetail';

export default async function MenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MenuItemDetail menuItemId={id} />;
}
