import { redirect } from 'next/navigation';

/**
 * Automations moved into Communications as a tab. Old links keep working:
 * `?automation=` opens the same workflow, and the old Runs tab (`?tab=runs`)
 * becomes the tab's Runs view. Communications' own layout guards the page.
 */
export default async function AutomationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams({ tab: 'automations' });
  if (params.tab === 'runs') next.set('view', 'runs');
  if (typeof params.automation === 'string') next.set('automation', params.automation);
  redirect(`/communications?${next}`);
}
