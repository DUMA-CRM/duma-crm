import { notFound } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api/client';

export const metadata = { robots: { index: false, follow: false } };

export default async function AppInformationPage({ params, searchParams }: {
  params: Promise<{ slug: string; kind: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const [{ slug, kind }, { version }] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 64
    || (kind !== 'support' && kind !== 'privacy')
    || (version !== undefined && (typeof version !== 'string' || version.length > 32 || !/^\d+\.\d+\.\d+$/.test(version)))) notFound();

  const query = version ? `?version=${encodeURIComponent(version)}` : '';
  const document = await apiFetch<{ name: string; publisher: string; text: string }>(
    `/marketplace/documents/${slug}/${kind}${query}`, { cache: 'no-store' },
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <header className="mb-8 border-b border-border pb-6">
        <p className="mb-2 break-words text-sm text-muted-foreground">{document.name} · {document.publisher}</p>
        <h1 className="text-4xl font-semibold tracking-tight text-heading">{kind === 'support' ? 'Support' : 'Privacy policy'}</h1>
      </header>
      <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">{document.text}</div>
    </main>
  );
}
