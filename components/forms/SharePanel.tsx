'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { ExternalLink, EyeOff, Link2, Share2 } from '@/components/icons';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, ValueMissing } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { CopyButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import type { FormDetail } from '@/lib/modules/forms/client';
import { cn } from '@/lib/utils/cn';
import { apiSnippets, embedSnippet, formStanding, isInputField, prefillUrl } from '@/lib/utils/forms';

/** The API as websites reach it — the same origin the Developers reference documents. */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

type Snippet = 'read' | 'submit' | 'responses';

/**
 * Everywhere the form can go, as two stacks of titled cards: its link (and a
 * link that fills answers in) and QR code | the snippet for a website and the
 * API calls for your own code. Everything here is the published form — a
 * draft has no link yet.
 */
export function SharePanel({
  form,
  publicUrl,
  onPublish,
  publishing,
  stacked = false,
}: {
  form: FormDetail;
  publicUrl: string;
  onPublish?: () => void;
  publishing: boolean;
  /** One column, for the Share sheet. */
  stacked?: boolean;
}) {
  const live = form.publishedDefinition;
  const standing = formStanding({ ...form, responseCount: form.storedResponses ?? form.responseCount });
  const fields = useMemo(() => (live?.fields ?? []).filter(isInputField), [live]);
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [openPrefill, setOpenPrefill] = useState(false);
  const [snippet, setSnippet] = useState<Snippet>('submit');

  if (!live) {
    return (
      <EmptyState
        className="flex-1"
        icon={Share2}
        title="Not published yet"
        description="Publish the form to get its link and QR code, a snippet for your website and an address your own code can send answers to."
        action={
          onPublish
            ? {
                label: publishing ? 'Publishing…' : 'Publish',
                onClick: () => {
                  if (!publishing) onPublish();
                },
              }
            : undefined
        }
      />
    );
  }

  const filled = Object.values(prefill).filter((value) => value.trim()).length;
  const linkWithAnswers = prefillUrl(publicUrl, prefill);
  const api = apiSnippets(API_ORIGIN, form.publicId, live.fields);
  const responsesCall = `curl ${API_ORIGIN}/v1/store/forms/${form.publicId}/responses \\\n  -H "Authorization: Bearer dk_sec_…"`;
  const code = snippet === 'read' ? api.read : snippet === 'submit' ? api.submit : responsesCall;
  const embed = embedSnippet(publicUrl, form.publicId, form.name);
  const taking = standing === 'live' || standing === 'scheduled_close';

  return (
    <SettingsTabBody>
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className={cn('grid items-start gap-5', !stacked && 'xl:grid-cols-2')}>
        <div className="flex min-w-0 flex-col gap-5">
          <RecordGroup
            card
            id="form-share-link"
            title="Link"
            footnote={taking ? undefined : 'The link works, but the form isn’t taking responses — it shows your closed message.'}
          >
            <ChangeRow
              icon={Link2}
              label="Form link"
              value={<span className="truncate font-mono text-xs font-medium">{publicUrl.replace(/^https?:\/\//, '')}</span>}
              trailing={
                <>
                  <CopyButton onCopy={() => copyText(publicUrl)} iconOnly label="Copy the link" className="size-8" />
                  <Button asChild variant="outline" size="icon-sm" aria-label="Open the form">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </Button>
                </>
              }
            />
            <ChangeRow
              icon={EyeOff}
              label="Link with answers"
              value={filled > 0 ? `${filled} filled in` : <ValueMissing>None filled in</ValueMissing>}
              verbs={['Build', 'Close']}
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
            </ChangeRow>
          </RecordGroup>

          <RecordGroup card id="form-share-qr" title="QR code">
            <PublicQrCodeCard url={publicUrl} locationName={form.name} purpose="form" downloadPrefix="form" />
          </RecordGroup>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <RecordGroup
            card
            id="form-share-embed"
            title="On your website"
            actions={<CopyButton onCopy={() => copyText(embed)} label="Copy snippet" size="sm" />}
            footnote="Paste it where the form should appear. It grows to fit each step."
          >
            <CodeSnippet code={embed} />
          </RecordGroup>

          <RecordGroup
            card
            id="form-share-api"
            title="With your own code"
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
            footnote={
              snippet === 'read' ? (
                'The live questions in order — `page_break` splits steps, `logic` says when a question shows — and whether the form is taking responses. No key needed.'
              ) : snippet === 'submit' ? (
                'Answers are keyed by each question’s API key; DUMA checks them against the live form and applies the logic. A refusal is a 400 listing each problem in `issues`, by key; 409 means the form has closed or is full. No key needed.'
              ) : (
                <>
                  From your server only: a secret workspace key with the forms:read scope. Newest first; page with `before`, poll with
                  `since`.{' '}
                  <Link href="/settings/developers" className="underline underline-offset-2">
                    Make a key in Settings → Developers
                  </Link>
                </>
              )
            }
          >
            <p className="flex min-w-0 items-baseline gap-2 text-sm">
              <span className="shrink-0 rounded bg-band px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                {snippet === 'submit' ? 'POST' : 'GET'}
              </span>
              <span className="min-w-0 font-mono text-xs break-all text-muted-foreground">
                {snippet === 'responses'
                  ? `/v1/store/forms/${form.publicId}/responses`
                  : `/v1/forms/public/${form.publicId}${snippet === 'submit' ? '/responses' : ''}`}
              </span>
            </p>
            <div className="mt-3">
              <CodeSnippet code={code} />
            </div>
          </RecordGroup>
        </div>
      </div>
    </SettingsTabBody>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className="group relative">
      <pre className="max-h-80 overflow-auto rounded-md bg-panel px-4 py-3 font-mono text-xs leading-relaxed text-panel-foreground">
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
