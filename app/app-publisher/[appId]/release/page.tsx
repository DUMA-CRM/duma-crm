import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { PublisherReleaseEditor } from '@/components/marketplace/ReleaseForm';
import { getSession } from '@/lib/modules/identity/client';

export default async function ReleaseEditorPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(appId)) notFound();
  const session = await getSession((await headers()).get('cookie') ?? '');
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/app-publisher/${appId}/release`)}`);
  return <PublisherReleaseEditor appId={appId} />;
}
