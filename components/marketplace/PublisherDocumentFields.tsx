'use client';

import { useId, useState } from 'react';

import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import type { PublisherDocumentInput } from '@/lib/api/marketplace.service';

const kinds = [
  { kind: 'support', label: 'Support' },
  { kind: 'privacy', label: 'Privacy policy' },
] as const;

export function publisherDocumentsFromForm(form: FormData): PublisherDocumentInput {
  const documents: PublisherDocumentInput = {};
  for (const { kind } of kinds) {
    const suffix = form.get(`${kind}Mode`) === 'text' ? 'Text' : 'Url';
    const key = `${kind}${suffix}` as const;
    documents[key] = String(form.get(key) ?? '').trim();
  }
  return documents;
}

function PublisherDocumentField({ kind, label, url, text }: typeof kinds[number] & {
  url?: string | undefined;
  text?: string | undefined;
}) {
  const id = useId();
  const [writePage, setWritePage] = useState(Boolean(text));

  return (
    <div className="min-w-0 space-y-2">
      <FieldLabel htmlFor={id} required>{label}</FieldLabel>
      <select id={id} name={`${kind}Mode`} value={writePage ? 'text' : 'url'}
        onChange={(event) => setWritePage(event.target.value === 'text')}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
        <option value="url">Use an existing URL</option>
        <option value="text">Write a DUMA-hosted page</option>
      </select>
      <div hidden={writePage}>
        <Input aria-label={`${label} URL`} name={`${kind}Url`} type="url" placeholder="https://"
          disabled={writePage} required={!writePage} defaultValue={text ? '' : url} />
      </div>
      <div hidden={!writePage}>
        <textarea aria-label={`${label} page text`} aria-describedby={`${id}-hint`} className={TEXTAREA_CLASS}
          name={`${kind}Text`} rows={6} maxLength={12000} disabled={!writePage} required={writePage} defaultValue={text} />
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
          DUMA publishes this text on a public page when the app is live.
        </p>
      </div>
    </div>
  );
}

export function PublisherDocumentFields({ initial }: { initial: {
  supportUrl?: string | undefined;
  privacyUrl?: string | undefined;
  supportText?: string | undefined;
  privacyText?: string | undefined;
} }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {kinds.map((field) => (
        <PublisherDocumentField key={field.kind} {...field} url={initial[`${field.kind}Url`]} text={initial[`${field.kind}Text`]} />
      ))}
    </div>
  );
}
