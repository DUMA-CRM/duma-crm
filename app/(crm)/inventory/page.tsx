import { AlertsSidebar } from '@/components/inventory/AlertsSidebar';
import { InventoryPanel } from '@/components/inventory/InventoryPanel';
import { PageLayout } from '@/components/layout/PageLayout';

export default function InventoryPage() {
  return (
    <PageLayout eyebrow="Operations" title="Inventory" headerBorder={false} sidebar={<AlertsSidebar />} fullHeight>
      <InventoryPanel />
    </PageLayout>
  );
}
