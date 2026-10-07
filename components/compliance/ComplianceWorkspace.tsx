'use client';

import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { ShieldCheck } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';

import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The compliance queue — subject access and erasure requests, with their
 * statutory due dates.
 *
 * This used to be a tab on the customers page. It moved because it is not a way
 * of browsing customers: it is a workload with its own deadlines, worked through
 * by whoever owns compliance, and burying it behind a customer list made it easy
 * to forget a clock was running.
 */
export function ComplianceWorkspace() {
  const { tenantId } = useWorkspaceStore();

  return (
    <EditorShell title="Compliance" icon={<ShieldCheck size={20} aria-hidden="true" />} flush>
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
