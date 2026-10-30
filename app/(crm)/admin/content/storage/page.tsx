import { redirect } from 'next/navigation';

export default async function LegacyAdminStoragePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  redirect(`/admin/settings/connectors?connector=media-storage${mode === 'connect' ? '&mode=connect' : ''}`);
}
