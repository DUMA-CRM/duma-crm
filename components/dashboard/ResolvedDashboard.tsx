'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import {
  ContentCard,
  CustomersCard,
  LaunchCard,
  PurchasingCard,
  StockHealthCard,
  TeamTodayCard,
  TendersCard,
  isLaunchWidget,
} from '@/components/dashboard/ModuleCards';
import { MyDashboard } from '@/components/dashboard/MyDashboard';
import { TodayBanners, TodayMeta, TodayProvider, TodayWidget } from '@/components/dashboard/today';
import { LayoutDashboard } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';

import { ANALYTICS_WIDGET_KEYS } from '@/lib/dashboard/widget-registry';
import { useMinWidth } from '@/lib/hooks/useMinWidth';
import { getResolvedDashboardLayout } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { boardLayout } from '@/lib/utils/dashboard-flow';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* The dashboard builds itself. The API resolves which widgets this viewer gets
 * — their role's template, then any saved arrangement — keeping only widgets
 * whose module is enabled and whose capability they hold. This page lays out
 * whatever comes back: full-width widgets first, in order, then the rest as a
 * two-column bento (lib/utils/dashboard-flow). So a workspace without
 * Workforce has no Team card and no labour figure; one without Analytics has
 * no trading panels and its module cards carry the page; and a new module's
 * card appears here once it is registered, with no change to this file's flow.
 */

/** Module cards by widget key. A key with no renderer here is skipped, never a crash. */
const MODULE_CARDS: Record<string, () => ReactNode> = {
  'inventory.stock-health': () => <StockHealthCard />,
  'workforce.team-today': () => <TeamTodayCard />,
  'purchasing.overview': () => <PurchasingCard />,
  'payments.tenders': () => <TendersCard />,
  'customers.overview': () => <CustomersCard />,
  'cms.content': () => <ContentCard />,
};

function Shell({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <EditorShell title="Today" icon={<LayoutDashboard size={20} aria-hidden="true" />} meta={meta}>
      {children}
    </EditorShell>
  );
}

export function ResolvedDashboard() {
  // The bento's two columns open at `xl`; below it the saved order runs in one.
  const twoColumns = useMinWidth(1280);
  const reduceMotion = useReducedMotion();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const layout = useQuery({
    queryKey: moduleQueryKeys.organization.key('dashboard-layout', 'resolved', tenantId),
    queryFn: () => getResolvedDashboardLayout(tenantId),
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return (
      <Shell>
        <p className="py-16 text-center text-sm text-muted-foreground">Select a workspace to see its dashboard.</p>
      </Shell>
    );
  }

  if (layout.isLoading) {
    return (
      <Shell>
        <LoadingState label="Preparing your dashboard" className="flex-1" />
      </Shell>
    );
  }

  if (layout.isError) {
    return (
      <Shell>
        <ErrorState className="flex-1" title="Your dashboard couldn’t be prepared" onRetry={() => void layout.refetch()} />
      </Shell>
    );
  }

  const placements = layout.data?.widgets ?? [];
  const keys = placements.map((widget) => widget.widgetKey);
  const trading = keys.filter((key) => ANALYTICS_WIDGET_KEYS.has(key));
  const firstTrading = trading[0];

  const kpisOnBoard = keys.includes('analytics.kpis');
  const render = (placement: (typeof placements)[number]) => {
    const key = placement.widgetKey;
    const content = ANALYTICS_WIDGET_KEYS.has(key) ? (
      <TodayWidget widgetKey={key} first={key === firstTrading} kpisOnBoard={kpisOnBoard} />
    ) : key === 'workforce.my-day' ? (
      <MyDashboard />
    ) : isLaunchWidget(key) ? (
      <LaunchCard widgetKey={key} />
    ) : (
      MODULE_CARDS[key]?.()
    );
    // empty:hidden: a widget with nothing to say takes no space and no gap.
    return content ? (
      <div key={key} className="min-w-0 empty:hidden">
        {content}
      </div>
    ) : null;
  };

  // Full-width widgets lead (what needs you, then the day's figures); everything else is a bento of
  // two stacked columns, each card in the shorter one, so a short card never leaves a hole.
  const board = boardLayout(placements, twoColumns ? 2 : 1);
  const grid = (
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {board.full.map(render)}
      {board.columns.some((column) => column.length > 0) && (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {board.columns.map((column, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-5">
              {column.map(render)}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );

  if (placements.length === 0) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-semibold text-foreground">Nothing to show here yet</p>
          <p className="mt-1 max-w-[48ch] text-xs leading-relaxed text-muted-foreground">
            The dashboard fills in with the modules this workspace uses — switch them on in Settings → Modules.
          </p>
        </div>
      </Shell>
    );
  }

  // "My workday" opens with its own greeting; a page title above it would say the same thing twice.
  if (keys.includes('workforce.my-day') && trading.length === 0) return grid;

  if (trading.length === 0) return <Shell>{grid}</Shell>;

  // The trading panels share one read of today, mounted only when at least one is on the board.
  return (
    <TodayProvider>
      <Shell meta={<TodayMeta chartShowsNow={keys.includes('analytics.trading')} />}>
        <div className="flex flex-col gap-5">
          <TodayBanners />
          {grid}
        </div>
      </Shell>
    </TodayProvider>
  );
}
