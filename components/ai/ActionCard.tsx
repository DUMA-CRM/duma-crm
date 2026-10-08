'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Check, Loader2, Plus, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from '@/components/icons';
import { useCurrencySymbol, useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { InlineChoice, InlineDate, InlineNumber, type InlineOption, InlineText } from '@/components/ui/inline-edit';

import type { AgentActionSubmission, AgentField, AgentPendingAction } from '@/lib/ai/agent-types';
import { cn } from '@/lib/utils/cn';

type FieldValue = string | number | null;
type Draft = { fields: Record<string, FieldValue>; lines: Array<{ id: string; values: Record<string, FieldValue> }> };

function initialDraft(action: AgentPendingAction): Draft {
  return {
    fields: Object.fromEntries(action.fields.map((field) => [field.key, field.value])),
    lines: (action.lineGroup?.lines ?? []).map((line) => ({
      id: line.id,
      values: Object.fromEntries(line.fields.map((field) => [field.key, field.value])),
    })),
  };
}

function asNumber(value: FieldValue) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: FieldValue) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function toOptions(field: AgentField): InlineOption[] {
  return (field.options ?? []).map(({ value, label, hint }) => ({ value, label, ...(hint ? { hint } : {}) }));
}

/** A field is answered when it has a value, or when it never needed one. */
function isAnswered(field: AgentField, value: FieldValue) {
  if (field.optional || field.readOnly) return true;
  if (field.type === 'number' || field.type === 'money') return value != null && value !== '';
  return Boolean(asText(value));
}

function FieldControl({ field, value, onChange }: { field: AgentField; value: FieldValue; onChange: (next: FieldValue) => void }) {
  const symbol = useCurrencySymbol();
  if (field.readOnly) {
    const textValue = asText(value);
    const label = field.type === 'select' ? field.options?.find((option) => option.value === textValue)?.label : textValue;
    return <span className="px-1.5 text-sm text-foreground">{label || '—'}</span>;
  }
  switch (field.type) {
    case 'select':
    case 'time':
      return (
        <InlineChoice
          value={asText(value)}
          options={toOptions(field)}
          onChange={onChange}
          ariaLabel={field.label}
          placeholder={field.optional ? 'None' : 'Choose…'}
        />
      );
    case 'money':
      return (
        <InlineNumber
          value={asNumber(value)}
          onChange={onChange}
          ariaLabel={field.label}
          prefix={symbol}
          money
          min={field.min}
          max={field.max}
          step={field.step ?? 0.01}
        />
      );
    case 'number':
      return (
        <InlineNumber
          value={asNumber(value)}
          onChange={onChange}
          ariaLabel={field.label}
          suffix={field.unit}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
        />
      );
    case 'date':
      return (
        <InlineDate
          value={asText(value)}
          onChange={onChange}
          ariaLabel={field.label}
          placeholder={field.optional ? 'Not set' : 'Pick a date'}
        />
      );
    default:
      return (
        <InlineText
          value={asText(value)}
          onChange={onChange}
          ariaLabel={field.label}
          multiline={field.type === 'textarea'}
          maxLength={field.type === 'textarea' ? 1_000 : 200}
          placeholder={field.placeholder ?? (field.optional ? 'None' : 'Add…')}
        />
      );
  }
}

export function ActionCard({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: AgentPendingAction;
  busy: boolean;
  onConfirm: (submission: AgentActionSubmission) => void;
  onCancel: () => void;
}) {
  const formatMoney = useFormatMoney();
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(action));
  const [adding, setAdding] = useState(false);
  const [drafted, setDrafted] = useState(action);

  // A new proposal from the agent replaces whatever was on screen. Adjusting
  // during render rather than in an effect keeps the card from flashing the
  // previous action's values.
  if (drafted !== action) {
    setDrafted(action);
    setDraft(initialDraft(action));
    setAdding(false);
  }

  const group = action.lineGroup;
  const critical = action.tone === 'critical';
  const pristine = useMemo(() => JSON.stringify(draft) === JSON.stringify(initialDraft(action)), [draft, action]);

  const visibleFields = action.fields.filter(
    (field) => !field.showWhen || asText(draft.fields[field.showWhen.field]) === field.showWhen.equals,
  );

  const total = useMemo(() => {
    if (!group?.total) return null;
    const [first, second] = group.total.multiply;
    return draft.lines.reduce((sum, line) => sum + asNumber(line.values[first]) * (second ? asNumber(line.values[second]) : 1), 0);
  }, [draft.lines, group]);

  const addOptions: InlineOption[] = (group?.options ?? [])
    .filter((option) => !draft.lines.some((line) => line.id === option.value))
    .map(({ value, label, hint }) => ({ value, label, ...(hint ? { hint } : {}) }));

  const missing = visibleFields.find((field) => !isAnswered(field, draft.fields[field.key]));
  const tooFewLines = Boolean(group && draft.lines.length < group.minLines);
  const blocked = Boolean(missing) || tooFewLines;

  const setField = (key: string, value: FieldValue) => setDraft((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));

  const setLineValue = (id: string, key: string, value: FieldValue) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, values: { ...line.values, [key]: value } } : line)),
    }));

  const addLine = (optionValue: string) => {
    const option = group?.options.find((candidate) => candidate.value === optionValue);
    if (!group || !option) return;
    setDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          id: option.value,
          values: Object.fromEntries(group.template.map((field) => [field.key, option.prefill?.[field.key] ?? field.value])),
        },
      ],
    }));
    setAdding(false);
  };

  const lineTitle = (id: string) =>
    group?.lines.find((line) => line.id === id)?.title ?? group?.options.find((option) => option.value === id)?.label ?? id;
  const lineSubtitle = (id: string) =>
    group?.lines.find((line) => line.id === id)?.subtitle ?? group?.options.find((option) => option.value === id)?.hint;

  return (
    <motion.section
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="mt-4 overflow-hidden rounded-lg border border-rule/70 bg-field shadow-sm"
      aria-label={`${action.title} awaiting approval`}
    >
      <header className="flex items-start justify-between gap-4 px-4 py-4">
        <div className="flex min-w-0 gap-3.5">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              critical ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
            )}
          >
            {critical ? <TriangleAlert size={17} aria-hidden="true" /> : <ShieldCheck size={17} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <p className={cn('text-label font-semibold uppercase tracking-label', critical ? 'text-exception' : 'text-primary')}>
              {critical ? 'Permanent change' : 'Approval required'}
            </p>
            <h3 className="mt-1 line-clamp-2 text-base font-semibold tracking-title text-foreground">{action.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{action.summary}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          {total != null && (
            <div className="rounded-md bg-background/70 px-2.5 py-2">
              <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                {group?.total?.format === 'currency' ? formatMoney(total, 2) : total.toLocaleString('en-GB')}
              </p>
              <p className="mt-0.5 text-label uppercase tracking-label text-muted-foreground">{group?.total?.label}</p>
            </div>
          )}
          {!pristine && (
            <button
              type="button"
              onClick={() => setDraft(initialDraft(action))}
              className="mt-2 inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-label font-semibold text-reference transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <RotateCcw size={11} aria-hidden="true" />
              Reset edits
            </button>
          )}
        </div>
      </header>

      {visibleFields.length > 0 && (
        <section className="border-t border-rule/40" aria-labelledby="request-details-heading">
          <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3.5">
            <h4 id="request-details-heading" className="text-label font-semibold uppercase tracking-label text-muted-foreground">
              Request details
            </h4>
            <span className="text-label text-muted-foreground">Select a value to edit</span>
          </div>
          <dl className="divide-y divide-rule/40 px-4 pb-1">
            {visibleFields.map((field) => (
              <div key={field.key} className={cn('gap-3 py-3', field.type === 'textarea' ? 'grid' : 'flex items-start justify-between')}>
                <dt className="min-w-0 pt-0.5 text-sm font-medium text-foreground">
                  {field.label}
                  {field.hint && <span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground">{field.hint}</span>}
                </dt>
                <dd className={cn('min-w-0 text-right', field.type === 'textarea' && 'text-left')}>
                  <FieldControl field={field} value={draft.fields[field.key] ?? null} onChange={(next) => setField(field.key, next)} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {group && (
        <section className="border-t border-rule/40 px-4 py-3.5" aria-labelledby="request-lines-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h4 id="request-lines-heading" className="text-label font-semibold uppercase tracking-label text-muted-foreground">
              {group.label}
            </h4>
            <span className="text-label text-muted-foreground">
              {draft.lines.length} of {group.maxLines}
            </span>
          </div>
          {draft.lines.length === 0 ? (
            <p className="mt-2 rounded-md border border-dashed border-rule/60 px-3 py-4 text-center text-xs leading-5 text-muted-foreground">
              {group.emptyLabel}
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-rule/40 overflow-hidden rounded-md border border-rule/50 bg-background/55">
              {draft.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{lineTitle(line.id)}</span>
                    {lineSubtitle(line.id) && (
                      <span className="mt-0.5 block truncate text-label text-muted-foreground">{lineSubtitle(line.id)}</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {group.template.map((field, index) => (
                      <span key={field.key} className="flex items-center gap-1">
                        {index > 0 && <span className="text-xs text-muted-foreground">×</span>}
                        <FieldControl
                          field={field}
                          value={line.values[field.key] ?? null}
                          onChange={(next) => setLineValue(line.id, field.key, next)}
                        />
                      </span>
                    ))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((row) => row.id !== line.id) }))}
                    aria-label={`Remove ${lineTitle(line.id)}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-exception/8 hover:text-exception focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft.lines.length < group.maxLines && addOptions.length > 0 && (
            <div className="pt-2.5">
              {adding ? (
                <InlineChoice
                  value=""
                  options={addOptions}
                  onChange={addLine}
                  ariaLabel={group.addLabel}
                  placeholder={group.addLabel}
                  align="start"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rule bg-field px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Plus size={12} aria-hidden="true" />
                  {group.addLabel}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <footer className="border-t border-rule/40 bg-background/45 px-4 py-3.5">
        {/* The header already carries the tile and what this does — the footer adds only the note. */}
        <p className="text-xs leading-5 text-muted-foreground">{action.note}</p>
        {blocked && (
          <div
            className="mt-3 flex items-start gap-2 rounded-md border border-exception/25 bg-exception/5 px-3 py-2 text-xs text-exception"
            role="status"
          >
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{tooFewLines ? `Add at least ${group?.minLines} item to continue.` : `${missing?.label} still needs a value.`}</span>
          </div>
        )}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-rule/40 pt-3.5">
          <span className="max-w-44 text-label leading-4 text-muted-foreground">
            {pristine ? 'Nothing changes until you confirm.' : 'Your edits will be used when you confirm.'}
          </span>
          <span className="ml-auto flex gap-2">
            <Button size="default" variant="outline" onClick={onCancel} disabled={busy}>
              Not now
            </Button>
            <Button
              size="default"
              variant={critical ? 'destructive' : 'default'}
              disabled={busy || blocked}
              onClick={() =>
                onConfirm({ approvalToken: action.approvalToken ?? '', fields: draft.fields, lines: group ? draft.lines : undefined })
              }
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {busy ? 'Working…' : action.confirmLabel}
            </Button>
          </span>
        </div>
      </footer>
    </motion.section>
  );
}
