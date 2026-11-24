import { redirect } from 'next/navigation';

/**
 * The audit log moved into Compliance as a tab. Old links keep working, with
 * their filters (q, userId, resourceType, action, resourceId). Compliance's own
 * layout guards the page.
 */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'tab') continue;
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) next.append(key, item);
  }
  next.set('tab', 'audit-log');
  redirect(`/compliance?${next}`);
}
