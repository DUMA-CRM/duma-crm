import { PageLayout } from '@/components/layout/PageLayout';
import { LocationPricingTab } from '@/components/menu/LocationPricingTab';

export default function LocationPricingPage() {
  return (
    <PageLayout eyebrow="Catalogue" title="Location Pricing" headerBorder={false}>
      <LocationPricingTab />
    </PageLayout>
  );
}
