import { PageLayout } from '@/components/layout/PageLayout';
import { InventoryPanel } from '@/components/inventory/InventoryPanel';
import { AlertsSidebar } from '@/components/inventory/AlertsSidebar';

export default function InventoryPage() {
  return (
    <PageLayout eyebrow="Operations" title="Inventory" headerBorder={false} sidebar={<AlertsSidebar />} fullHeight>
      <InventoryPanel />
    </PageLayout>
  );
}
