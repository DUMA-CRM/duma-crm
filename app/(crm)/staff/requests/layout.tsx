import { requireCapability } from '@/lib/auth/require-capability';

export default async function StaffRequestsLayout({ children }: { children: React.ReactNode }) {
  // Gated on the capability that names the action. Note this admits
  // `store_manager`, which the previous role list did not — the leave review
  // endpoint has always accepted them, so the page was stricter than the API.
  await requireCapability('hr.leave:review');
  return children;
}
