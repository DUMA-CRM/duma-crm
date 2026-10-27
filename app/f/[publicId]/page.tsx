import type { Metadata } from 'next';

import { PublicFormPage } from '@/components/forms/PublicFormPage';

export const metadata: Metadata = {
  title: 'Form — DUMA',
  robots: { index: false, follow: false },
};

/** A published form, on DUMA's own page — linked, QR-coded or framed into a website (`?embed=1`). */
export default async function HostedFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { publicId } = await params;
  const { embed } = await searchParams;
  return <PublicFormPage publicId={publicId} embedded={embed === '1'} />;
}
