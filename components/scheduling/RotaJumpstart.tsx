'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronDown, Copy, Layers, Trash2, Zap } from '@/components/icons';
import { invalidateRota } from '@/components/scheduling/rota-queries';
import { inp } from '@/components/scheduling/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';

import { type FillMode, applyRotaTemplate, createTemplateFromWeek, getRotaTemplates } from '@/lib/api/rota.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { copyRotaWeek, deleteScheduledShiftsBulk } from '@/lib/modules/workforce/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { addDays, fillSummary } from '@/lib/utils/rota-planner';

const MODES: { value: FillMode; label: string; hint: string }[] = [
  { value: 'skip_clashes', label: 'Skip clashes', hint: 'Leave out a shift that overlaps someone’s shift or leave.' },
  { value: 'replace', label: 'Replace drafts', hint: 'Clear this week’s drafts first. Published shifts stay.' },
  { value: 'open', label: 'Send clashes to open shifts', hint: 'Copy a clashing shift with nobody on it.' },
];

type Dialog = 'copy' | 'template' | 'save' | 'clear' | null;

/**
 * Start the week from something: last week, a saved template, or nothing
 * (clear the drafts). Every fill lands as drafts and reports what it did.
 */
export function RotaJumpstart({ locationId, weekStart, draftIds }: { locationId: string; weekStart: string; draftIds: string[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mode, setMode] = useState<FillMode>('skip_clashes');
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState(1);

  const templates = useQuery({
    queryKey: moduleQueryKeys.workforce.key('rota-templates', locationId),
    queryFn: () => getRotaTemplates(locationId),
    enabled: dialog === 'template',
  });

  const done = (message: string) => {
    invalidateRota(qc);
    toast('success', message);
    setDialog(null);
  };

  const copy = useMutation({
    mutationFn: () => copyRotaWeek({ locationId, fromWeekStart: addDays(weekStart, -7), toWeekStart: weekStart, mode }),
    onSuccess: (result) => done(fillSummary(result, 'copied')),
  });
  const apply = useMutation({
    mutationFn: () => applyRotaTemplate(templateId, { weekStart, mode }),
    onSuccess: (result) => done(fillSummary(result, 'added')),
  });
  const save = useMutation({
    mutationFn: () => createTemplateFromWeek({ locationId, weekStart, weeks, name: name.trim() }),
    onSuccess: (template) => done(`Saved “${template.name}”.`),
  });
  const clear = useMutation({
    mutationFn: () => deleteScheduledShiftsBulk(draftIds.slice(0, 300)),
    onSuccess: (result) => done(`${result.deleted} ${result.deleted === 1 ? 'draft' : 'drafts'} cleared`),
  });

  const pick = (next: Dialog) => {
    setOpen(false);
    copy.reset();
    apply.reset();
    save.reset();
    clear.reset();
    setDialog(next);
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-band disabled:opacity-45';

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-1.5">
            <Zap size={15} /> Jumpstart <ChevronDown size={14} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-1">
          <button type="button" className={item} onClick={() => pick('copy')}>
            <Copy size={15} className="text-muted-foreground" /> Copy last week
          </button>
          <button type="button" className={item} onClick={() => pick('template')}>
            <Layers size={15} className="text-muted-foreground" /> Apply template…
          </button>
          <button type="button" className={item} onClick={() => pick('save')}>
            <Layers size={15} className="text-muted-foreground" /> Save week as template
          </button>
          <button type="button" className={item} onClick={() => pick('clear')} disabled={draftIds.length === 0}>
            <Trash2 size={15} className="text-destructive" /> Clear drafts this week
          </button>
        </PopoverContent>
      </Popover>

      {(dialog === 'copy' || dialog === 'template') && (
        <Modal
          title={dialog === 'copy' ? 'Copy last week' : 'Apply a template'}
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              {dialog === 'copy' ? (
                <Button onClick={() => copy.mutate()} disabled={copy.isPending}>
                  {copy.isPending ? 'Copying…' : 'Copy as drafts'}
                </Button>
              ) : (
                <Button onClick={() => apply.mutate()} disabled={apply.isPending || !templateId}>
                  {apply.isPending ? 'Applying…' : 'Apply as drafts'}
                </Button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {dialog === 'template' && (
              <div className="space-y-1.5">
                <FieldLabel as="span">Template</FieldLabel>
                {templates.isPending ? (
                  <p className="text-sm text-muted-foreground">Loading templates…</p>
                ) : templates.isError ? (
                  <p className="text-sm text-destructive">
                    Templates couldn’t be loaded.{' '}
                    <button type="button" className="font-semibold underline" onClick={() => void templates.refetch()}>
                      Try again
                    </button>
                  </p>
                ) : templates.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No templates yet. Save a week as one first.</p>
                ) : (
                  <Select
                    value={templateId}
                    onValueChange={setTemplateId}
                    options={templates.data.map((t) => ({
                      value: t.id,
                      label: `${t.name} · ${t.shiftCount} ${t.shiftCount === 1 ? 'shift' : 'shifts'}${t.weeks > 1 ? ` · ${t.weeks} weeks` : ''}`,
                    }))}
                    placeholder="Choose a template"
                    ariaLabel="Template"
                    className="w-full"
                  />
                )}
              </div>
            )}
            <ModeChoice value={mode} onChange={setMode} />
            {(copy.error ?? apply.error) && (
              <p role="alert" className="text-sm text-destructive">
                {((copy.error ?? apply.error) as Error).message}
              </p>
            )}
          </div>
        </Modal>
      )}

      {dialog === 'save' && (
        <Modal
          title="Save week as template"
          onClose={() => setDialog(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
                {save.isPending ? 'Saving…' : 'Save template'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <FieldLabel as="span">Name</FieldLabel>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Standard week" className={inp} />
            </label>
            <div className="space-y-1.5">
              <FieldLabel as="span">Weeks</FieldLabel>
              <Select
                value={String(weeks)}
                onValueChange={(value) => setWeeks(Number(value))}
                options={[1, 2, 3, 4].map((count) => ({
                  value: String(count),
                  label: count === 1 ? 'This week' : `This week and the next ${count - 1}`,
                }))}
                ariaLabel="Weeks to save"
                className="w-full"
              />
            </div>
            {save.error && (
              <p role="alert" className="text-sm text-destructive">
                {(save.error as Error).message}
              </p>
            )}
          </div>
        </Modal>
      )}

      {dialog === 'clear' && (
        <ConfirmModal
          title="Clear this week’s drafts?"
          message={
            <>
              <span className="block">
                {draftIds.length} draft {draftIds.length === 1 ? 'shift is' : 'shifts are'} deleted. Published shifts stay.
              </span>
              {clear.error && (
                <span role="alert" className="mt-2 block font-medium text-destructive">
                  {(clear.error as Error).message}
                </span>
              )}
            </>
          }
          confirmLabel="Clear drafts"
          pendingLabel="Clearing…"
          isPending={clear.isPending}
          onConfirm={() => clear.mutate()}
          onClose={() => {
            if (!clear.isPending) setDialog(null);
          }}
        />
      )}
    </>
  );
}

function ModeChoice({ value, onChange }: { value: FillMode; onChange: (mode: FillMode) => void }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5">
        <FieldLabel as="span">When a shift clashes</FieldLabel>
      </legend>
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={value === mode.value}
          onClick={() => onChange(mode.value)}
          className={cn(
            'block w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === mode.value ? 'border-primary bg-primary/6' : 'border-border hover:bg-band/60',
          )}
        >
          <span className="block text-sm font-semibold text-foreground">{mode.label}</span>
          <span className="block text-xs text-muted-foreground">{mode.hint}</span>
        </button>
      ))}
    </fieldset>
  );
}
