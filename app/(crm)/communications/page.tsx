import { redirect } from 'next/navigation';

import CommunicationsPage from '@/components/communications/CommunicationsPage';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.tab === 'automations' || typeof params.automation === 'string') {
    const next = new URLSearchParams();
    if (typeof params.automation === 'string') next.set('automation', params.automation);
    redirect(`/automation${next.size ? `?${next}` : ''}`);
  }
  return <CommunicationsPage />;
}
