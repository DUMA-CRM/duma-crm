import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { PublisherDashboard } from '@/components/marketplace/PublisherDashboard';
import { getSession } from '@/lib/modules/identity/client';

export default async function PublisherPage() {
  const session = await getSession((await headers()).get('cookie') ?? '');
  if (!session) redirect('/sign-in?next=%2Fapp-publisher');
  return <PublisherDashboard />;
}
