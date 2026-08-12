import { requireCapability } from '@/lib/auth/require-capability';

export default async function StaffHelpdeskLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('helpdesk:manage');
  return children;
}
