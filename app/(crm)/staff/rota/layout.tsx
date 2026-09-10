import { requireAnyCapability } from '@/lib/auth/require-capability';

export default async function StaffRotaLayout({ children }: { children: React.ReactNode }) {
  // The parent `/staff` guard admits `hr_manager`, who holds `hr.people:read`
  // but neither scheduling capability — every call this page makes would 403.
  // Widening HR into the rota is a product decision, not a gating accident.
  await requireAnyCapability('scheduling:read', 'shifts:read');
  return children;
}
