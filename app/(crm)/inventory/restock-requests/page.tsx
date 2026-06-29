import { PageLayout } from '@/components/layout/PageLayout';
import { RestockRequestForm } from '@/components/inventory/RestockRequestForm';
import { RestockRequestsSidebar } from '@/components/inventory/RestockRequestsSidebar';

export default function RestockRequestPage() {
  return (
    <PageLayout
      eyebrow="Operations"
      title="Restock Requests"
      headerBorder={false}
      sidebar={<RestockRequestsSidebar />}
    >
      <RestockRequestForm />
    </PageLayout>
  );
}
