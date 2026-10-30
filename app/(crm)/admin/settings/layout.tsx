import { AdminSettingsScope } from '@/components/admin/AdminSettingsScope';

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <AdminSettingsScope>{children}</AdminSettingsScope>;
}
