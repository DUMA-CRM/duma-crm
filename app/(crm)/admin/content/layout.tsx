import { AdminContentScope } from '@/components/admin/AdminContentScope';

export default function AdminContentLayout({ children }: { children: React.ReactNode }) {
  return <AdminContentScope>{children}</AdminContentScope>;
}
