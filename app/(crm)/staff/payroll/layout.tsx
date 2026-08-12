import { requireCapability } from '@/lib/auth/require-capability';

export default async function PayrollLayout({ children }: { children: React.ReactNode }) {
  await requireCapability('hr.payroll:read');
  return children;
}
