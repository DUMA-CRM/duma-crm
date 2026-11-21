import { AdminUserDetail } from '@/components/admin/AdminUserDetail';

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <AdminUserDetail userId={decodeURIComponent(userId)} />;
}
