import { redirect } from 'next/navigation';

/**
 * My HR is part of My work. Every query parameter carries over — `tab` (the
 * old `requests` is Helpdesk now) and `action`, which Ask DUMA
 * links send.
 */
export default async function MyHrRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, entry);
  }
  const tab = params.get('tab');
  params.set('tab', !tab ? 'overview' : tab === 'requests' ? 'helpdesk' : tab);
  redirect(`/my-work?${params.toString()}`);
}
