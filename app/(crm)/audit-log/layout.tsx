import { requireCapability } from '@/lib/auth/require-capability';

export default async function AuditLogLayout({ children }: { children: React.ReactNode }) {
  // `auditor` reaches this for the first time: the role exists to read the audit
  // log, and the old franchise_owner rank threshold shut it out.
  await requireCapability('audit:read');
  return children;
}
