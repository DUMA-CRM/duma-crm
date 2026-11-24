'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { type CSSProperties, type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, ChevronLeft, ImageIcon, LayoutDashboard, Plus, RotateCcw } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { LoadingState } from '@/components/shared/Skeleton';
import { BOARD_COLUMNS, WidgetGrid, boardMetrics, cellPixels, familyName } from '@/components/shared/widget-grid/WidgetGrid';
import { WidgetCellContext } from '@/components/shared/widget-grid/cell';
import { useGridEditor } from '@/components/shared/widget-grid/useGridEditor';
import gridStyles from '@/components/shared/widget-grid/widget-grid.module.css';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasCapability } from '@/lib/auth/capabilities';
import { DASHBOARD_WALLPAPERS, dashboardWallpaper } from '@/lib/dashboard/wallpapers';
import { ANALYTICS_WIDGET_KEYS, widgetDefinition } from '@/lib/dashboard/widget-registry';
import {
  type DashboardWidgetPlacement,
  type ResolvedDashboardLayout,
  getResolvedDashboardLayout,
  publishDashboardLayout,
  publishPersonalDashboardLayout,
  resetPersonalDashboardLayout,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type Cell, type GridSize, compact, normalize } from '@/lib/utils/widget-grid';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import {
  ContentCard,
  CustomersCard,
  LaunchCard,
  PurchasingCard,
  BookingsTodayCard,
  StockHealthCard,
  TeamTodayCard,
  TendersCard,
  isLaunchWidget,
} from './ModuleCards';
import { ClockWidget, MediaPhotoWidget, NaturePhotoWidget, PinnedNotesWidget } from './AmbientWidgets';
import { FormResponsesCard, PromotionsCard, SocialPostsCard } from './cards/EngagementCards';
import { HelpdeskCard, PrivacyRequestsCard, TimeOffCard } from './cards/PeopleCards';
import { BookingsWeekCard, MenuHealthCard, ReportShortcutsCard, WeekSalesCard } from './cards/TradingCards';
import { WebOnlineCard, WebPagesCard, WebSourcesCard, WebTodayCard, WebVisitsCard } from './cards/WebsiteCards';
import { MyDashboard } from './MyDashboard';
import { NeedsYouStrip, TodayBanners, TodayMeta, TodayProvider, TodayWidget } from './today';

/* The dashboard builds itself. The API resolves which widgets this viewer gets
 * — their role's template, then any saved arrangement — keeping only widgets
 * whose module is enabled and whose capability they hold. This page draws
 * them on a four-tile grid where they were placed, and `?edit=1` (the avatar
 * menu's "Edit dashboard") arranges it in place: drag, resize by the corner,
 * remove, add from a gallery of the real widgets, then Done.
 */

/** Module cards by widget key. A key with no renderer here is skipped, never a crash. */
const MODULE_CARDS: Record<string, ComponentType> = {
  'inventory.stock-health': StockHealthCard,
  'workforce.team-today': TeamTodayCard,
  'purchasing.overview': PurchasingCard,
  'payments.tenders': TendersCard,
  'customers.overview': CustomersCard,
  'reservations.today': BookingsTodayCard,
  'cms.content': ContentCard,
  'organization.clock': ClockWidget,
  'organization.nature': NaturePhotoWidget,
  'cms.photo': MediaPhotoWidget,
  'notes.pinned': PinnedNotesWidget,
  'analytics.week-sales': WeekSalesCard,
  'analytics.reports-shortcuts': ReportShortcutsCard,
  'analytics.web-online': WebOnlineCard,
  'analytics.web-today': WebTodayCard,
  'analytics.web-visits': WebVisitsCard,
  'analytics.web-pages': WebPagesCard,
  'analytics.web-sources': WebSourcesCard,
  'reservations.week': BookingsWeekCard,
  'catalog.menu-health': MenuHealthCard,
  'promotions.active': PromotionsCard,
  'forms.responses': FormResponsesCard,
  'marketing.scheduled': SocialPostsCard,
  'people.time-off': TimeOffCard,
  'support.helpdesk': HelpdeskCard,
  'compliance.privacy': PrivacyRequestsCard,
};

/** Analytics widgets drawn from today's shared trading read — the rest fetch their own data. */
const TODAY_WIDGET_KEYS = new Set([...ANALYTICS_WIDGET_KEYS].filter((key) => !(key in MODULE_CARDS)));

const layoutKey = (tenantId: string | null) => moduleQueryKeys.organization.key('dashboard-layout', 'resolved', tenantId);

function Shell({ children, meta, dirty, wallpaper }: { children: ReactNode; meta?: ReactNode; dirty?: boolean; wallpaper?: string | null }) {
  const src = dashboardWallpaper(wallpaper ?? null)?.src;
  return (
    <EditorShell
      title="Today"
      icon={<LayoutDashboard size={20} aria-hidden="true" />}
      meta={meta}
      dirty={dirty}
      bodyClassName="md:px-4"
      backdrop={
        src && (
          // Dark mode lays the page's ground over the gradient, so its cream top doesn't glare.
          <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${src})` }}>
            <div className="size-full dark:bg-background/80" />
          </div>
        )
      }
    >
      {children}
    </EditorShell>
  );
}

export function ResolvedDashboard() {
  const editing = useSearchParams().get('edit') === '1';
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const query = useQuery({
    queryKey: layoutKey(tenantId),
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
  if (query.data) return <DashboardBoard key={`${tenantId}:${editing}`} data={query.data} editing={editing} />;
  if (query.isError) {
    return (
      <Shell>
        <ErrorState className="flex-1" title="Your dashboard couldn’t be prepared" onRetry={() => void query.refetch()} />
      </Shell>
    );
  }
  return (
    <Shell>
      <LoadingState label="Preparing your dashboard" className="flex-1" />
    </Shell>
  );
}

const NEEDS_YOU = 'analytics.exceptions';

function declaredSizes(widget: DashboardWidgetPlacement): GridSize[] {
  return widget.definition?.sizes?.map(({ width, height }) => ({ w: width, h: height })) ?? [{ w: widget.width, h: widget.height }];
}

function DashboardBoard({ data, editing }: { data: ResolvedDashboardLayout; editing: boolean }) {
  const queryClient = useQueryClient();
  const canSaveTeam = useAuthStore((state) => hasCapability(state.capabilities, 'tenants:write'));
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const columns = boardWidth === null ? null : boardMetrics(boardWidth).columns;
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saveMenu, setSaveMenu] = useState(false);
  // Saved with the layout: the personal layer's if there is one, else the team's.
  const savedWallpaper = data.wallpaper ?? null;
  // Picked in edit mode, shown at once, kept on Done and dropped on Cancel like the layout.
  const [wallpaper, setWallpaperDraft] = useState(savedWallpaper);
  const available = useMemo(
    () => new Map(data.availableWidgets.filter(({ widgetKey }) => widgetDefinition(widgetKey)).map((widget) => [widget.widgetKey, widget])),
    [data.availableWidgets],
  );
  const { saved, defaults } = useMemo(() => {
    const spec = { columns: BOARD_COLUMNS, sizes: (key: string) => (available.has(key) ? declaredSizes(available.get(key)!) : []) };
    const toCells = (placements: DashboardWidgetPlacement[]) =>
      normalize(
        placements.map((widget) => ({
          key: widget.widgetKey,
          x: widget.gridColumn,
          y: widget.gridRow,
          w: widget.width,
          h: widget.height,
        })),
        spec,
      );
    return { saved: toCells(data.widgets), defaults: toCells(data.defaultWidgets ?? data.availableWidgets) };
  }, [available, data]);
  const editor = useGridEditor(saved, defaults, data.source === 'personal', BOARD_COLUMNS);
  const cells = editing ? editor.cells : saved;
  const canEdit = editing && columns === BOARD_COLUMNS;
  const dirty = editing && editor.isDirty;
  const wallpaperChanged = editing && wallpaper !== savedWallpaper;
  const changed = dirty || wallpaperChanged;
  const displayed = canEdit ? cells : saved;
  const has = (key: string) => displayed.some((cell) => cell.key === key);
  // Needs you is a strip across the top of the page, never a cell: the grid packs without it.
  const board = compact(displayed.filter((cell) => cell.key !== NEEDS_YOU));
  // It still has a cell in the saved layout (the API stores every widget as one). A drag on the grid doesn't
  // see it, so it is put back under the rest, where it can't overlap anything the API would refuse.
  const keepNeedsYou = (next: Cell[]) => {
    const kept = cells.find((cell) => cell.key === NEEDS_YOU);
    if (!kept) return next;
    const bottom = next.reduce((end, cell) => Math.max(end, cell.y + cell.h), 1);
    return [...next, { ...kept, x: 1, y: bottom }];
  };
  const trading = displayed.some(({ key }) => TODAY_WIDGET_KEYS.has(key));
  // The trading widgets share one read of today. In edit mode it is mounted whenever any of them could be added,
  // so the gallery can draw them live and adding the first one doesn't remount the board around it.
  const today = trading || (editing && [...available.keys()].some((key) => TODAY_WIDGET_KEYS.has(key)));

  function closeEdit() {
    editor.cancel();
    setGalleryOpen(false);
    setSaveMenu(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState(null, '', url);
  }

  const save = useMutation({
    mutationFn: async (team: boolean) => {
      const placements = cells.map(({ key, x, y, w, h }) => ({
        widgetKey: key,
        gridColumn: x,
        gridRow: y,
        width: w,
        height: h,
      }));
      if (team) {
        await publishDashboardLayout(data.tenantId, data.audienceKey, 'Team dashboard', {
          clearPersonal: true,
          widgets: placements.map((placement) => {
            const widget = available.get(placement.widgetKey)!;
            const configuration =
              data.defaultWidgets?.find((item) => item.widgetKey === widget.widgetKey)?.configuration ?? widget.configuration;
            return { ...placement, moduleId: widget.moduleId, configuration };
          }),
          wallpaper,
        });
      } else if (editor.resetRequested && data.source === 'personal' && wallpaper === (data.defaultWallpaper ?? null)) {
        await resetPersonalDashboardLayout(data.tenantId);
      } else if (dirty || wallpaperChanged) {
        // A wallpaper of your own makes the layout your own too, as moving a widget does.
        await publishPersonalDashboardLayout(data.tenantId, placements, wallpaper);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: layoutKey(data.tenantId) });
      closeEdit();
    },
  });

  function cancel() {
    if (changed) setConfirmCancel(true);
    else closeEdit();
  }

  useEffect(() => {
    if (!changed && !save.isPending) return;
    const current = window.location.href;
    const mayLeave = () => (save.isPending ? false : window.confirm('Leave the dashboard and discard your unsaved changes?'));
    function onLink(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.download || (link.target && link.target !== '_self')) return;
      const destination = new URL(link.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname + destination.search === window.location.pathname + window.location.search
      )
        return;
      if (!mayLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    function onBack(event: PopStateEvent) {
      if (window.location.href === current || mayLeave()) return;
      event.stopImmediatePropagation();
      window.history.pushState(null, '', current);
    }
    document.addEventListener('click', onLink, true);
    window.addEventListener('popstate', onBack, true);
    return () => {
      document.removeEventListener('click', onLink, true);
      window.removeEventListener('popstate', onBack, true);
    };
  }, [changed, save.isPending]);

  const render = (key: string) => {
    const Card = MODULE_CARDS[key];
    if (Card) return <Card />;
    if (TODAY_WIDGET_KEYS.has(key)) return <TodayWidget widgetKey={key} netSalesOnBoard={has('analytics.net-sales')} />;
    if (key === 'workforce.my-day') return <MyDashboard />;
    if (isLaunchWidget(key)) return <LaunchCard widgetKey={key} />;
    return null;
  };
  const widgets = Object.fromEntries(
    [...available.values()].map((widget) => [
      widget.widgetKey,
      { label: widgetLabel(widget), sizes: declaredSizes(widget), render: () => render(widget.widgetKey) },
    ]),
  );

  const content = (
    <Shell meta={trading && <TodayMeta chartShowsNow={has('analytics.trading')} />} dirty={changed || save.isPending}
      wallpaper={editing ? wallpaper : savedWallpaper}
    >
      {/* The banners and controls line up with the board, which centres once its cells reach full size. */}
      <div
        className="mx-auto flex w-full min-w-0 flex-col gap-4"
        style={{ maxWidth: boardWidth === null ? undefined : boardMetrics(boardWidth).width }}
      >
        {trading && <TodayBanners />}
        {canEdit && (
          // The edit controls stay in reach over the board while you scroll.
          <div
            className="sticky top-2 z-30 flex items-center gap-2 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur-sm"
            role="group"
            aria-label="Edit dashboard"
          >
            <Button variant="outline" disabled={save.isPending} onClick={() => setGalleryOpen(true)}>
              <Plus aria-hidden="true" /> Add widget
            </Button>
            <WallpaperPicker value={wallpaper} onChange={setWallpaperDraft} disabled={save.isPending} />
            <Button
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                editor.reset();
                setWallpaperDraft(data.defaultWallpaper ?? null);
              }}
            >
              <RotateCcw aria-hidden="true" /> Reset
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" disabled={save.isPending} onClick={cancel}>
                Cancel
              </Button>
              <div className="flex items-center">
                <Button disabled={save.isPending} onClick={() => save.mutate(false)} className={canSaveTeam ? 'rounded-r-none' : undefined}>
                  {save.isPending ? 'Saving…' : 'Done'}
                </Button>
                {canSaveTeam && (
                  <Popover open={saveMenu} onOpenChange={setSaveMenu}>
                    <PopoverTrigger asChild>
                      <Button
                        size="icon"
                        disabled={save.isPending}
                        aria-label="More save options"
                        className="rounded-l-none border-l border-primary-foreground/25"
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setSaveMenu(false);
                          save.mutate(true);
                        }}
                      >
                        Save as team default
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          </div>
        )}
        {has(NEEDS_YOU) &&
          (canEdit ? (
            // Edit mode: the strip as a preview, outlined and with the same remove badge as the widgets.
            <div className="relative">
              <div inert className={gridStyles.editable}>
                <NeedsYouStrip preview />
              </div>
              <button
                type="button"
                className={cn(gridStyles.badge, 'top-0 left-0 -translate-x-[18px] -translate-y-[18px]')}
                aria-label="Remove Needs you"
                disabled={save.isPending}
                onClick={() => editor.remove(NEEDS_YOU)}
              >
                <span aria-hidden="true" />
              </button>
            </div>
          ) : (
            <NeedsYouStrip />
          ))}
        {editing && columns !== null && !canEdit && (
          <p className="text-sm text-muted-foreground">Widen the window to edit your dashboard.</p>
        )}
        {editing && save.isError && (
          <p role="alert" className="text-sm text-exception">
            Your dashboard couldn’t be saved. Try again.
          </p>
        )}
        <WidgetGrid
          widgets={widgets}
          layout={board}
          editing={canEdit && !save.isPending}
          onChange={(next) => editor.change(keepNeedsYou(next))}
          onRemove={editor.remove}
          onMeasure={setBoardWidth}
        />
        {displayed.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {canEdit ? 'Add a widget to start building your dashboard.' : 'There are no widgets on this dashboard.'}
          </p>
        )}
      </div>
    </Shell>
  );

  const page = (
    <>
      {content}
      {canEdit && galleryOpen && boardWidth !== null && (
        <WidgetGallery
          widgets={[...available.values()].filter(({ widgetKey }) => !has(widgetKey))}
          boardWidth={boardWidth}
          render={render}
          onClose={() => setGalleryOpen(false)}
          onAdd={(key, size) => {
            editor.add(key, size);
            setGalleryOpen(false);
          }}
        />
      )}
      {confirmCancel && (
        <ConfirmModal
          title="Discard dashboard changes?"
          message="Your dashboard will return to the last saved layout."
          confirmLabel="Discard changes"
          onConfirm={() => {
            setConfirmCancel(false);
            closeEdit();
          }}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </>
  );
  return today ? <TodayProvider>{page}</TodayProvider> : page;
}

const sizeKey = ({ w, h }: GridSize) => `${w}x${h}`;

// The UI's registry names the widget first: the words are the UI's to choose, and the
// API's copy of a label can lag a rename (Take an order → Till) without breaking a saved layout.
const widgetLabel = (widget: DashboardWidgetPlacement) =>
  widgetDefinition(widget.widgetKey)?.label ?? widget.definition?.label ?? widget.widgetKey;

/**
 * The widget gallery, as iOS draws it: every widget that isn't on the board,
 * live, at its smallest size; choose one and its page shows it at each of its
 * sizes, with what it does in one line and an Add widget button. What you see
 * there is what lands on the board.
 */
function WidgetGallery({
  widgets,
  boardWidth,
  render,
  onAdd,
  onClose,
}: {
  widgets: DashboardWidgetPlacement[];
  boardWidth: number;
  render: (key: string) => ReactNode;
  onAdd: (key: string, size: GridSize) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<DashboardWidgetPlacement | null>(null);
  return (
    <Drawer
      title={chosen ? widgetLabel(chosen) : 'Add widget'}
      description={chosen ? widgetDefinition(chosen.widgetKey)?.description : 'Choose a widget to see it at every size.'}
      icon={LayoutDashboard}
      onClose={onClose}
      bodyClassName="px-5 py-5 sm:px-6"
    >
      {chosen ? (
        <WidgetSizes widget={chosen} boardWidth={boardWidth} render={render} onAdd={onAdd} onBack={() => setChosen(null)} />
      ) : widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every widget you can use is already on your dashboard.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6">
          {widgets.map((widget) => {
            const smallest = declaredSizes(widget)[0]!;
            const strip = widget.widgetKey === NEEDS_YOU;
            return (
              // A small widget takes one column; anything wider takes the row, as the gallery lays them out.
              <li key={widget.widgetKey} className={smallest.w > 1 || strip ? 'col-span-2' : undefined}>
                <button
                  type="button"
                  onClick={() => setChosen(widget)}
                  className="group/pick block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  aria-label={`${widgetLabel(widget)}: ${widgetDefinition(widget.widgetKey)?.description ?? ''}`}
                >
                  <span className="block rounded-lg transition-shadow duration-150 group-hover/pick:shadow-md">
                    {strip ? (
                      <span inert className="block">
                        {render(widget.widgetKey)}
                      </span>
                    ) : (
                      <ScaledPreview size={smallest} boardWidth={boardWidth}>
                        {render(widget.widgetKey)}
                      </ScaledPreview>
                    )}
                  </span>
                  <span className="mt-2 block truncate text-center text-[13px] font-medium text-heading">{widgetLabel(widget)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

/** One widget at each of its sizes: the live preview, the size it is, and the button that adds it. */
function WidgetSizes({
  widget,
  boardWidth,
  render,
  onAdd,
  onBack,
}: {
  widget: DashboardWidgetPlacement;
  boardWidth: number;
  render: (key: string) => ReactNode;
  onAdd: (key: string, size: GridSize) => void;
  onBack: () => void;
}) {
  const sizes = declaredSizes(widget);
  const [index, setIndex] = useState(0);
  const size = sizes[index]!;
  const label = widgetLabel(widget);
  // Needs you has no size: it is a strip across the top of the page, so it is shown as one.
  const strip = widget.widgetKey === NEEDS_YOU;
  return (
    <div className="flex flex-col items-center">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 self-start">
        <ChevronLeft aria-hidden="true" /> All widgets
      </Button>
      <div className="flex min-h-64 w-full items-center justify-center rounded-lg bg-band/50 p-6">
        {strip ? (
          <div inert className="w-full">
            {render(widget.widgetKey)}
          </div>
        ) : (
          <ScaledPreview size={size} boardWidth={boardWidth} key={`${size.w}x${size.h}`}>
            {render(widget.widgetKey)}
          </ScaledPreview>
        )}
      </div>
      {strip ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">Across the top of your dashboard</p>
      ) : sizes.length > 1 ? (
        <SegmentedControl
          className="mt-4"
          ariaLabel={`${label} size`}
          options={sizes.map((option) => ({ value: sizeKey(option), label: familyName(option) }))}
          value={sizeKey(size)}
          onChange={(value) => setIndex(sizes.findIndex((option) => sizeKey(option) === value))}
        />
      ) : (
        <p className="mt-4 text-xs font-medium text-muted-foreground">{familyName(size)}</p>
      )}
      <Button size="lg" className="mt-6" onClick={() => onAdd(widget.widgetKey, size)}>
        <Plus aria-hidden="true" /> Add widget
      </Button>
    </div>
  );
}

/** The widget at its real size on this board, scaled down to the space it is shown in. */
function ScaledPreview({ size, boardWidth, children }: { size: GridSize; boardWidth: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setAvailable(entry!.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const real = cellPixels(size, boardWidth);
  const scale = available > 0 ? Math.min(1, available / real.width) : 1;
  return (
    <div ref={frame} className="flex w-full justify-center">
      <div style={{ width: real.width * scale, height: real.height * scale }}>
        <div
          inert
          className="origin-top-left"
          style={
            { width: real.width, height: real.height, transform: `scale(${scale})`, '--widget-radius': `${real.radius}px` } as CSSProperties
          }
        >
          <WidgetCellContext.Provider value={{ ...size, width: real.width, height: real.height }}>{children}</WidgetCellContext.Provider>
        </div>
      </div>
    </div>
  );
}

/** None, then each wallpaper as a swatch of itself. */
function WallpaperPicker({ value, onChange, disabled }: { value: string | null; onChange: (id: string | null) => void; disabled: boolean }) {
  const options = [{ id: null, label: 'None', src: null }, ...DASHBOARD_WALLPAPERS];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" disabled={disabled}>
          <ImageIcon aria-hidden="true" /> Wallpaper
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div role="radiogroup" aria-label="Wallpaper" className="grid grid-cols-4 gap-3">
          {options.map((option) => {
            const selected = option.id === value;
            return (
              <button
                key={option.id ?? 'none'}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option.id)}
                className="group/swatch flex flex-col items-center gap-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className={cn(
                    'relative grid h-12 w-16 place-items-center rounded-md bg-background bg-cover bg-center shadow-[inset_0_0_0_1px_var(--border)]',
                    selected && 'ring-2 ring-primary ring-offset-2 ring-offset-popover',
                  )}
                  style={option.src ? { backgroundImage: `url(${option.src})` } : undefined}
                >
                  {selected && (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check size={12} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground group-hover/swatch:text-heading">{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
