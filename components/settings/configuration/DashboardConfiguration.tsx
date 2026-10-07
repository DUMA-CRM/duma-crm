'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { PersonalDashboardControls, visibleDashboardKeys } from '@/components/dashboard/PersonalDashboardControls';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { FramedRows, SectionSkeleton, TileSkeleton } from '@/components/shared/TileSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';

import { type ResolvedDashboardLayout, getResolvedDashboardLayout } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConfigurationHeader } from './shared';

export function DashboardConfiguration() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const dashboard = useQuery({
    queryKey: moduleQueryKeys.organization.key('dashboard-layout', 'resolved', tenantId),
    queryFn: () => getResolvedDashboardLayout(tenantId),
    enabled: Boolean(tenantId),
  });

  return (
    <div className="space-y-5">
      <ConfigurationHeader
        title="Dashboard"
        description="Choose what appears on your dashboard and put the most useful panels first."
        storageLabel="Saved to your account"
      />

      {!tenantId && (
        <SettingsSection>
          <p className="py-10 text-center text-sm text-muted-foreground">Select a workspace to customise its dashboard.</p>
        </SettingsSection>
      )}
      {tenantId && dashboard.isLoading && (
        // The editor's shape: the panel list on the left, the preview beside it.
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading dashboard settings"
          className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"
        >
          <SectionSkeleton>
            <TileSkeleton tile="size-10" className="rounded-md border-rule/60 bg-page px-3" />
            <FramedRows rows={6} />
          </SectionSkeleton>
          <SectionSkeleton>
            <Bone className="aspect-[16/10] w-full rounded-lg" />
          </SectionSkeleton>
        </div>
      )}
      {tenantId && dashboard.isError && (
        <SettingsSection>
          <ErrorState
            title="Dashboard settings could not load"
            description="Check your connection and try again."
            onRetry={() => void dashboard.refetch()}
            className="py-10"
          />
        </SettingsSection>
      )}
      {dashboard.data && (
        <DashboardEditor
          key={`${dashboard.data.source}:${dashboard.data.layoutId ?? 'system'}:${dashboard.data.version}`}
          layout={dashboard.data}
        />
      )}
    </div>
  );
}

function DashboardEditor({ layout }: { layout: ResolvedDashboardLayout }) {
  const [previewKeys, setPreviewKeys] = useState(() => visibleDashboardKeys(layout));

  return (
    <SettingsTabBody stickyAside aside={<DashboardPreview panelKeys={previewKeys} />}>
      <PersonalDashboardControls layout={layout} onPreviewChange={setPreviewKeys} />
    </SettingsTabBody>
  );
}

function DashboardPreview({ panelKeys }: { panelKeys: string[] }) {
  const lowerPanelCount = panelKeys.filter((key) => key === 'analytics.orders-hourly' || key === 'analytics.top-items').length;

  return (
    <SettingsSection title="Preview" description="Your dashboard after saving.">
      <div aria-hidden="true" className="overflow-hidden rounded-lg border border-rule/60 bg-background">
        {panelKeys.length === 0 ? (
          <div className="flex aspect-[16/10] items-center justify-center px-6 text-center text-xs text-muted-foreground">
            Choose at least one panel to build your dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 p-2.5">
            {panelKeys.map((key) => {
              if (key === 'analytics.exceptions') {
                return (
                  <div key={key} className="col-span-4 flex items-center gap-2 rounded-md border border-rule/55 bg-card px-2.5 py-2">
                    <span className="size-2.5 rounded-full border border-momentum/70" />
                    <span className="h-1.5 w-20 rounded-full bg-foreground/20" />
                    <span className="h-1.5 min-w-0 flex-1 rounded-full bg-foreground/8" />
                  </div>
                );
              }
              if (key === 'analytics.trading')
                return (
                  <div key={key} className={panelKeys.includes('analytics.live') ? 'col-span-3' : 'col-span-4'}>
                    <TradingPreview />
                  </div>
                );
              if (key === 'analytics.live')
                return (
                  <div key={key} className={panelKeys.includes('analytics.trading') ? 'col-span-1' : 'col-span-4'}>
                    <LivePreview />
                  </div>
                );
              if (key === 'analytics.kpis')
                return (
                  <div key={key} className="col-span-4">
                    <KpiPreview />
                  </div>
                );
              if (key === 'analytics.orders-hourly' || key === 'analytics.top-items') {
                return (
                  <div key={key} className={lowerPanelCount === 2 ? 'col-span-2' : 'col-span-4'}>
                    <LowerPanelPreview kind={key === 'analytics.orders-hourly' ? 'chart' : 'list'} />
                  </div>
                );
              }
              return <div key={key} className="col-span-4 h-16 rounded-md border border-rule/55 bg-card" />;
            })}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The preview follows your visibility and order changes. Changes save automatically.
      </p>
    </SettingsSection>
  );
}

function TradingPreview() {
  return (
    <div className="min-w-0 rounded-md border border-rule/55 bg-card p-2.5">
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
    <div className="rounded-md border border-rule/55 bg-band/45 p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
        <span className="h-1 w-6 rounded-full bg-foreground/10" />
      </div>
      <div className="mt-2 space-y-1">
        {[68, 54, 73, 46].map((width) => (
          <div key={width} className="flex items-center justify-between rounded-sm bg-card px-2 py-2 shadow-sm">
            <span className="h-1 rounded-full bg-foreground/15" style={{ width: `${width}%` }} />
            <span className="size-1 rounded-full bg-foreground/15" />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-rule/45 pt-2">
        <span className="size-2 rounded-full bg-momentum/40" />
        <span className="h-1 w-12 rounded-full bg-foreground/12" />
      </div>
    </div>
  );
}

function KpiPreview() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {['bg-reference/55', 'bg-muted-foreground/45', 'bg-momentum/55', 'bg-muted-foreground/45'].map((tone, index) => (
        <div key={index} className="min-w-0 rounded-md border border-rule/55 bg-card p-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`size-3.5 shrink-0 rounded-sm ${tone}`} />
            <span className="h-1 min-w-0 flex-1 rounded-full bg-foreground/15" />
          </div>
          <div className="mt-2 h-2.5 w-9 rounded-sm bg-foreground/20" />
          <div className="mt-1.5 h-1 w-4/5 rounded-full bg-foreground/8" />
        </div>
      ))}
    </div>
  );
}

function LowerPanelPreview({ kind }: { kind: 'chart' | 'list' }) {
  return (
    <div className="rounded-md border border-rule/55 bg-card p-2.5">
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
