'use client';

import { useQuery } from '@tanstack/react-query';
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
import { AlertTriangle, LayoutDashboard } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { ANALYTICS_WIDGET_KEYS } from '@/lib/dashboard/widget-registry';
import { useMinWidth } from '@/lib/hooks/useMinWidth';
import type { StaffRole } from '@/lib/modules/identity/client';
import { getResolvedDashboardLayout } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { dealColumns, flowSegments } from '@/lib/utils/dashboard-flow';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* The dashboard builds itself. The API resolves which widgets this viewer gets
 * — their role's template, then any saved arrangement — keeping only widgets
 * whose module is enabled and whose capability they hold. This page lays out
 * whatever comes back, in that order and at that width. So a workspace without
 * Workforce has no Team card and no labour figure; one without Analytics has
 * no trading panels and its module cards carry the page; and a new module's
 * card appears here once it is registered, with no change to this file's flow.
 */

/** Static classes for each placement width — Tailwind can't see a computed `lg:col-span-${n}`. */
const SPAN: Record<number, string> = {
  3: 'lg:col-span-6 xl:col-span-3',
  4: 'lg:col-span-4',
  6: 'lg:col-span-12 xl:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

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

export function ResolvedDashboard({ role }: { role: StaffRole }) {
  // Half-width cards sit side by side from `xl` — the breakpoint their old `xl:col-span-6` used.
  const twoColumns = useMinWidth(1280);
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center" role="alert">
          <AlertTriangle size={22} className="text-exception" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">Your dashboard could not be prepared</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your connection, then try again.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void layout.refetch()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  const placements = layout.data?.widgets ?? [];
  const keys = placements.map((widget) => widget.widgetKey);
  const trading = keys.filter((key) => ANALYTICS_WIDGET_KEYS.has(key));
  const firstTrading = trading[0];
  const isOwner = role === 'franchise_owner' || role === 'super_admin';

  const render = (placement: (typeof placements)[number]) => {
    const key = placement.widgetKey;
    const content = ANALYTICS_WIDGET_KEYS.has(key) ? (
      <TodayWidget widgetKey={key} first={key === firstTrading} />
    ) : key === 'workforce.my-day' ? (
      <MyDashboard />
    ) : isLaunchWidget(key) ? (
      <LaunchCard widgetKey={key} />
    ) : (
      MODULE_CARDS[key]?.()
    );
    return content ? { key, content } : null;
  };

  // A gallery, not a table: every card is as tall as its content. Wide placements stay rows;
  // runs of half-width cards stack in two columns of their own, dealt left, right, left.
  const grid = (
    <div className="space-y-4">
      {flowSegments(placements).map((segment, index) => {
        const cards = segment.items.flatMap((placement) => {
          const card = render(placement);
          return card ? [{ ...card, width: placement.width }] : [];
        });
        if (cards.length === 0) return null;
        if (segment.kind === 'columns') {
          return (
            <div key={`columns-${index}`} className="flex items-start gap-4">
              {dealColumns(cards, twoColumns ? 2 : 1).map((column, columnIndex) => (
                <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
                  {column.map((card) => (
                    // empty:hidden: a widget with nothing to say takes no space and no gap.
                    <div key={card.key} className="min-w-0 empty:hidden">
                      {card.content}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={`row-${index}`} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            {cards.map((card) => (
              <div key={card.key} className={`min-w-0 empty:hidden ${SPAN[card.width] ?? SPAN[12]}`}>
                {card.content}
              </div>
            ))}
          </div>
        );
      })}
    </div>
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
        <div className="space-y-4">
          <TodayBanners canCompare={isOwner} />
          {grid}
        </div>
      </Shell>
    </TodayProvider>
  );
}
