'use client';

import Link from 'next/link';
import { useState } from 'react';

import { DateTimeField } from '@/components/cms/DateTimeField';
import { InfoRow, PickerRow } from '@/components/cms/rows';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Hash,
  Lock,
  Mail,
  MessageSquarePlus,
  Palette,
  Phone,
  Send,
  Type,
  UserRound,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { NumberStepper } from '@/components/shared/FormParts';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import type { FormDetail } from '@/lib/modules/forms/client';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/date';
import { type CustomerLink, type FormDefinition, type Problem, STANDING_LABELS, formPages, formStanding } from '@/lib/utils/forms';

import type { FormDraft } from './FormEditor';
import { STANDING_BADGE } from './FormsList';

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
  'w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60';

/**
 * A form's settings in the Booking rules layout: when it takes responses, what
 * happens after someone submits, whether respondents become customers, and
 * how it looks — each a row that says what it's set to and opens its control.
 * Beside them, the thank-you screen as respondents will see it, and where the
 * form stands.
 *
 * It edits the same draft as the builder; the SaveBar belongs to the editor.
 * Closing date and limit apply when saved; everything else when published.
 */
export function FormSettingsPanel({
  form,
  draft,
  onChange,
  readOnly,
  problems,
}: {
  form: FormDetail;
  draft: FormDraft;
  onChange: (next: FormDraft | ((current: FormDraft) => FormDraft)) => void;
  readOnly: boolean;
  problems: Problem[];
}) {
  const [open, setOpen] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  const definition = draft.definition;
  const setDefinition = (patch: Partial<FormDefinition>) =>
    onChange((current) => ({ ...current, definition: { ...current.definition, ...patch } }));
  const link: CustomerLink = definition.customerLink ?? { enabled: false };
  const setLink = (patch: Partial<CustomerLink>) => setDefinition({ customerLink: { ...link, ...patch } });

  const fields = definition.fields;
  const emails = fields.filter((field) => field.type === 'email');
  const texts = fields.filter((field) => field.type === 'short_text');
  const phones = fields.filter((field) => field.type === 'phone');
  const labelOf = (id: string | null | undefined) => fields.find((field) => field.id === id)?.label || null;
  const linkProblem = problems.find((problem) => problem.field.startsWith('customerLink'));
  const redirectProblem = problems.find((problem) => problem.field === 'redirectUrl');
  const steps = formPages(fields).length;
  const standing = formStanding({ ...form, responseCount: form.storedResponses ?? form.responseCount });

  const textRow = (
    row: Row,
    key: 'submitLabel' | 'successTitle' | 'redirectUrl',
    icon: typeof Type,
    title: string,
    fallback: string,
    hint: string,
    max: number,
  ) => (
    <PickerRow
      icon={icon}
      title={title}
      value={definition[key]?.trim() || fallback}
      muted={!definition[key]?.trim()}
      tone={key === 'redirectUrl' && redirectProblem ? 'danger' : undefined}
      open={open === row}
      onToggle={() => toggle(row)}
    >
      <Input
        aria-label={title}
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
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );
  const pickRow = (
    row: Row,
    key: 'emailFieldId' | 'nameFieldId' | 'phoneFieldId',
    icon: typeof Type,
    title: string,
    from: typeof fields,
    optional: boolean,
    hint: string,
  ) => (
    <PickerRow
      icon={icon}
      title={title}
      value={labelOf(link[key]) ?? (optional ? 'Not used' : 'Choose a question')}
      muted={!link[key]}
      tone={!optional && !link[key] ? 'warning' : undefined}
      open={open === row}
      onToggle={() => toggle(row)}
    >
      {from.length === 0 ? (
        <p className="text-xs text-muted-foreground">There’s no question of that kind on the form yet — add one in Build.</p>
      ) : (
        <Select
          value={link[key] ?? ''}
          ariaLabel={title}
          options={[
            ...(optional ? [{ value: '', label: 'Not used' }] : []),
            ...from.map((field) => ({ value: field.id, label: field.label || field.key })),
          ]}
          onValueChange={(value) => setLink({ [key]: value || null })}
        />
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <>
          <SettingsSection title="After they submit" description="What respondents see, in your colours.">
            <div
              className="rounded-lg border border-rule/50 bg-background px-5 py-6 text-center"
              style={{ '--form-accent': definition.accentColor || 'var(--primary)' } as React.CSSProperties}
            >
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-(--form-accent) text-white">
                <CheckCircle2 size={22} aria-hidden="true" />
              </span>
              <p className="mt-3 text-base font-semibold tracking-title text-foreground">
                {definition.successTitle?.trim() || 'Thank you!'}
              </p>
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
          </SettingsSection>
          <SettingsSection title="Where it stands" actions={<Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>}>
            <div className="space-y-3">
              <InfoRow icon={Send} title="Published">
                <span className="text-sm text-muted-foreground">
                  {form.publishedAt ? <RelativeTime iso={form.publishedAt} /> : 'Not yet'}
                </span>
              </InfoRow>
              <InfoRow icon={Users} title="Responses">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {form.storedResponses ?? form.responseCount}
                  {form.responseLimit ? ` of ${form.responseLimit}` : ''}
                </span>
              </InfoRow>
              {form.hasUnpublishedChanges && form.status !== 'draft' && (
                <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                  The live form is the last published version. Messages, look and the customer link change when you publish again.
                </p>
              )}
            </div>
          </SettingsSection>
        </>
      }
    >
      <SettingsSection title="Taking responses">
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
          <PickerRow
            icon={CalendarClock}
            title="Closes"
            value={draft.closesAt ? formatDateTime(draft.closesAt) : 'Never'}
            muted={!draft.closesAt}
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
              <Button variant="ghost" className="mt-2 h-8 text-xs" onClick={() => onChange((current) => ({ ...current, closesAt: null }))}>
                Don’t close on a date
              </Button>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">For an event’s sign-ups, say. Applies as soon as it’s saved.</p>
          </PickerRow>
          <PickerRow
            icon={Hash}
            title="Most responses"
            value={draft.responseLimit ? `${draft.responseLimit.toLocaleString('en-GB')}` : 'No limit'}
            muted={!draft.responseLimit}
            open={open === 'limit'}
            onToggle={() => toggle('limit')}
          >
            <InfoRow icon={Lock} title="Stop at a number">
              <Switch
                checked={draft.responseLimit !== null}
                onChange={(on) =>
                  onChange((current) => ({ ...current, responseLimit: on ? Math.max(form.storedResponses ?? 0, 0) + 50 : null }))
                }
                label="Stop at a number"
                disabled={readOnly}
              />
            </InfoRow>
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              Places for a tasting night, a giveaway’s entries. Two last submissions can’t both get in.
            </p>
          </PickerRow>
          <PickerRow
            icon={MessageSquarePlus}
            title="When it’s closed"
            value={definition.closedMessage?.trim() || 'This form is closed.'}
            muted={!definition.closedMessage?.trim()}
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
            <p className="mt-1.5 text-xs text-muted-foreground">Shown instead of the form once it’s closed, past its date or full.</p>
          </PickerRow>
        </fieldset>
      </SettingsSection>

      <SettingsSection title="After someone submits">
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
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
          <PickerRow
            icon={Type}
            title="Thank-you message"
            value={definition.successMessage?.trim() || 'Your response has been received.'}
            muted={!definition.successMessage?.trim()}
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
            <p className="mt-1.5 text-xs text-muted-foreground">Say what happens next — “we’ll reply within a day”.</p>
          </PickerRow>
          {textRow(
            'redirect',
            'redirectUrl',
            ExternalLink,
            'Then go to',
            'Stay on the thank-you',
            'Optional — your own page, a moment after the thank-you.',
            2000,
          )}
        </fieldset>
      </SettingsSection>

      <SettingsSection title="Customers">
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
          <InfoRow icon={UserRound} title="Save respondents as customers">
            <Switch
              checked={link.enabled}
              onChange={(enabled) =>
                setLink({ enabled, ...(enabled && !link.emailFieldId && emails.length === 1 ? { emailFieldId: emails[0]!.id } : {}) })
              }
              label="Save respondents as customers"
              disabled={readOnly}
            />
          </InfoRow>
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
          <Warning>
            {emails.length === 0 ? 'The form has no email question, so nobody can be matched — add one in Build.' : linkProblem.message}
          </Warning>
        )}
        {link.enabled && !linkProblem && (
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            Nothing a customer already has is overwritten. Each response links to their record in{' '}
            <Link href="/customers" className="underline underline-offset-2">
              Customers
            </Link>
            .
          </p>
        )}
      </SettingsSection>

      <SettingsSection title="Look">
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
          <PickerRow
            icon={Palette}
            title="Colour"
            value={definition.accentColor ?? 'Your brand’s'}
            muted={!definition.accentColor}
            open={open === 'accent'}
            onToggle={() => toggle('accent')}
            trailing={<Swatch colour={definition.accentColor} />}
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDefinition({ accentColor: null })}
                className={cn(
                  'h-8 rounded-md border px-2.5 text-xs font-medium',
                  !definition.accentColor ? 'border-foreground' : 'border-rule/70 hover:bg-band/50',
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
                  className={cn(
                    'size-8 rounded-full ring-offset-2 ring-offset-field transition-transform hover:scale-110',
                    definition.accentColor === colour && 'ring-2 ring-foreground',
                  )}
                />
              ))}
              <label className="relative flex h-8 items-center gap-1.5 rounded-md border border-rule/70 px-2.5 text-xs font-medium hover:bg-band/50">
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              Buttons, chosen answers and the progress bar. Pick one that white text reads well on.
            </p>
          </PickerRow>
          <InfoRow icon={Hash} title={steps > 1 ? 'Progress bar' : 'Progress bar (one step — not shown)'}>
            <Switch
              checked={definition.showProgress ?? true}
              onChange={(showProgress) => setDefinition({ showProgress })}
              label="Progress bar"
              disabled={readOnly}
            />
          </InfoRow>
        </fieldset>
      </SettingsSection>
    </SettingsTabBody>
  );
}

function Swatch({ colour }: { colour: string | null | undefined }) {
  return (
    <span aria-hidden="true" className="size-5 rounded-full border border-rule/60" style={{ background: colour || 'var(--primary)' }} />
  );
}

/** Something that stops a setting working, with where to fix it. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
