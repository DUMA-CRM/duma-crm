'use client';

import { useState } from 'react';

import { ArrowDown, ArrowUp, Funnel, Plus, RotateCcw, Trash2 } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { DrawerSection } from '@/components/shared/DrawerSection';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { FunnelStep } from '@/lib/api/analytics.service';
import { cn } from '@/lib/utils/cn';
import {
  DEFAULT_FUNNEL,
  MAX_FUNNEL_STEPS,
  MIN_FUNNEL_STEPS,
  addStep,
  cleanFunnel,
  funnelProblem,
  moveStep,
  removeStep,
} from '@/lib/utils/web-analytics';

/**
 * The funnel's steps, edited in a drawer in the app's drawer vocabulary —
 * titled sections of white cards, Cancel and Save in the footer. A draft until
 * Save, so a half-typed step never fetches. Pages and events seen in the
 * period are offered as you type and as one-tap suggestions, so nobody has to
 * remember an event name.
 */
export function FunnelStepsDrawer({
  steps,
  suggestions,
  onSave,
  onClose,
}: {
  steps: FunnelStep[];
  /** Pages and events from the period, busiest first. */
  suggestions: { pages: string[]; events: string[] };
  onSave: (steps: FunnelStep[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(steps);
  const [tried, setTried] = useState(false);
  const problem = funnelProblem(draft);
  const changed = JSON.stringify(cleanFunnel(draft)) !== JSON.stringify(steps);
  const full = draft.length >= MAX_FUNNEL_STEPS;
  const update = (index: number, next: Partial<FunnelStep>) =>
    setDraft((current) => current.map((step, at) => (at === index ? { ...step, ...next } : step)));
  // A suggestion fills the last step if it's still empty, else adds one.
  const suggest = (step: FunnelStep) =>
    setDraft((current) => {
      const empty = current.findIndex((entry) => !entry.value.trim());
      if (empty >= 0) return current.map((entry, at) => (at === empty ? step : entry));
      return addStep(current, step);
    });
  const used = new Set(draft.map((step) => `${step.type}:${step.value.trim()}`));

  return (
    <Drawer
      icon={Funnel}
      title="Funnel steps"
      guidance="A visitor counts at a step once they’ve done every step before it, within an hour."
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" className="gap-1.5" onClick={() => setDraft(DEFAULT_FUNNEL)}>
            <RotateCcw size={14} aria-hidden="true" /> Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="min-w-28"
              disabled={!changed}
              onClick={() => {
                setTried(true);
                if (problem) return;
                onSave(cleanFunnel(draft));
                onClose();
              }}
            >
              Save steps
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <DrawerSection id="funnel-steps" title="Steps" count={draft.length}>
          <datalist id="funnel-pages">
            {suggestions.pages.map((page) => (
              <option key={page} value={page} />
            ))}
          </datalist>
          <datalist id="funnel-events">
            {suggestions.events.map((event) => (
              <option key={event} value={event} />
            ))}
          </datalist>
          <ol className="divide-y divide-rule/50">
            {draft.map((step, index) => (
              <li key={index} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Input
                      aria-label={`Step ${index + 1}: ${step.type === 'page' ? 'page path' : 'event name'}`}
                      list={step.type === 'page' ? 'funnel-pages' : 'funnel-events'}
                      placeholder={step.type === 'page' ? '/menu' : 'order_placed'}
                      value={step.value}
                      onChange={(event) => update(index, { value: event.target.value })}
                      className={cn(step.type === 'page' && 'font-mono')}
                      error={tried && !step.value.trim() ? 'Name this step' : undefined}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 pl-10">
                  <SegmentedControl
                    ariaLabel={`Step ${index + 1} is a`}
                    options={[
                      { value: 'page', label: 'Page' },
                      { value: 'event', label: 'Event' },
                    ]}
                    value={step.type}
                    onChange={(type) => update(index, { type })}
                  />
                  <span className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === 0}
                    aria-label={`Move step ${index + 1} up`}
                    onClick={() => setDraft((current) => moveStep(current, index, -1))}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === draft.length - 1}
                    aria-label={`Move step ${index + 1} down`}
                    onClick={() => setDraft((current) => moveStep(current, index, 1))}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-exception"
                    disabled={draft.length <= MIN_FUNNEL_STEPS}
                    aria-label={`Remove step ${index + 1}`}
                    title={draft.length <= MIN_FUNNEL_STEPS ? `A funnel needs at least ${MIN_FUNNEL_STEPS} steps` : undefined}
                    onClick={() => setDraft((current) => removeStep(current, index))}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <button
            type="button"
            disabled={full}
            onClick={() => setDraft((current) => addStep(current))}
            className="flex w-full items-center justify-center gap-1.5 border-t border-rule/50 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-band disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            <Plus size={14} aria-hidden="true" />
            {full ? `Up to ${MAX_FUNNEL_STEPS} steps` : 'Add step'}
          </button>
        </DrawerSection>

        {tried && problem && (
          <p role="alert" className="-mt-3 text-sm text-exception">
            {problem}
          </p>
        )}

        {(suggestions.pages.length > 0 || suggestions.events.length > 0) && (
          <DrawerSection id="funnel-suggestions" title="From your website">
            <div className="space-y-3 px-4 py-3">
              <p className="text-xs text-muted-foreground">Seen in this period. Tap one to add it as a step.</p>
              <SuggestionGroup
                label="Events"
                values={suggestions.events}
                used={(value) => used.has(`event:${value}`)}
                disabled={full && draft.every((step) => step.value.trim())}
                onPick={(value) => suggest({ type: 'event', value })}
              />
              <SuggestionGroup
                label="Pages"
                values={suggestions.pages}
                mono
                used={(value) => used.has(`page:${value}`)}
                disabled={full && draft.every((step) => step.value.trim())}
                onPick={(value) => suggest({ type: 'page', value })}
              />
            </div>
          </DrawerSection>
        )}
      </div>
    </Drawer>
  );
}

function SuggestionGroup({
  label,
  values,
  mono = false,
  used,
  disabled,
  onPick,
}: {
  label: string;
  values: string[];
  mono?: boolean;
  used: (value: string) => boolean;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-label uppercase text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {values.slice(0, 10).map((value) => {
          const taken = used(value);
          return (
            <button
              key={value}
              type="button"
              disabled={disabled || taken}
              onClick={() => onPick(value)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border border-rule/70 bg-background px-2 py-1 text-xs text-foreground transition-colors',
                'hover:border-primary/50 hover:bg-primary/6 disabled:cursor-default disabled:opacity-45 disabled:hover:border-rule/70 disabled:hover:bg-background',
                mono && 'font-mono',
              )}
            >
              {!taken && <Plus size={11} className="text-muted-foreground" aria-hidden="true" />}
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
