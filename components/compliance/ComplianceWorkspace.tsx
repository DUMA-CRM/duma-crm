'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { AuditLogView } from '@/components/audit/AuditLogView';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { History, ShieldCheck } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';

import { hasCapability } from '@/lib/auth/capabilities';
import { useWorkspaceModules } from '@/lib/hooks/useWorkspaceContext';
import type { ModuleId } from '@/lib/modules/manifest';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'privacy' | 'audit-log';

const ICON = <ShieldCheck size={20} aria-hidden="true" />;

/**
 * Compliance: the privacy request queue and the audit log, as tabs.
 *
 * Privacy requests — subject access and erasure, with their statutory due
 * dates — used to be a tab on the customers page. They moved because they are
 * not a way of browsing customers: a workload with its own deadlines, worked
 * through by whoever owns compliance, and burying it behind a customer list
 * made it easy to forget a clock was running.
 *
 * Each tab shows only with its own capability and module (privacy:read and
 * compliance; audit:read and audit). The layout lets the page open with either.
 */
export function ComplianceWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  // Until the workspace's modules are known, assume on: the layout has already
  // sent a member whose workspace has neither tab's module away.
  const modules = useWorkspaceModules();
  const moduleOn = (id: ModuleId) => !modules || modules.some((state) => state.moduleId === id && state.status === 'enabled');
  const privacyOn = hasCapability(capabilities, 'privacy:read') && moduleOn('compliance');
  const auditOn = hasCapability(capabilities, 'audit:read') && moduleOn('audit');

  const tabs: SectionTab<Tab>[] = [
    ...(privacyOn ? [{ value: 'privacy' as const, label: 'Privacy requests', icon: ShieldCheck }] : []),
    ...(auditOn ? [{ value: 'audit-log' as const, label: 'Audit log', icon: History }] : []),
  ];
  const tab: Tab = (searchParams.get('tab') === 'audit-log' && auditOn) || !privacyOn ? 'audit-log' : 'privacy';
  // A tab bar of one says nothing.
  const subheader =
    tabs.length > 1 ? (
      <SectionTabs
        tabs={tabs}
        value={tab}
        // The audit log's filters belong to that tab, so a switch starts clean.
        onChange={(value) => router.replace(value === 'audit-log' ? '/compliance?tab=audit-log' : '/compliance', { scroll: false })}
        ariaLabel="Compliance sections"
      />
    ) : undefined;

  if (tab === 'audit-log') {
    if (!auditOn) return null;
    return <AuditLogView title="Compliance" icon={ICON} subheader={subheader} />;
  }

  return (
    <EditorShell title="Compliance" icon={ICON} subheader={subheader} flush>
      {/* Flush so the body has a height: an empty queue centres in the space
          left under the tiles instead of sitting just below them. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex min-h-full max-w-8xl flex-col px-3 py-4 md:px-6 md:py-6 lg:py-8">
          {tenantId ? (
            <PrivacyRequestsPanel tenantId={tenantId} />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No workspace selected"
              description="Choose a workspace to review privacy requests."
              className="flex-1"
            />
          )}
        </div>
      </div>
    </EditorShell>
  );
}
