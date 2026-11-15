'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, Loader2, RotateCcw, Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Button } from '@/components/ui/button';

import { ANALYTICS_WIDGET_KEYS, widgetDefinition } from '@/lib/dashboard/widget-registry';
import {
  type ResolvedDashboardLayout,
  publishPersonalDashboardLayout,
  resetPersonalDashboardLayout,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';

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
  const [presetsOpen, setPresetsOpen] = useState(false);

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

  const activePreset = presets.find(
    (preset) =>
      keys.join('|') === preset.ordered.join('|') &&
      visible.size === preset.shown.size &&
      [...visible].every((key) => preset.shown.has(key)),
  );

  // Two blocks side by side: the view and its quick layouts | the panels as a titled list.
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <SettingsSection footnote="Saved to your account.">
        <div>
          <ChangeRow
            icon={LayoutDashboard}
            label="View"
            value={
              <>
                <span className="truncate">{layout.source === 'personal' ? 'Personal view' : 'Workspace view'}</span>
                <ValueAside>
                  · {visible.size} of {keys.length} panels shown
                </ValueAside>
              </>
            }
            trailing={
              layout.source === 'personal' && (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => reset.mutate()} aria-label="Reset layout to default">
                  {reset.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                  Reset
                </Button>
              )
            }
          />
          {keys.some((key) => ANALYTICS_WIDGET_KEYS.has(key)) && (
            <ChangeRow
              icon={Sparkles}
              label="Quick layout"
              value={activePreset ? activePreset.label : <ValueMissing>Your own order</ValueMissing>}
              open={presetsOpen}
              onToggle={() => setPresetsOpen((current) => !current)}
            >
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Dashboard layout presets">
                {presets.map((preset) => {
                  const active = preset === activePreset;
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
                        setPresetsOpen(false);
                      }}
                      className={cn(
                        'rounded-lg border px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        active
                          ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
                          : 'border-border bg-control hover:border-rule hover:bg-band/45',
                      )}
                    >
                      <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{preset.detail}</span>
                    </button>
                  );
                })}
              </div>
            </ChangeRow>
          )}
        </div>
      </SettingsSection>

      <RecordGroup
        id="dashboard-panels"
        title="Panels"
        actions={
          dirty || publish.isPending ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving…
            </span>
          ) : saved && !pending ? (
            <span className="text-xs font-medium text-success">Saved</span>
          ) : undefined
        }
        footnote={
          error && (
            <span role="alert" className="text-exception">
              Your dashboard could not be saved. Please try again.
            </span>
          )
        }
      >
        {keys.length > 0 ? (
          <ListRowGroup>
            {keys.map((key, index) => {
              const widget = byKey.get(key);
              if (!widget) return null;
              const shown = visible.has(key);
              const label = widget.definition?.label ?? key;
              return (
                <ListRow
                  key={key}
                  icon={shown ? Eye : EyeOff}
                  muted={!shown}
                  title={label}
                  pressed={shown}
                  targetLabel={`Show ${label} on the dashboard`}
                  chevron={false}
                  onClick={() => {
                    if (pending) return;
                    changed();
                    setVisible((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  control={
                    <span className="flex items-center gap-1">
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
                  }
                />
              );
            })}
          </ListRowGroup>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No dashboard panels are available for your access yet.
          </p>
        )}
      </RecordGroup>
    </div>
  );
}
