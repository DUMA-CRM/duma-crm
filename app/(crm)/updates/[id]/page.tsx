import { UpdatesFeed } from '@/components/updates/UpdatesFeed';
export default async function UpdatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UpdatesFeed id={id} />;
}
