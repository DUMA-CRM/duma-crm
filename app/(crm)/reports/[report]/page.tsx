import { redirect } from 'next/navigation';

import { ReportView } from '@/components/reports/ReportView';

import { hasAnyCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { LEGACY_REPORT_PATHS, findReport } from '@/lib/reports/catalogue';

/**
 * Every report, by id from the catalogue. Old paths (`/reports/revenue`,
 * `/reports/top-items`, `/reports/compare`…) redirect to the report that
 * replaced them, keeping the query, so links and bookmarks still land.
 */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { report: id } = await params;
  const query = new URLSearchParams(
    Object.entries(await searchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((entry) => [key, entry]) : value ? [[key, value]] : [],
    ),
  ).toString();

  if (id in LEGACY_REPORT_PATHS) {
    const target = LEGACY_REPORT_PATHS[id];
    redirect(`${target ? `/reports/${target}` : '/reports'}${query ? `?${query}` : ''}`);
  }

  const report = findReport(id);
  if (!report) redirect('/reports');

  const profile = await getCurrentStaffProfile();
  if (!profile || !hasAnyCapability(profile, ...report.anyOf)) redirect('/reports');

  return <ReportView id={report.id} />;
}
