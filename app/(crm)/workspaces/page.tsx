'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { LocationPanel } from '@/components/workspaces/LocationPanel';
import { TenantList } from '@/components/workspaces/TenantList';

export default function WorkspacesPage() {
  return (
    <PageLayout eyebrow="Organisation" title="Workspaces" sidebar={<LocationPanel />}>
      <TenantList />
    </PageLayout>
  );
}
