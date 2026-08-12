'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Check, FileText, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { updateCustomer } from '@/lib/api/customers.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { Customer } from '@/types/customers';

const MAX = 2000;

/**
 * Internal notes, written where they are read.
 *
 * Adding a line about a guest used to mean: press an unlabelled pencil, wait
 * for a drawer, scroll past contact details, allergies, dietary needs, seating
 * and alerts, type in the last box, then save the entire record. Five sections
 * of unrelated form stood between a member of staff and one sentence, so the
 * notes field went unused and the knowledge stayed in people's heads.
 *
 * It is now a box on the record that saves itself. The Save button only exists
 * while there is something to save, ⌘/Ctrl+Enter commits without reaching for
 * the mouse, and leaving the field commits too — because the realistic failure
 * here is someone typing a note and walking off to serve the next customer.
 */
export function CustomerNotesPanel({ customer, canEdit }: { customer: Customer; canEdit: boolean }) {
  const qc = useQueryClient();
  const [value, setValue] = useState(customer.notes ?? '');
  const [justSaved, setJustSaved] = useState(false);
  /**
   * What the server last accepted. Kept in state, not a ref, because `dirty` is
   * rendered from it — the Save button and the unsaved marker both depend on it.
   *
   * Deliberately not resynced from `customer.notes` while mounted. This panel is
   * the only editor of the field (the edit drawer no longer carries it), so the
   * one thing a sync could do here is overwrite a half-typed note when a
   * background refetch lands. An erased record renders the read-only branch
   * below, which reads straight from the record and so is never stale.
   */
  const [saved, setSaved] = useState(customer.notes ?? '');

  const save = useMutation({
    mutationFn: (notes: string) => updateCustomer(customer.id, { notes: notes || undefined }),
    onSuccess: (_updated, notes) => {
      setSaved(notes);
      void qc.invalidateQueries({ queryKey: ['customer', customer.id] });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    },
    onError: (error) => toast('error', error.message || 'That note didn’t save. Try again.'),
  });

  const dirty = value !== saved;

  const commit = () => {
    if (!dirty || save.isPending) return;
    save.mutate(value);
  };

  if (!canEdit) {
    return (
      <Panel>
        {customer.notes ? (
          <p className="whitespace-pre-wrap text-sm text-foreground">{customer.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes recorded for this guest.</p>
        )}
      </Panel>
    );
  }

  return (
    <Panel
      status={
        save.isPending ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            Saving…
          </span>
        ) : justSaved ? (
          <span className="flex items-center gap-1.5 text-xs text-momentum" role="status">
            <Check size={12} aria-hidden="true" />
            Saved
          </span>
        ) : dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved</span>
        ) : undefined
      }
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        maxLength={MAX}
        aria-label="Internal notes about this guest"
        placeholder="Anything the team should know — how they take their coffee, who they usually come in with, a complaint you smoothed over."
        className={cn(
          'min-h-28 w-full resize-y rounded-sm border border-input bg-field p-3 text-sm text-foreground shadow-sm outline-none',
          'placeholder:text-muted-foreground transition-[border-color,outline-color]',
          'focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
        )}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Visible to staff only. Never shown to the customer.
          {value.length > MAX - 200 && (
            <span className="ml-1.5 tabular-nums">
              {MAX - value.length} character{MAX - value.length === 1 ? '' : 's'} left
            </span>
          )}
        </p>
        {dirty && (
          <Button size="sm" onClick={commit} disabled={save.isPending} className="shrink-0">
            {save.isPending ? 'Saving…' : 'Save note'}
          </Button>
        )}
      </div>
    </Panel>
  );
}

function Panel({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-rule bg-card p-4" aria-label="Internal notes">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText size={14} className="text-muted-foreground" aria-hidden="true" />
          Notes
        </h2>
        {status}
      </div>
      {children}
    </section>
  );
}
