'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { TenantList } from '@/components/workspaces/TenantList';
import { LocationPanel } from '@/components/workspaces/LocationPanel';

export default function WorkspacesPage() {
  return (
    <PageLayout eyebrow="Organisation" title="Workspaces" sidebar={<LocationPanel />}>
      <TenantList />
    </PageLayout>
  );
}
