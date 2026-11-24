import { redirect } from 'next/navigation';

import { hasCapability } from '@/lib/auth/capabilities';
import { requireAnyCapability } from '@/lib/auth/require-capability';
import { workspaceModuleEnabled } from '@/lib/auth/require-module';

export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  // Two tabs, each with its own capability and module: Privacy requests
  // (privacy:read, compliance) and Audit log (audit:read, audit). `auditor`
  // reaches the audit log here — the old franchise_owner rank threshold shut
  // out the role that exists to read it.
  const profile = await requireAnyCapability('privacy:read', 'audit:read');
  const [compliance, audit] = await Promise.all([workspaceModuleEnabled('compliance'), workspaceModuleEnabled('audit')]);
  // `null` is a platform administrator — the tab's workspace decides.
  const privacyTab = hasCapability(profile, 'privacy:read') && compliance !== false;
  const auditTab = hasCapability(profile, 'audit:read') && audit !== false;
  if (!privacyTab && !auditTab) redirect('/settings/modules');
  return children;
}
