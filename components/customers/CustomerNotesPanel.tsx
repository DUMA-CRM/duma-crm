'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Check, Loader2, Lock } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';

import { updateCustomer } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
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
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer', customer.id) });
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
          <p className="whitespace-pre-wrap rounded-md border-l-2 border-rule pl-3 text-sm leading-relaxed text-foreground">
            {customer.notes}
          </p>
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
          <Pill className="bg-band text-muted-foreground">
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            Saving
          </Pill>
        ) : justSaved ? (
          <Pill className="bg-momentum/8 text-momentum" role="status">
            <Check size={11} aria-hidden="true" />
            Saved
          </Pill>
        ) : dirty ? (
          <Pill className="bg-measured/10 text-measured">Unsaved</Pill>
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
          if (event.key === 'Escape' && dirty) {
            event.preventDefault();
            setValue(saved);
          }
        }}
        maxLength={MAX}
        aria-label="Internal notes about this guest"
        aria-describedby="customer-notes-hint"
        placeholder="How they take their coffee, who they come in with, a complaint you smoothed over…"
        className={cn(
          // Grows with what is written, between a few lines and a screenful.
          'block min-h-24 max-h-96 w-full resize-none [field-sizing:content] rounded-md border border-input bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm outline-none',
          'placeholder:text-muted-foreground transition-[border-color,outline-color]',
          'focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30',
        )}
      />

      <div className="mt-2 flex min-h-8 items-center gap-3">
        <p id="customer-notes-hint" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <Lock size={12} className="shrink-0" aria-hidden="true" />
          <span className="truncate">
            {value.length > MAX - 200
              ? `${(MAX - value.length).toLocaleString()} character${MAX - value.length === 1 ? '' : 's'} left`
              : dirty
                ? 'Saves when you click away · ⌘↵'
                : 'Staff only — never shown to the guest'}
          </span>
        </p>
        {dirty && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setValue(saved)}
              disabled={save.isPending}
            >
              Discard
            </Button>
            <Button size="sm" onClick={commit} disabled={save.isPending} className="shrink-0">
              Save
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

function Pill({ className, children, role }: { className: string; children: React.ReactNode; role?: string }) {
  return (
    <span role={role} className={cn('inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-micro font-semibold', className)}>
      {children}
    </span>
  );
}

function Panel({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <SettingsSection title="Notes" actions={status}>
      {children}
    </SettingsSection>
  );
}
