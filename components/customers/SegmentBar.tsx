'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Popover } from 'radix-ui';
import { useState } from 'react';

import { Check, Tags, Trash2, X } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasActiveFilters } from '@/lib/api/customers.service';
import { createSegment, deleteSegment } from '@/lib/api/segments.service';
import { cn } from '@/lib/utils/cn';
import type { CustomerFilters, CustomerSegment } from '@/types/customers';

/**
 * Saved segments: the difference between a filter you rebuild every Monday and
 * one the business owns.
 *
 * A segment stores the *query*, not the people, so "lapsed VIPs" keeps meaning
 * that as guests come and go.
 *
 * This was a whole row of its own — a label, a select, a live count chip, a
 * delete button and a save button — for something a manager touches once a week.
 * It is now one control in the filter row: the trigger names the applied
 * segment, and applying, saving and deleting all happen inside it. The live
 * counts moved to the toolbar's result line, where the other counts already are.
 */

interface Props {
  filters: CustomerFilters;
  appliedSegmentId: string | null;
  segments: CustomerSegment[];
  onApply: (segmentId: string | null, filters?: CustomerFilters) => void;
  canWrite: boolean;
}

export function SegmentBar({ filters, appliedSegmentId, segments, onApply, canWrite }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applied = segments.find((segment) => segment.id === appliedSegmentId) ?? null;

  const save = useMutation({
    mutationFn: () => createSegment({ name: name.trim(), filters }),
    onSuccess: (segment) => {
      void qc.invalidateQueries({ queryKey: ['customer-segments'] });
      setShowSave(false);
      setName('');
      setError(null);
      // Jump straight to the saved segment, so saving and applying are one move.
      onApply(segment.id, segment.filters);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Could not save this segment.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSegment(id),
    onSuccess: (_result, id) => {
      void qc.invalidateQueries({ queryKey: ['customer-segments'] });
      if (appliedSegmentId === id) onApply(null);
    },
  });

  const canSave = hasActiveFilters(filters);

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            className={cn('w-[calc(50%-0.25rem)] sm:w-auto sm:max-w-48', applied && 'border-primary/40 text-primary')}
            aria-label={applied ? `Segment: ${applied.name}. Change segment` : 'Apply a saved customer segment'}
          >
            <Tags data-icon="inline-start" />
            <span className="truncate">{applied ? applied.name : 'Segments'}</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className="z-90 w-[calc(100vw-2rem)] max-w-xs rounded-sm border border-rule bg-surface p-2 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          >
            <p className="px-2 pb-1.5 pt-1 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Saved segments</p>

            {segments.length === 0 ? (
              <p className="px-2 pb-2 text-xs text-muted-foreground">
                No segments yet. Filter the list, then save it here to reuse the same question later.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {segments.map((segment) => {
                  const isApplied = segment.id === appliedSegmentId;
                  return (
                    <li key={segment.id} className="group flex items-center gap-0.5 rounded-sm hover:bg-band">
                      <button
                        type="button"
                        onClick={() => {
                          onApply(isApplied ? null : segment.id, isApplied ? undefined : segment.filters);
                          setOpen(false);
                        }}
                        aria-pressed={isApplied}
                        className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <Check
                          size={14}
                          className={cn('shrink-0 text-primary', !isApplied && 'invisible')}
                          aria-hidden="true"
                        />
                        <span className="truncate">{segment.name}</span>
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => remove.mutate(segment.id)}
                          disabled={remove.isPending}
                          title="Delete this segment. Customers are not affected."
                          aria-label={`Delete segment ${segment.name}`}
                          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-exception/8 hover:text-exception focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-exception/30 group-hover:opacity-100"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {(canWrite || applied) && (
              <div className="mt-1 flex items-center gap-1 border-t border-rule/60 pt-1.5">
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShowSave(true);
                    }}
                    disabled={!canSave}
                    title={canSave ? 'Save these filters as a reusable segment' : 'Set some filters first'}
                    className="flex min-h-8 flex-1 items-center rounded-sm px-2 text-left text-sm font-semibold text-primary hover:bg-band disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-60"
                  >
                    Save current filters…
                  </button>
                )}
                {applied && (
                  <button
                    type="button"
                    onClick={() => {
                      onApply(null);
                      setOpen(false);
                    }}
                    className="flex min-h-8 shrink-0 items-center gap-1 rounded-sm px-2 text-sm text-muted-foreground hover:bg-band hover:text-foreground"
                  >
                    <X size={13} aria-hidden="true" />
                    Clear
                  </button>
                )}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {showSave && (
        <Modal title="Save segment" onClose={() => setShowSave(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) save.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="segment-name" className="text-sm font-semibold text-foreground">
                Name
              </label>
              <Input
                id="segment-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Lapsed VIPs"
                autoFocus
                maxLength={120}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Saves the current filters, not the current results — the segment keeps up as guests come and go.
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-exception/30 bg-exception/8 px-3 py-2 text-sm text-exception" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowSave(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || save.isPending}>
                {save.isPending ? 'Saving…' : 'Save segment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
