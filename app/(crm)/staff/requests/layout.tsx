import { requireCapability } from '@/lib/auth/require-capability';

export default async function StaffRequestsLayout({ children }: { children: React.ReactNode }) {
  // Gated on reading the queue — `GET /hr/leave-requests` is hr.leave:read.
  // Approve and Decline are hr.leave:review and are gated per row, so someone
  // who can read leave but not decide it sees the queue without the buttons.
  await requireCapability('hr.leave:read');
  return children;
}
