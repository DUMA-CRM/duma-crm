'use client';

import { ShieldCheck } from 'lucide-react';

import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export default function PrivacyRequestsPage() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  return (
    <PageLayout eyebrow="Customer management" title="Privacy requests">
      {!tenantId ? <EmptyState icon={ShieldCheck} title="No workspace selected" description="Choose a workspace to review privacy requests." /> : <PrivacyRequestsPanel tenantId={tenantId} />}
    </PageLayout>
  );
}
