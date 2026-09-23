'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardLaunchBoard } from '@/components/dashboard/DashboardLaunchBoard';
import { MyDashboard } from '@/components/dashboard/MyDashboard';
import { TodayDashboard } from '@/components/dashboard/TodayDashboard';
import { AlertTriangle, LayoutDashboard, Loader2 } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import type { StaffRole } from '@/lib/api/staff.service';
import { getResolvedDashboardLayout } from '@/lib/api/workspace-composition.service';
import { ANALYTICS_WIDGET_KEYS, LAUNCH_WIDGET_KEYS } from '@/lib/dashboard/widget-registry';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function ResolvedDashboard({ role }: { role: StaffRole }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const layout = useQuery({
    queryKey: ['dashboard-layout', 'resolved', tenantId],
    queryFn: () => getResolvedDashboardLayout(tenantId),
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return (
      <EditorShell title="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}>
        <p className="py-16 text-center text-sm text-muted-foreground">Select a workspace to see its dashboard.</p>
      </EditorShell>
    );
  }

  if (layout.isLoading) {
    return (
      <EditorShell title="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}>
        <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Preparing your workspace…
        </div>
      </EditorShell>
    );
  }

  if (layout.isError) {
    return (
      <EditorShell title="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}>
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center" role="alert">
          <AlertTriangle size={22} className="text-exception" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Your dashboard could not be prepared</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your connection, then try again.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void layout.refetch()}>
            Try again
          </Button>
        </div>
      </EditorShell>
    );
  }

  const widgetKeys = layout.data?.widgets.map((widget) => widget.widgetKey) ?? [];
  const analyticsKeys = widgetKeys.filter((key) => ANALYTICS_WIDGET_KEYS.has(key));
  const launchKeys = widgetKeys.filter((key) => LAUNCH_WIDGET_KEYS.has(key));
  const launchBoard = <DashboardLaunchBoard widgetKeys={launchKeys} />;

  if (analyticsKeys.length > 0) return <TodayDashboard role={role} widgetKeys={analyticsKeys} supplemental={launchBoard} />;
  if (widgetKeys.includes('workforce.my-day')) return <MyDashboard supplemental={launchBoard} />;

  return (
    <EditorShell title="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}>
      {launchKeys.length > 0 ? (
        <DashboardLaunchBoard widgetKeys={launchKeys} />
      ) : (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-foreground">There are no workspace panels available yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">As modules and access are enabled, the relevant tools will appear here.</p>
        </div>
      )}
    </EditorShell>
  );
}
