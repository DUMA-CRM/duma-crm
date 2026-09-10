'use client';

import { useMemo, useState } from 'react';

import { Check, Loader2, Plus, RotateCcw, Trash2, TriangleAlert } from '@/components/icons';
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

function money(value: number) {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          prefix="£"
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
    <section
      className={cn('mt-4 rounded-md border bg-field', critical ? 'border-exception/55' : 'border-stock/60')}
      aria-label={`${action.title} awaiting approval`}
    >
      <header
        className={cn(
          'flex items-start justify-between gap-3 border-b px-3.5 py-3',
          critical ? 'border-exception/25 bg-exception/5' : 'border-stock/25 bg-stock/5',
        )}
      >
        <div className="min-w-0">
          <p className={cn('text-label uppercase tracking-wide', critical ? 'text-exception' : 'text-stock')}>
            {critical ? 'Approval required · destructive' : 'Approval required'}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{action.title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{action.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          {total != null && (
            <>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {group?.total?.format === 'currency' ? money(total) : total.toLocaleString('en-GB')}
              </p>
              <p className="text-label text-muted-foreground">{group?.total?.label}</p>
            </>
          )}
          {!pristine && (
            <button
              type="button"
              onClick={() => setDraft(initialDraft(action))}
              className="mt-1 inline-flex items-center gap-1 text-label font-semibold text-measured hover:underline"
            >
              <RotateCcw size={11} aria-hidden="true" />
              Reset edits
            </button>
          )}
        </div>
      </header>

      <dl className="divide-y divide-divider px-3.5">
        {visibleFields.map((field) => (
          <div key={field.key} className="flex items-start justify-between gap-3 py-2">
            <dt className="pt-1 text-xs text-muted-foreground">
              {field.label}
              {field.hint && <span className="mt-0.5 block text-label leading-4 text-muted-foreground/80">{field.hint}</span>}
            </dt>
            <dd className={cn('min-w-0 text-right', field.type === 'textarea' && 'flex-1')}>
              <FieldControl field={field} value={draft.fields[field.key] ?? null} onChange={(next) => setField(field.key, next)} />
            </dd>
          </div>
        ))}
      </dl>

      {group && (
        <div className="border-t border-divider px-3.5 py-2">
          <p className="text-label uppercase tracking-wide text-muted-foreground">{group.label}</p>
          {draft.lines.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">{group.emptyLabel}</p>
          ) : (
            <ul className="mt-1 divide-y divide-divider">
              {draft.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{lineTitle(line.id)}</span>
                    {lineSubtitle(line.id) && (
                      <span className="block truncate text-label text-muted-foreground">{lineSubtitle(line.id)}</span>
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
                    className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-exception/10 hover:text-exception focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {draft.lines.length < group.maxLines && addOptions.length > 0 && (
            <div className="pb-1 pt-1.5">
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
                  className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-xs font-semibold text-measured transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <Plus size={12} aria-hidden="true" />
                  {group.addLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-divider px-3.5 py-3">
        <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
          {critical && <TriangleAlert size={13} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />}
          <span>{action.note}</span>
        </p>
        {blocked && (
          <p className="mt-2 text-xs text-exception" role="status">
            {tooFewLines ? `Add at least ${group?.minLines} item to continue.` : `${missing?.label} still needs a value.`}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-label text-muted-foreground">{pristine ? 'As DUMA proposed it' : 'Edited by you'}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={critical ? 'destructive' : 'default'}
              disabled={busy || blocked}
              onClick={() =>
                onConfirm({ approvalToken: action.approvalToken ?? '', fields: draft.fields, lines: group ? draft.lines : undefined })
              }
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              {action.confirmLabel}
            </Button>
          </span>
        </div>
      </footer>
    </section>
  );
}
