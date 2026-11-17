'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PersonalDashboardControls, visibleDashboardKeys } from '@/components/dashboard/PersonalDashboardControls';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ErrorState } from '@/components/shared/ErrorState';

import { widgetDefinition } from '@/lib/dashboard/widget-registry';
import { type ResolvedDashboardLayout, getResolvedDashboardLayout } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { boardLayout } from '@/lib/utils/dashboard-flow';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConfigurationBodySkeleton, PreviewFrame } from './shared';

/**
 * Your own dashboard: which panels show and in what order, saved to your
 * account as you go. Laid out like Settings → Account — the view as rows, the
 * panels as a titled list — with the live board in the rail.
 */
export function DashboardConfiguration() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const dashboard = useQuery({
    queryKey: moduleQueryKeys.organization.key('dashboard-layout', 'resolved', tenantId),
    queryFn: () => getResolvedDashboardLayout(tenantId),
    enabled: Boolean(tenantId),
  });

  if (!tenantId) return <p className="text-sm text-muted-foreground">Select a workspace to customise its dashboard.</p>;
  if (dashboard.isLoading) return <ConfigurationBodySkeleton label="Loading dashboard settings" preview="aspect-[16/10]" />;
  if (dashboard.isError)
    return (
      <ErrorState
        title="Dashboard settings could not load"
        description="Check your connection and try again."
        onRetry={() => void dashboard.refetch()}
      />
    );
  if (!dashboard.data) return null;
  return (
    <DashboardEditor
      key={`${dashboard.data.source}:${dashboard.data.layoutId ?? 'system'}:${dashboard.data.version}`}
      layout={dashboard.data}
    />
  );
}

function DashboardEditor({ layout }: { layout: ResolvedDashboardLayout }) {
  const [previewKeys, setPreviewKeys] = useState(() => visibleDashboardKeys(layout));
  const widths = new Map(layout.availableWidgets.map((widget) => [widget.widgetKey, widget.width]));
  const panels = previewKeys.map((widgetKey) => ({ widgetKey, width: widths.get(widgetKey) ?? 6 }));

  return (
    <SettingsTabBody narrowAside stickyAside aside={<DashboardPreview panels={panels} />}>
      <PersonalDashboardControls layout={layout} onPreviewChange={setPreviewKeys} />
    </SettingsTabBody>
  );
}

/** The board in miniature, laid out by the same rule: full-width panels first, then the two-column bento. */
function DashboardPreview({ panels }: { panels: Array<{ widgetKey: string; width: number }> }) {
  const board = boardLayout(panels, 2);

  return (
    <PreviewFrame>
      <div aria-hidden="true" className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        {panels.length === 0 ? (
          <div className="flex aspect-[16/10] items-center justify-center px-6 text-center text-xs text-muted-foreground">
            Choose at least one panel to build your dashboard.
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-2.5">
            {board.full.map((panel) => (
              <PanelPreview key={panel.widgetKey} widgetKey={panel.widgetKey} />
            ))}
            {board.columns.some((column) => column.length > 0) && (
              <div className="grid grid-cols-2 items-start gap-2">
                {board.columns.map((column, index) => (
                  <div key={index} className="flex min-w-0 flex-col gap-2">
                    {column.map((panel) => (
                      <PanelPreview key={panel.widgetKey} widgetKey={panel.widgetKey} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PreviewFrame>
  );
}

function PanelPreview({ widgetKey }: { widgetKey: string }) {
  if (widgetKey === 'analytics.exceptions') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
        <span className="size-2.5 rounded-sm bg-exception/30" />
        <span className="h-1.5 w-20 rounded-full bg-foreground/20" />
        <span className="h-1.5 min-w-0 flex-1 rounded-full bg-foreground/8" />
      </div>
    );
  }
  if (widgetKey === 'analytics.kpis') return <KpiPreview />;
  if (widgetKey === 'analytics.trading') return <TradingPreview />;
  if (widgetKey === 'analytics.live') return <LivePreview />;
  if (widgetKey === 'analytics.orders-hourly') return <LowerPanelPreview kind="chart" />;
  if (widgetKey === 'analytics.top-items') return <LowerPanelPreview kind="list" />;
  // A module card or a launch card, as on the board; "My workday" is the tallest.
  return (
    <div
      className={`${widgetKey === 'workforce.my-day' ? 'h-20' : 'h-14'} flex flex-col justify-center gap-1.5 rounded-md border border-border bg-card px-2.5`}
    >
      <span className="truncate text-[0.625rem] font-semibold text-muted-foreground">
        {widgetDefinition(widgetKey)?.label ?? widgetKey}
      </span>
      <span className="h-1.5 w-3/4 rounded-full bg-foreground/10" />
      <span className="h-1.5 w-1/2 rounded-full bg-foreground/8" />
    </div>
  );
}

function TradingPreview() {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          <div className="h-1.5 w-16 rounded-full bg-foreground/20" />
          <div className="h-1 w-24 rounded-full bg-foreground/10" />
        </div>
        <div className="h-1.5 w-10 rounded-full bg-foreground/10" />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="h-3 w-9 rounded-sm bg-foreground/25" />
        <span className="h-1 w-14 rounded-full bg-foreground/10" />
      </div>
      <div className="mt-4 space-y-3">
        <span className="block border-t border-dashed border-rule/45" />
        <span className="block border-t border-dashed border-rule/45" />
        <span className="block border-t border-dashed border-rule/45" />
      </div>
      <div className="mt-3 flex justify-between">
        {[8, 10, 9, 8].map((width, index) => (
          <span key={index} className="h-1 rounded-full bg-foreground/10" style={{ width }} />
        ))}
      </div>
    </div>
  );
}

function LivePreview() {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
        <span className="h-1 w-6 rounded-full bg-foreground/10" />
      </div>
      <div className="mt-2 space-y-1">
        {[68, 54, 73, 46].map((width) => (
          <div key={width} className="flex items-center justify-between px-0.5 py-1.5">
            <span className="h-1 rounded-full bg-foreground/15" style={{ width: `${width}%` }} />
            <span className="size-1 rounded-full bg-foreground/15" />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-momentum/40" />
        <span className="h-1 w-12 rounded-full bg-foreground/12" />
      </div>
    </div>
  );
}

function KpiPreview() {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="min-w-0 rounded-md border border-border bg-card p-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="size-3.5 shrink-0 rounded-sm bg-primary/20" />
            <span className="h-1 min-w-0 flex-1 rounded-full bg-foreground/15" />
          </div>
          <div className="mt-2 h-2.5 w-3/4 rounded-sm bg-foreground/20" />
          <div className="mt-1.5 h-1 w-4/5 rounded-full bg-foreground/8" />
        </div>
      ))}
    </div>
  );
}

function LowerPanelPreview({ kind }: { kind: 'chart' | 'list' }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="h-1.5 w-16 rounded-full bg-foreground/20" />
      <div className="mt-1.5 h-1 w-10 rounded-full bg-foreground/10" />
      <div
        className={
          kind === 'chart' ? 'mt-3 flex min-h-12 items-end justify-center gap-1.5' : 'mt-3 flex min-h-12 flex-col justify-center gap-2'
        }
      >
        {kind === 'chart'
          ? [30, 55, 42, 68, 48, 74].map((height, index) => (
              <span key={index} className="w-2 rounded-sm bg-reference/25" style={{ height: `${height}%` }} />
            ))
          : [72, 54, 64].map((width) => <span key={width} className="h-1 rounded-full bg-foreground/10" style={{ width: `${width}%` }} />)}
      </div>
    </div>
  );
}
