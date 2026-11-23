import { AppDetails } from '@/components/marketplace/AppDetails';

export default async function AppAboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AppDetails slug={slug} />;
}
