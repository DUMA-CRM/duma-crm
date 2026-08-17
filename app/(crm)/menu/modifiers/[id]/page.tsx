import { ModifierDetail } from '@/components/menu/ModifierDetail';

export default async function ModifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModifierDetail modifierId={id} />;
}
