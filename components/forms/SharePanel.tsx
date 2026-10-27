'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { InfoRow, PickerRow, RowTile } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import { Braces, Code, ExternalLink, EyeOff, KeyRound, Link2, Send } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ActionButton, CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { FormDetail } from '@/lib/modules/forms/client';
import { STANDING_LABELS, apiSnippets, embedSnippet, formStanding, isInputField, prefillUrl } from '@/lib/utils/forms';

import { STANDING_BADGE } from './FormsList';

/** The API as websites reach it — the same origin the Developers reference documents. */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

type Snippet = 'read' | 'submit' | 'responses';

/**
 * Everywhere the form can go, laid out like Booking rules: its link (and a
 * link that fills answers in), the snippet for a website, and the API calls
 * for your own code; the QR code beside them. Everything here is the
 * published form — a draft has no link yet.
 */
export function SharePanel({
  form,
  publicUrl,
  onPublish,
  publishing,
}: {
  form: FormDetail;
  publicUrl: string;
  onPublish?: () => void;
  publishing: boolean;
}) {
  const live = form.publishedDefinition;
  const standing = formStanding({ ...form, responseCount: form.storedResponses ?? form.responseCount });
  const fields = useMemo(() => (live?.fields ?? []).filter(isInputField), [live]);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [openPrefill, setOpenPrefill] = useState(false);
  const [snippet, setSnippet] = useState<Snippet>('submit');

  if (!live) {
    return (
      <SettingsTabBody>
        <SettingsSection title="Not published yet" actions={<Badge variant="muted">Draft</Badge>}>
          <div className="flex flex-col items-start gap-3">
            <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              Publish the form and it gets a link and a QR code, a snippet for your website and an address your own code can send answers
              to. Until then only you can see it, in Build’s preview.
            </p>
            {onPublish && (
              <ActionButton className="h-9 gap-1.5" pending={publishing} onClick={onPublish}>
                <Send size={14} aria-hidden="true" />
                Publish
              </ActionButton>
            )}
          </div>
        </SettingsSection>
      </SettingsTabBody>
    );
  }

  const linkWithAnswers = prefillUrl(publicUrl, prefill);
  const api = apiSnippets(API_ORIGIN, form.publicId, live.fields);
  const responsesCall = `curl ${API_ORIGIN}/v1/store/forms/${form.publicId}/responses \\\n  -H "Authorization: Bearer dk_sec_…"`;
  const code = snippet === 'read' ? api.read : snippet === 'submit' ? api.submit : responsesCall;

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <SettingsSection title="QR code" actions={<Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}>
          <div className="space-y-3">
            <PublicQrCodeCard url={publicUrl} locationName={form.name} purpose="form" downloadPrefix="form" />
            {standing !== 'live' && standing !== 'scheduled_close' && (
              <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                The link works, but the form isn’t taking responses — it shows your closed message.
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">On a table card, a receipt, a poster at the door.</p>
          </div>
        </SettingsSection>
      }
    >
      <SettingsSection title="Link">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Form link"
              readOnly
              value={publicUrl}
              leftIcon={<Link2 size={14} aria-hidden="true" />}
              onFocus={(event) => event.target.select()}
              className="font-mono text-xs"
            />
            <CopyButton onCopy={() => copyText(publicUrl)} className="h-10 shrink-0" />
            <Button asChild variant="outline" className="h-10 shrink-0 gap-1.5">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Open</span>
              </a>
            </Button>
          </div>
          <PickerRow
            icon={EyeOff}
            title="Fill answers in from the link"
            value={
              Object.values(prefill).some((value) => value.trim())
                ? `${Object.values(prefill).filter((value) => value.trim()).length} filled`
                : 'None'
            }
            muted={!Object.values(prefill).some((value) => value.trim())}
            open={openPrefill}
            onToggle={() => setOpenPrefill((current) => !current)}
          >
            <div className="space-y-2">
              {fields.map((field) => (
                <div key={field.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-2">
                  <span className="truncate font-mono text-xs text-muted-foreground" title={field.label}>
                    {field.key}
                  </span>
                  <Input
                    aria-label={`Fill in ${field.label}`}
                    placeholder={field.type === 'hidden' ? field.defaultValue || 'e.g. instagram' : field.label}
                    value={prefill[field.key] ?? ''}
                    onChange={(event) => setPrefill((current) => ({ ...current, [field.key]: event.target.value }))}
                    className="h-9"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  aria-label="Link with answers"
                  readOnly
                  value={linkWithAnswers}
                  className="h-9 font-mono text-xs"
                  onFocus={(event) => event.target.select()}
                />
                <CopyButton onCopy={() => copyText(linkWithAnswers)} className="h-9 shrink-0" />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Hidden fields get their values this way — one link per campaign or per table. People can still change what they see.
            </p>
          </PickerRow>
        </div>
      </SettingsSection>

      <SettingsSection
        title="On your website"
        actions={
          <CopyButton onCopy={() => copyText(embedSnippet(publicUrl, form.publicId, form.name))} label="Copy snippet" className="h-9" />
        }
      >
        <InfoRow icon={Code} title="Paste where the form should appear" description="It sits on your page and grows to fit each step.">
          <span />
        </InfoRow>
        <CodeSnippet code={embedSnippet(publicUrl, form.publicId, form.name)} />
      </SettingsSection>

      <SettingsSection
        title="With your own code"
        description="Design the form yourself and send the answers to DUMA — it checks them against the live form, applies the logic and keeps them. No key needed to read or submit."
        actions={
          <SegmentedControl<Snippet>
            value={snippet}
            onChange={setSnippet}
            ariaLabel="Which call"
            options={[
              { value: 'read', label: 'Read' },
              { value: 'submit', label: 'Submit' },
              { value: 'responses', label: 'Responses' },
            ]}
          />
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <RowTile icon={snippet === 'responses' ? KeyRound : Braces} />
            <p className="min-w-0 text-sm">
              <span className="mr-2 rounded bg-band px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                {snippet === 'submit' ? 'POST' : 'GET'}
              </span>
              <span className="font-mono text-xs break-all text-muted-foreground">
                {snippet === 'responses'
                  ? `/v1/store/forms/${form.publicId}/responses`
                  : `/v1/forms/public/${form.publicId}${snippet === 'submit' ? '/responses' : ''}`}
              </span>
            </p>
          </div>
          <CodeSnippet code={code} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {snippet === 'read'
              ? 'The live questions in order — `page_break` splits steps, `logic` says when a question shows — and whether the form is taking responses.'
              : snippet === 'submit'
                ? 'Answers are keyed by each question’s API key. A refusal is a 400 listing each problem in `issues`, by key; 409 means the form has closed or is full.'
                : 'From your server only: a secret workspace key with the forms:read scope. Newest first; page with `before`, poll with `since`.'}{' '}
            {snippet === 'responses' && (
              <Link href="/settings/developers" className="underline underline-offset-2">
                Make a key in Settings → Developers
              </Link>
            )}
          </p>
        </div>
      </SettingsSection>
    </SettingsTabBody>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className="group relative mt-3">
      <pre className="max-h-80 overflow-auto rounded-md bg-sidebar px-4 py-3 font-mono text-xs leading-relaxed text-sidebar-foreground">
        <code>{code}</code>
      </pre>
      <CopyButton
        onCopy={() => copyText(code)}
        iconOnly
        className="absolute top-2 right-2 h-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
    </div>
  );
}
