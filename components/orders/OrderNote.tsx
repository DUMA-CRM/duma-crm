'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FileText, Loader2, Pencil, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { updateOrderNotes } from '@/lib/modules/ordering/client';
import { toast } from '@/stores/toastStore';

import { invalidateOrder } from './StatusMenu';

/**
 * The order's note, kept on the order — a callback number, where a parcel was
 * left, what the customer asked on the phone. Added or changed at any time; on
 * a live order the kitchen ticket shows it too.
 */
export function OrderNote({ orderId, notes, canEdit }: { orderId: string; notes: string | null | undefined; canEdit: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');
  const save = useMutation({
    mutationFn: () => updateOrderNotes(orderId, draft),
    onSuccess: () => {
      invalidateOrder(qc, orderId);
      toast('success', draft.trim() ? 'Note saved.' : 'Note removed.');
      setEditing(false);
    },
    onError: (error) => toast('error', error instanceof Error && error.message ? error.message : 'The note wasn’t saved. Try again.'),
  });

  if (editing)
    return (
      <section aria-label="Order note" className="space-y-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          rows={3}
          autoFocus
          placeholder="Anything worth keeping — a callback number, where it was left, what they asked…"
          aria-label="Order note"
          className="w-full resize-y rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{draft.length}/1000</span>
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(notes ?? '');
                setEditing(false);
              }}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || draft.trim() === (notes ?? '').trim()}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save note
            </Button>
          </span>
        </div>
      </section>
    );

  if (!notes)
    return canEdit ? (
      <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-control" onClick={() => setEditing(true)}>
        <Plus aria-hidden="true" /> Add a note
      </Button>
    ) : null;

  return (
    <section aria-label="Order note" className="flex items-start gap-3 rounded-lg border border-rule/60 bg-control px-3.5 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
        <FileText size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xs font-medium text-muted-foreground">Note</h3>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{notes}</p>
      </div>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            setDraft(notes);
            setEditing(true);
          }}
          aria-label="Edit the note"
        >
          <Pencil aria-hidden="true" />
        </Button>
      )}
    </section>
  );
}
