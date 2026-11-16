'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DateTimeField } from '@/components/cms/DateTimeField';
import { RowWarning } from '@/components/cms/rows';
import {
  BarChart3,
  CalendarClock,
  Check,
  CheckCircle2,
  ExternalLink,
  Hash,
  type IconComponent,
  Mail,
  MessageSquarePlus,
  Palette,
  Phone,
  Send,
  Type,
  UserRound,
} from '@/components/icons';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { NumberStepper } from '@/components/shared/FormParts';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import type { FormDetail } from '@/lib/modules/forms/client';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import type { FormDraft } from '@/lib/utils/form-draft';
import { type CustomerLink, type FormDefinition, type Problem, formPages } from '@/lib/utils/forms';

type Row =
  | 'closesAt'
  | 'limit'
  | 'closedMessage'
  | 'submitLabel'
  | 'successTitle'
  | 'successMessage'
  | 'redirect'
  | 'email'
  | 'name'
  | 'phone'
  | 'accent';

/** Colours that read well behind white button text. */
const ACCENTS = ['#2b2a28', '#b84e2d', '#2b7355', '#2563eb', '#7c3aed', '#be185d', '#0e7490', '#a16207'];

const textarea =
  'w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:opacity-60';

const hint = 'mt-1.5 text-xs text-muted-foreground';

/**
 * A form's settings in the Settings → Account layout: two stacks of titled
 * cards — Taking responses · Look | After someone submits · Customers — each
 * row saying what it's set to, with Change opening its control in place and
 * Cancel putting the value back. The rail is the thank-you screen as
 * respondents will see it, drawn from the unsaved draft.
 *
 * It edits the same draft as the builder, which saves itself. `stacked` is the
 * Settings drawer: one column, the thank-you preview under its section.
 */
export function FormSettingsPanel({
  form,
  draft,
  onChange,
  readOnly,
  problems,
  live = false,
  stacked = false,
}: {
  form: FormDetail;
  draft: FormDraft;
  onChange: (next: FormDraft | ((current: FormDraft) => FormDraft)) => void;
  readOnly: boolean;
  problems: Problem[];
  /** Published before: respondents see changes here once they're published. */
  live?: boolean;
  /** One column, for the Settings drawer. */
  stacked?: boolean;
}) {
  const [open, setOpen] = useState<Row | null>(null);
  // The draft as it was when the open row opened, so Cancel can put that one value back.
  const [before, setBefore] = useState<FormDraft | null>(null);
  const definition = draft.definition;
  const setDefinition = (patch: Partial<FormDefinition>) =>
    onChange((current) => ({ ...current, definition: { ...current.definition, ...patch } }));
  const link: CustomerLink = definition.customerLink ?? { enabled: false };
  const setLink = (patch: Partial<CustomerLink>) =>
    onChange((current) => ({
      ...current,
      definition: { ...current.definition, customerLink: { ...(current.definition.customerLink ?? { enabled: false }), ...patch } },
    }));

  const restore = (row: Row, was: FormDraft) => {
    const old = was.definition;
    if (row === 'closesAt') onChange((current) => ({ ...current, closesAt: was.closesAt }));
    else if (row === 'limit') onChange((current) => ({ ...current, responseLimit: was.responseLimit }));
    else if (row === 'closedMessage') setDefinition({ closedMessage: old.closedMessage });
    else if (row === 'submitLabel') setDefinition({ submitLabel: old.submitLabel });
    else if (row === 'successTitle') setDefinition({ successTitle: old.successTitle });
    else if (row === 'successMessage') setDefinition({ successMessage: old.successMessage });
    else if (row === 'redirect') setDefinition({ redirectUrl: old.redirectUrl });
    else if (row === 'accent') setDefinition({ accentColor: old.accentColor });
    else if (row === 'email') setLink({ emailFieldId: old.customerLink?.emailFieldId ?? null });
    else if (row === 'name') setLink({ nameFieldId: old.customerLink?.nameFieldId ?? null });
    else if (row === 'phone') setLink({ phoneFieldId: old.customerLink?.phoneFieldId ?? null });
  };
  const toggle = (row: Row) => {
    if (open === row) {
      if (before) restore(row, before);
      setOpen(null);
      return;
    }
    setBefore(draft);
    setOpen(row);
  };

  const fields = definition.fields;
  const emails = fields.filter((field) => field.type === 'email');
  const texts = fields.filter((field) => field.type === 'short_text');
  const phones = fields.filter((field) => field.type === 'phone');
  const labelOf = (id: string | null | undefined) => fields.find((field) => field.id === id)?.label || null;
  const linkProblem = problems.find((problem) => problem.field.startsWith('customerLink'));
  const redirectProblem = problems.find((problem) => problem.field === 'redirectUrl');
  const steps = formPages(fields).length;

  /** What it says now, or the default respondents get, quietly. */
  const written = (text: string | null | undefined, fallback: string) =>
    text?.trim() ? <span className="truncate">{text.trim()}</span> : <ValueMissing>{fallback}</ValueMissing>;

  const textRow = (
    row: Row,
    key: 'submitLabel' | 'successTitle' | 'redirectUrl',
    icon: IconComponent,
    label: string,
    fallback: string,
    note: string,
    max: number,
  ) => (
    <ChangeRow
      icon={icon}
      label={label}
      value={
        <>
          {written(key === 'redirectUrl' ? definition.redirectUrl?.replace(/^https?:\/\//, '') : definition[key], fallback)}
          {key === 'redirectUrl' && redirectProblem && <ValueAside>· needs fixing</ValueAside>}
        </>
      }
      open={open === row}
      onToggle={() => toggle(row)}
    >
      <Input
        aria-label={label}
        value={definition[key] ?? ''}
        maxLength={max}
        autoFocus
        type={key === 'redirectUrl' ? 'url' : 'text'}
        placeholder={key === 'redirectUrl' ? 'https://yoursite.com/thanks' : fallback}
        error={key === 'redirectUrl' ? redirectProblem?.message : undefined}
        onChange={(event) =>
          setDefinition({ [key]: key === 'redirectUrl' ? event.target.value.trim() || null : event.target.value || undefined })
        }
      />
      <p className={hint}>{note}</p>
    </ChangeRow>
  );
  const pickRow = (
    row: Row,
    key: 'emailFieldId' | 'nameFieldId' | 'phoneFieldId',
    icon: IconComponent,
    label: string,
    from: typeof fields,
    optional: boolean,
    note: string,
  ) => (
    <ChangeRow
      icon={icon}
      label={label}
      value={
        labelOf(link[key]) ? (
          <span className="truncate">{labelOf(link[key])}</span>
        ) : (
          <ValueMissing>{optional ? 'Not used' : 'Choose a question'}</ValueMissing>
        )
      }
      open={open === row}
      onToggle={() => toggle(row)}
    >
      {from.length === 0 ? (
        <p className="text-xs text-muted-foreground">There’s no question of that kind on the form yet.</p>
      ) : (
        <Select
          value={link[key] ?? ''}
          ariaLabel={label}
          options={[
            ...(optional ? [{ value: '', label: 'Not used' }] : []),
            ...from.map((field) => ({ value: field.id, label: field.label || field.key })),
          ]}
          onValueChange={(value) => setLink({ [key]: value || null })}
        />
      )}
      <p className={hint}>{note}</p>
    </ChangeRow>
  );

  const takingResponses = (
    <RecordGroup
      card
      id="form-settings-taking"
      title="Taking responses"
      footnote={live ? 'Respondents see changes here once you publish them.' : undefined}
    >
      <fieldset disabled={readOnly} className="min-w-0">
        <ChangeRow
          icon={CalendarClock}
          label="Closes"
          value={draft.closesAt ? formatDateTime(draft.closesAt) : <ValueMissing>Never</ValueMissing>}
          open={open === 'closesAt'}
          onToggle={() => toggle('closesAt')}
        >
          <DateTimeField
            label="Stop taking responses at"
            value={draft.closesAt}
            onChange={(iso) => onChange((current) => ({ ...current, closesAt: iso || null }))}
            min={new Date().toISOString().slice(0, 10)}
          />
          {draft.closesAt && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onChange((current) => ({ ...current, closesAt: null }))}>
              Don’t close on a date
            </Button>
          )}
        </ChangeRow>
        <ChangeRow
          icon={Hash}
          label="Most responses"
          value={
            draft.responseLimit ? (
              <>
                {draft.responseLimit.toLocaleString('en-GB')}
                <ValueAside>· {(form.storedResponses ?? form.responseCount).toLocaleString('en-GB')} so far</ValueAside>
              </>
            ) : (
              <ValueMissing>No limit</ValueMissing>
            )
          }
          open={open === 'limit'}
          onToggle={() => toggle('limit')}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Stop at a number</span>
            <Switch
              checked={draft.responseLimit !== null}
              onChange={(on) =>
                onChange((current) => ({ ...current, responseLimit: on ? Math.max(form.storedResponses ?? 0, 0) + 50 : null }))
              }
              label="Stop at a number"
              disabled={readOnly}
            />
          </div>
          {draft.responseLimit !== null && (
            <div className="mt-3">
              <NumberStepper
                label="Most responses"
                value={draft.responseLimit}
                min={1}
                max={1_000_000}
                step={10}
                unit="responses"
                onChange={(next) => onChange((current) => ({ ...current, responseLimit: next }))}
              />
            </div>
          )}
          <p className={hint}>Two last submissions can’t both get in.</p>
        </ChangeRow>
        <ChangeRow
          icon={MessageSquarePlus}
          label="When it’s closed"
          value={written(definition.closedMessage, 'This form is closed.')}
          open={open === 'closedMessage'}
          onToggle={() => toggle('closedMessage')}
        >
          <textarea
            aria-label="Message when closed"
            rows={3}
            autoFocus
            maxLength={500}
            value={definition.closedMessage ?? ''}
            onChange={(event) => setDefinition({ closedMessage: event.target.value || undefined })}
            placeholder="Sign-ups for the tasting night are full — see you next month!"
            className={textarea}
          />
          <p className={hint}>Shown instead of the form once it’s closed, past its date or full.</p>
        </ChangeRow>
      </fieldset>
    </RecordGroup>
  );

  const look = (
    <RecordGroup card id="form-settings-look" title="Look">
      <fieldset disabled={readOnly} className="min-w-0">
        <ChangeRow
          icon={Palette}
          label="Colour"
          value={
            <>
              <Swatch colour={definition.accentColor} />
              {definition.accentColor ? (
                <span className="font-mono text-xs">{definition.accentColor}</span>
              ) : (
                <ValueMissing>Your brand’s</ValueMissing>
              )}
            </>
          }
          open={open === 'accent'}
          onToggle={() => toggle('accent')}
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={!definition.accentColor}
              onClick={() => setDefinition({ accentColor: null })}
              className={cn(
                'h-8 rounded-md border border-border px-2.5 text-xs font-medium transition-colors',
                !definition.accentColor ? 'bg-band text-foreground' : 'text-muted-foreground hover:bg-band/50',
              )}
            >
              Default
            </button>
            {ACCENTS.map((colour) => (
              <button
                key={colour}
                type="button"
                aria-label={`Use ${colour}`}
                aria-pressed={definition.accentColor === colour}
                onClick={() => setDefinition({ accentColor: colour })}
                style={{ background: colour }}
                className="flex size-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {definition.accentColor === colour && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
            <label className="relative flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-band/50">
              Custom
              <input
                type="color"
                aria-label="Custom colour"
                value={definition.accentColor ?? '#2b2a28'}
                onChange={(event) => setDefinition({ accentColor: event.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          <p className={hint}>Buttons, chosen answers and the progress bar. Pick one that white text reads well on.</p>
        </ChangeRow>
        <ChangeRow
          icon={BarChart3}
          label="Progress bar"
          value={
            (definition.showProgress ?? true) ? (
              <>
                Shown
                {steps <= 1 && <ValueAside>· one step, so hidden</ValueAside>}
              </>
            ) : (
              <ValueMissing>Hidden</ValueMissing>
            )
          }
          trailing={
            <Switch
              checked={definition.showProgress ?? true}
              onChange={(showProgress) => setDefinition({ showProgress })}
              label="Progress bar"
              disabled={readOnly}
            />
          }
        />
      </fieldset>
    </RecordGroup>
  );

  const afterSubmit = (
    <RecordGroup card id="form-settings-after" title="After someone submits">
      <fieldset disabled={readOnly} className="min-w-0">
        {textRow('submitLabel', 'submitLabel', Send, 'Button', 'Submit', 'The words on the last button.', 60)}
        {textRow(
          'successTitle',
          'successTitle',
          CheckCircle2,
          'Thank-you heading',
          'Thank you!',
          'The first thing they read once it’s sent.',
          120,
        )}
        <ChangeRow
          icon={Type}
          label="Thank-you message"
          value={written(definition.successMessage, 'Your response has been received.')}
          open={open === 'successMessage'}
          onToggle={() => toggle('successMessage')}
        >
          <textarea
            aria-label="Thank-you message"
            rows={3}
            autoFocus
            maxLength={2000}
            value={definition.successMessage ?? ''}
            onChange={(event) => setDefinition({ successMessage: event.target.value || undefined })}
            className={textarea}
          />
          <p className={hint}>Say what happens next — “we’ll reply within a day”.</p>
        </ChangeRow>
        {textRow(
          'redirect',
          'redirectUrl',
          ExternalLink,
          'Then go to',
          'Stay on the thank-you',
          'Your own page, a moment after the thank-you.',
          2000,
        )}
      </fieldset>
    </RecordGroup>
  );

  const customers = (
    <RecordGroup
      card
      id="form-settings-customers"
      title="Customers"
      footnote={
        link.enabled ? (
          <>
            Nothing a customer already has is overwritten. Each response links to their record in{' '}
            <Link href="/customers" className="underline underline-offset-2">
              Customers
            </Link>
            .
          </>
        ) : undefined
      }
    >
      <fieldset disabled={readOnly} className="min-w-0">
        <ChangeRow
          icon={UserRound}
          label="Save respondents as customers"
          value={link.enabled ? 'On' : <ValueMissing>Off</ValueMissing>}
          trailing={
            <Switch
              checked={link.enabled}
              onChange={(enabled) =>
                setLink({ enabled, ...(enabled && !link.emailFieldId && emails.length === 1 ? { emailFieldId: emails[0]!.id } : {}) })
              }
              label="Save respondents as customers"
              disabled={readOnly}
            />
          }
        />
        {link.enabled && (
          <>
            {pickRow(
              'email',
              'emailFieldId',
              Mail,
              'Email from',
              emails,
              false,
              'Matched to a customer with this email, or added as a new one.',
            )}
            {pickRow('name', 'nameFieldId', UserRound, 'Name from', texts, true, 'Fills in a new customer’s first and last name.')}
            {pickRow('phone', 'phoneFieldId', Phone, 'Phone from', phones, true, 'Added to a customer who has no phone number yet.')}
          </>
        )}
      </fieldset>
      {link.enabled && linkProblem && (
        <RowWarning className="mt-4">
          {emails.length === 0 ? 'The form has no email question, so nobody can be matched.' : linkProblem.message}
        </RowWarning>
      )}
    </RecordGroup>
  );

  if (stacked)
    return (
      <div className="flex flex-col gap-5">
        {takingResponses}
        {afterSubmit}
        <ThankYouPreview definition={definition} />
        {customers}
        {look}
      </div>
    );

  return (
    <SettingsTabBody narrowAside stickyAside aside={<ThankYouPreview definition={definition} />}>
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          {takingResponses}
          {look}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {afterSubmit}
          {customers}
        </div>
      </div>
    </SettingsTabBody>
  );
}

/** The thank-you screen in the form's colour, from the unsaved draft — the one thing these settings draw. */
function ThankYouPreview({ definition }: { definition: FormDefinition }) {
  return (
    <RecordGroup id="form-settings-preview" title="Thank-you screen">
      <div
        className="rounded-lg border border-border bg-card px-5 py-8 text-center shadow-sm"
        style={{ '--form-accent': definition.accentColor || 'var(--primary)' } as React.CSSProperties}
      >
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-(--form-accent) text-white">
          <CheckCircle2 size={22} aria-hidden="true" />
        </span>
        <p className="mt-3 text-base font-semibold tracking-title text-foreground">{definition.successTitle?.trim() || 'Thank you!'}</p>
        <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
          {definition.successMessage?.trim() || 'Your response has been received.'}
        </p>
        {definition.redirectUrl && (
          <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink size={11} aria-hidden="true" />
            then on to {definition.redirectUrl.replace(/^https?:\/\//, '')}
          </p>
        )}
      </div>
    </RecordGroup>
  );
}

function Swatch({ colour }: { colour: string | null | undefined }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border border-border"
      style={{ background: colour || 'var(--primary)' }}
    />
  );
}
