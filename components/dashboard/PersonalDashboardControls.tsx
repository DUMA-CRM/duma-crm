'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Loader2, RotateCcw, SlidersHorizontal } from '@/components/icons';
import { Button } from '@/components/ui/button';

import {
  type ResolvedDashboardLayout,
  publishPersonalDashboardLayout,
  resetPersonalDashboardLayout,
} from '@/lib/api/workspace-composition.service';

function orderedKeys(layout: ResolvedDashboardLayout) {
  const visible = layout.widgets.map((widget) => widget.widgetKey);
  return [...visible, ...layout.availableWidgets.map((widget) => widget.widgetKey).filter((key) => !visible.includes(key))];
}

export function PersonalDashboardControls({ layout }: { layout: ResolvedDashboardLayout }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState(() => orderedKeys(layout));
  const [visible, setVisible] = useState(() => new Set(layout.widgets.map((widget) => widget.widgetKey)));
  const [saved, setSaved] = useState(false);

  const byKey = useMemo(() => new Map(layout.availableWidgets.map((widget) => [widget.widgetKey, widget])), [layout.availableWidgets]);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-layout', 'resolved', layout.tenantId] });
    setSaved(true);
  };
  const publish = useMutation({
    mutationFn: () =>
      publishPersonalDashboardLayout(
        layout.tenantId,
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
      ),
    onSuccess: refresh,
  });
  const reset = useMutation({ mutationFn: () => resetPersonalDashboardLayout(layout.tenantId), onSuccess: refresh });
  const pending = publish.isPending || reset.isPending;
  const error = publish.error ?? reset.error;

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= keys.length) return;
    setSaved(false);
    setKeys((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  };

  return (
    <section className="border-y border-rule/65 bg-band/30" aria-labelledby="personal-dashboard-title">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <SlidersHorizontal size={15} className="shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="personal-dashboard-title" className="text-sm font-semibold text-foreground">
            My dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            {layout.source === 'personal' ? 'Your personal arrangement is active.' : 'Using the workspace arrangement.'}
          </p>
        </div>
        <Button size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? 'Close' : 'Personalise'}
        </Button>
      </div>

      {open && (
        <div className="border-t border-rule/55 px-3 py-3 sm:px-4">
          <p className="mb-2 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
            Choose what you need and set its priority. Workspace access still decides what can appear.
          </p>
          <div className="divide-y divide-rule/45 border-y border-rule/55">
            {keys.map((key, index) => {
              const widget = byKey.get(key);
              if (!widget) return null;
              const shown = visible.has(key);
              return (
                <div key={key} className="flex min-h-11 items-center gap-2 py-2">
                  <button
                    type="button"
                    aria-pressed={shown}
                    onClick={() => {
                      setSaved(false);
                      setVisible((current) => {
                        const next = new Set(current);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {shown ? (
                      <Eye size={15} className="shrink-0 text-primary" />
                    ) : (
                      <EyeOff size={15} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className={shown ? 'truncate text-sm font-medium text-foreground' : 'truncate text-sm text-muted-foreground'}>
                      {widget.definition?.label ?? key}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{shown ? 'Shown' : 'Hidden'}</span>
                  </button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${widget.definition?.label ?? key} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${widget.definition?.label ?? key} down`}
                    disabled={index === keys.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={pending} onClick={() => publish.mutate()}>
              {publish.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Save my view
            </Button>
            {layout.source === 'personal' && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => reset.mutate()}>
                {reset.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                Use workspace view
              </Button>
            )}
            {saved && !pending && <span className="text-xs font-medium text-success">Saved</span>}
            {error && (
              <p role="alert" className="w-full text-xs text-exception">
                {(error as Error).message || 'Your dashboard was not saved. Try again.'}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
