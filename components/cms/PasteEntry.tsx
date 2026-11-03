'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useCmsTenantId } from '@/components/cms/ContentScope';

import { createCmsEntry, getCmsContentTypes, getCmsLocales } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { parseEntryClipboard, planEntryPaste } from '@/lib/utils/cms-entry-clipboard';

import { TEXTAREA_CLASS, cmsKeys, invalidateCms } from './shared';

/**
 * An entry copied with "Copy as JSON" — from this workspace or another
 * (local → production) — becoming a new draft in the model with the same key.
 * Media and references from another workspace are left for you to pick.
 */
export function usePasteEntry(initialText: string, onCreated: (id: string) => void) {
  const tenantId = useCmsTenantId();
  const queryClient = useQueryClient();
  const [text, setText] = useState(initialText);
  const types = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId),
    queryFn: () => getCmsContentTypes(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const locales = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const clip = text.trim() ? parseEntryClipboard(text) : null;
  const plan =
    clip && tenantId && types.data && locales.data
      ? planEntryPaste(clip, { origin: window.location.origin, tenantId }, types.data, locales.data)
      : null;

  const create = useMutation({
    mutationFn: () => {
      if (!plan?.ok) throw new Error('Nothing to paste.');
      return createCmsEntry({ contentTypeId: plan.contentTypeId, locale: plan.locale, data: plan.data }, tenantId ?? undefined);
    },
    onSuccess: (entry) => {
      invalidateCms(queryClient);
      toast('success', 'Entry pasted as a draft — opening it now.');
      onCreated(entry.id);
    },
    onError: (error) => toast('error', error.message),
  });

  return {
    text,
    setText,
    clip,
    plan,
    create,
    loading: types.isPending || locales.isPending,
    failed: types.isError || locales.isError,
  };
}

export type PasteEntryState = ReturnType<typeof usePasteEntry>;

/** The paste box and what the paste would create; the dialog's footer holds Create draft. */
export function PasteEntryBody({ paste }: { paste: PasteEntryState }) {
  const { text, setText, clip, plan, loading, failed } = paste;
  return (
    <div className="space-y-3">
      <textarea
        aria-label="Copied entry JSON"
        autoFocus={!text}
        rows={text ? 5 : 9}
        spellCheck={false}
        placeholder="Press ⌘V / Ctrl+V to paste an entry copied with “Copy as JSON”"
        className={`${TEXTAREA_CLASS} font-mono text-xs`}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {failed ? (
        <p className="text-sm text-measured">This workspace’s models couldn’t be loaded. Close and try again.</p>
      ) : text.trim() && !clip ? (
        <p className="text-sm text-measured">That isn’t a copied entry. Use “Copy as JSON” on an entry first.</p>
      ) : clip && loading ? (
        <p className="text-sm text-muted-foreground">Checking this workspace’s models…</p>
      ) : plan && !plan.ok ? (
        <p className="text-sm text-measured">{plan.error}</p>
      ) : plan?.ok ? (
        <div className="space-y-1.5 rounded-lg border border-rule/60 bg-band/30 px-3.5 py-3 text-sm">
          <p className="text-foreground">
            <span className="font-semibold">{clip?.title || 'Untitled'}</span>
            <span className="text-muted-foreground">
              {' '}
              → new {plan.typeName} draft in {plan.locale ?? 'the default language'}
              {plan.locale === undefined && clip ? ` (${clip.locale} isn’t set up here)` : ''}
            </span>
          </p>
          {plan.cleared.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Left empty, pick them again here: <span className="font-mono">{plan.cleared.join(', ')}</span> — media and links belong to the
              workspace they were copied from.
            </p>
          )}
          {plan.linkedImages.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Images in <span className="font-mono">{plan.linkedImages.join(', ')}</span> still load from the other workspace — re-insert
              them from Media.
            </p>
          )}
          {plan.unknown.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in this model, skipped: <span className="font-mono">{plan.unknown.join(', ')}</span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
