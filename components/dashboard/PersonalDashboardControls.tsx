'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, Loader2, RotateCcw } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ANALYTICS_WIDGET_KEYS, widgetDefinition } from '@/lib/dashboard/widget-registry';
import {
  type ResolvedDashboardLayout,
  publishPersonalDashboardLayout,
  resetPersonalDashboardLayout,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

// Every registered widget renders on the board, so every one can be shown, hidden and ordered.
// The API decides which of them this viewer may have (module enabled, capability held).
const canConfigure = (key: string) => widgetDefinition(key) !== undefined;

const SERVICE_FIRST = [
  'analytics.exceptions',
  'analytics.live',
  'analytics.trading',
  'analytics.orders-hourly',
  'analytics.kpis',
  'analytics.top-items',
];
const NUMBERS_FIRST = [
  'analytics.exceptions',
  'analytics.kpis',
  'analytics.trading',
  'analytics.orders-hourly',
  'analytics.top-items',
  'analytics.live',
];
const ESSENTIALS = ['analytics.exceptions', 'analytics.trading', 'analytics.live', 'analytics.kpis'];

function prioritise(keys: string[], priority: readonly string[]) {
  return [...priority.filter((key) => keys.includes(key)), ...keys.filter((key) => !priority.includes(key))];
}

export function visibleDashboardKeys(layout: ResolvedDashboardLayout) {
  return layout.widgets.map((widget) => widget.widgetKey).filter(canConfigure);
}

function orderedKeys(layout: ResolvedDashboardLayout) {
  const visible = visibleDashboardKeys(layout);
  return [
    ...visible,
    ...layout.availableWidgets.map((widget) => widget.widgetKey).filter((key) => canConfigure(key) && !visible.includes(key)),
  ];
}

export function PersonalDashboardControls({
  layout,
  onPreviewChange,
}: {
  layout: ResolvedDashboardLayout;
  onPreviewChange?: (keys: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [keys, setKeys] = useState(() => orderedKeys(layout));
  const [visible, setVisible] = useState(
    () => new Set(orderedKeys(layout).filter((key) => layout.widgets.some((widget) => widget.widgetKey === key))),
  );
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const byKey = useMemo(() => new Map(layout.availableWidgets.map((widget) => [widget.widgetKey, widget])), [layout.availableWidgets]);
  const widgets = useMemo(
    () =>
      keys.flatMap((key, index) => {
        const widget = byKey.get(key);
        if (!widget || !visible.has(key)) return [];
        return [
          {
            widgetKey: key,
            gridColumn: widget.gridColumn,
            gridRow: index + 1,
            width: widget.width,
            height: widget.height,
          },
        ];
      }),
    [byKey, keys, visible],
  );
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('dashboard-layout', 'resolved', layout.tenantId) });
    setDirty(false);
    setSaved(true);
  };
  const publish = useMutation({
    mutationFn: () => publishPersonalDashboardLayout(layout.tenantId, widgets),
    onSuccess: refresh,
    onError: () => setDirty(false),
  });
  const reset = useMutation({ mutationFn: () => resetPersonalDashboardLayout(layout.tenantId), onSuccess: refresh });
  const pending = publish.isPending || reset.isPending;
  const error = publish.error ?? reset.error;
  const presets = [
    { id: 'balanced', label: 'Balanced', detail: 'The default overview.', ordered: orderedKeys(layout), shown: new Set(keys) },
    {
      id: 'service',
      label: 'Service first',
      detail: 'Live work before figures.',
      ordered: prioritise(keys, SERVICE_FIRST),
      shown: new Set(keys),
    },
    {
      id: 'essentials',
      label: 'Essentials',
      detail: 'A quieter daily view.',
      ordered: prioritise(keys, ESSENTIALS),
      shown: new Set(keys.filter((key) => ESSENTIALS.includes(key))),
    },
    {
      id: 'numbers',
      label: 'Numbers first',
      detail: 'Performance at the top.',
      ordered: prioritise(keys, NUMBERS_FIRST),
      shown: new Set(keys),
    },
  ];

  useEffect(() => {
    onPreviewChange?.(keys.filter((key) => visible.has(key)));
  }, [keys, onPreviewChange, visible]);

  useEffect(() => {
    if (!dirty || pending) return;
    const timer = window.setTimeout(() => publish.mutate(), 500);
    return () => window.clearTimeout(timer);
  }, [dirty, pending, publish]);

  const changed = () => {
    setSaved(false);
    setDirty(true);
  };

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= keys.length) return;
    changed();
    setKeys((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  };

  return (
    <>
      <SettingsSection
        title="Dashboard"
        description="Choose the panels you want to see and arrange them in the order that helps you work."
        actions={
          <Badge variant={layout.source === 'personal' ? 'success' : 'muted'}>
            {layout.source === 'personal' ? 'Personal view' : 'Workspace view'}
          </Badge>
        }
      >
        <div className="flex items-center gap-3 rounded-md border border-rule/60 bg-page px-3 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-field text-primary">
            <LayoutDashboard className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">My dashboard</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {visible.size} of {keys.length} panels shown
            </p>
          </div>
        </div>

        {keys.some((key) => ANALYTICS_WIDGET_KEYS.has(key)) && (
          <div className="mt-5">
            <p className="mb-2 text-label uppercase text-muted-foreground">Quick layouts</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Dashboard layout presets">
              {presets.map((preset) => {
                const active =
                  keys.join('|') === preset.ordered.join('|') &&
                  visible.size === preset.shown.size &&
                  [...visible].every((key) => preset.shown.has(key));
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    disabled={pending}
                    onClick={() => {
                      changed();
                      setKeys(preset.ordered);
                      setVisible(preset.shown);
                    }}
                    className={
                      active
                        ? 'rounded-md border border-foreground bg-band/60 px-3 py-2.5 text-left outline outline-1 outline-foreground'
                        : 'rounded-md border border-rule/60 bg-background px-3 py-2.5 text-left transition-colors hover:bg-band/35'
                    }
                  >
                    <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{preset.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {keys.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-md border border-rule/60 bg-page">
            {keys.map((key, index) => {
              const widget = byKey.get(key);
              if (!widget) return null;
              const shown = visible.has(key);
              const label = widget.definition?.label ?? key;
              return (
                <div key={key} className="flex min-h-14 items-center gap-2 border-b border-rule/45 px-3 py-2.5 last:border-b-0">
                  <button
                    type="button"
                    aria-pressed={shown}
                    aria-label={`Show ${label} on the dashboard`}
                    title={shown ? 'Shown' : 'Hidden'}
                    disabled={pending}
                    onClick={() => {
                      changed();
                      setVisible((current) => {
                        const next = new Set(current);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span
                      className={
                        shown
                          ? 'flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground'
                          : 'flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/60 bg-field text-muted-foreground'
                      }
                    >
                      {shown ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                    </span>
                    <span
                      className={
                        shown ? 'truncate text-sm font-semibold text-foreground' : 'truncate text-sm font-medium text-muted-foreground'
                      }
                    >
                      {label}
                    </span>
                  </button>
                  <span className="flex items-center gap-1 border-l border-rule/50 pl-2">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${label} up`}
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Move ${label} down`}
                      disabled={pending || index === keys.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-rule/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No dashboard panels are available for your access yet.
          </p>
        )}

        {(dirty || publish.isPending || saved || error) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule/50 pt-4">
            {(dirty || publish.isPending) && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving changes…
              </span>
            )}
            {saved && !pending && !dirty && <span className="text-xs font-medium text-success">Changes saved</span>}
            {error && (
              <p role="alert" className="w-full text-xs text-exception">
                Your dashboard could not be saved. Please try again.
              </p>
            )}
          </div>
        )}
      </SettingsSection>
      {layout.source === 'personal' && (
        <div className="flex justify-end">
          <Button variant="outline" disabled={pending} onClick={() => reset.mutate()}>
            {reset.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            Reset layout to default
          </Button>
        </div>
      )}
    </>
  );
}
