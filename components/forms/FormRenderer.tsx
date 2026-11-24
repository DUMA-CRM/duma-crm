'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, Star } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { accentInk } from '@/lib/utils/form-accent';
import {
  type Answer,
  type Answers,
  type FormField,
  formPages,
  isInputField,
  pageProblems,
  ratingMax,
  scaleRange,
  submissionAnswers,
  visibleFieldIds,
} from '@/lib/utils/forms';

/** What a respondent sees — the public API's shape, which the builder's preview mimics. */
export interface RenderableForm {
  name: string;
  description?: string | null;
  fields: FormField[];
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  redirectUrl?: string | null;
  showProgress: boolean;
  accentColor?: string | null;
}

export interface SubmitResult {
  successTitle: string;
  successMessage: string;
  redirectUrl: string | null;
}

/**
 * A form, filled in: one page at a time (page breaks split it), questions shown
 * or hidden by their logic as answers change, each page checked before the
 * next. The API checks everything again on submit; anything it refuses comes
 * back against its question, on the page that holds it.
 *
 * Used by the hosted page and by the builder's preview (`preview`: nothing is
 * sent, the thank-you screen shows and no redirect happens).
 */
export function FormRenderer({
  form,
  initialAnswers = {},
  onSubmit,
  preview = false,
  hideHeader = false,
}: {
  form: RenderableForm;
  initialAnswers?: Answers;
  onSubmit: (answers: Record<string, Answer>, honeypot: string) => Promise<SubmitResult>;
  preview?: boolean;
  /** The page shows the form's name itself. */
  hideHeader?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [pageIndex, setPageIndex] = useState(0);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmitResult | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const split = formPages(form.fields.filter((field) => field.type !== 'hidden'));
    return split.length ? split : [[]];
  }, [form.fields]);
  const visible = useMemo(() => visibleFieldIds(form.fields, answers), [form.fields, answers]);
  // A page whose every question is hidden is skipped.
  const shownPages = pages.map((page) => page.some((field) => visible.has(field.id)));
  const page = pages[Math.min(pageIndex, pages.length - 1)]!;
  const lastPage = shownPages.lastIndexOf(true);
  const isLast = pageIndex >= lastPage;
  const visiblePageCount = shownPages.filter(Boolean).length;
  const step = shownPages.slice(0, pageIndex + 1).filter(Boolean).length;
  const accent = form.accentColor || 'var(--primary)';
  // White or near-black on the accent, whichever reads; a pale accent would fail AA with white.
  const ink = accentInk(form.accentColor);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (done) doneHeading.current?.focus({ preventScroll: true });
  }, [done]);

  const set = (field: FormField, value: Answer | undefined) => {
    setAnswers((current) => {
      const next = { ...current };
      if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) delete next[field.id];
      else next[field.id] = value;
      return next;
    });
    if (problems[field.id])
      setProblems((current) => {
        const rest = { ...current };
        delete rest[field.id];
        return rest;
      });
  };

  const scrollTop = () => top.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });

  const goTo = (index: number) => {
    setPageIndex(index);
    setFormError(null);
    scrollTop();
  };

  const next = async () => {
    const found = pageProblems(page, form.fields, answers);
    if (Object.keys(found).length) {
      setProblems(found);
      document.getElementById(`field-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    if (!isLast) {
      const following = shownPages.findIndex((shown, index) => shown && index > pageIndex);
      goTo(following === -1 ? pageIndex + 1 : following);
      return;
    }
    // Every page, in case an earlier answer changed what a later page needs.
    const all = pages.flatMap((entry) => Object.entries(pageProblems(entry, form.fields, answers)));
    if (all.length) {
      setProblems(Object.fromEntries(all));
      const firstPage = pages.findIndex((entry) => entry.some((field) => field.id === all[0]![0]));
      if (firstPage >= 0) goTo(firstPage);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await onSubmit(submissionAnswers(form.fields, answers), honeypot.current?.value ?? '');
      setDone(result);
      scrollTop();
      if (!preview && result.redirectUrl) window.setTimeout(() => window.location.assign(result.redirectUrl!), 1200);
    } catch (error) {
      if (error instanceof ApiError && error.issues.length) {
        // The API names questions by their API key.
        const byKey = new Map(form.fields.map((field) => [field.key, field.id]));
        const mapped = Object.fromEntries(
          error.issues.flatMap((issue) => (byKey.has(issue.field) ? [[byKey.get(issue.field)!, issue.message]] : [])),
        );
        setProblems(mapped);
        const firstPage = pages.findIndex((entry) => entry.some((field) => field.id in mapped));
        if (firstPage >= 0) goTo(firstPage);
        setFormError(Object.keys(mapped).length ? null : error.message);
      } else {
        setFormError(error instanceof Error ? error.message : 'Your answers weren’t sent. Check your connection, then send them again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const style = { '--form-accent': accent, '--form-ink': ink } as React.CSSProperties;
  const anyRequired = form.fields.some((field) => field.required && isInputField(field) && field.type !== 'hidden');

  if (done) {
    return (
      <div ref={top} style={style} className="scroll-mt-6 py-8 text-center sm:py-10">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 20 } }}
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-(--form-accent) text-(--form-ink)"
        >
          <Check size={24} strokeWidth={2.5} aria-hidden="true" />
        </motion.div>
        {/* Focused on arrival, so a screen reader says the response went. */}
        <h2 ref={doneHeading} tabIndex={-1} className="mt-5 text-2xl font-semibold tracking-title text-heading outline-none">
          {done.successTitle}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-base leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">
          {done.successMessage}
        </p>
        {done.redirectUrl && !preview && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Taking you onwards…
          </p>
        )}
        {done.redirectUrl && preview && <p className="mt-4 text-xs text-muted-foreground">Live, this goes on to {done.redirectUrl}</p>}
        {(!done.redirectUrl || preview) && (
          <Button
            variant="outline"
            className="mt-6 h-11 px-4"
            onClick={() => {
              setDone(null);
              setAnswers(initialAnswers);
              setPageIndex(0);
              setProblems({});
            }}
          >
            {preview ? 'Start the preview again' : 'Send another response'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={top} style={style} className="scroll-mt-6">
      {!hideHeader && (
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-title text-balance text-heading sm:text-[1.75rem]">{form.name}</h1>
          {form.description && (
            <p className="mt-2 text-base leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">{form.description}</p>
          )}
        </header>
      )}

      {form.showProgress && visiblePageCount > 1 && (
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Step {step} of {visiblePageCount}
          </p>
          <div className="h-1 overflow-hidden rounded-full bg-band" aria-hidden="true">
            <motion.div
              className="h-full rounded-full bg-(--form-accent)"
              initial={false}
              animate={{ width: `${(step / visiblePageCount) * 100}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void next();
        }}
      >
        {/* People never see this; a bot filling every input does. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {anyRequired && (
          <p aria-hidden="true" className="-mt-4 mb-6 text-xs text-muted-foreground">
            <span className="text-exception">*</span> Required
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageIndex}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 gap-x-4 gap-y-7"
          >
            {page.map((field) =>
              visible.has(field.id) ? (
                <motion.div
                  key={field.id}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('min-w-0', field.width === 'half' && isInputField(field) ? 'col-span-2 sm:col-span-1' : 'col-span-2')}
                >
                  <FieldControl
                    field={field}
                    value={answers[field.id]}
                    problem={problems[field.id]}
                    onChange={(value) => set(field, value)}
                  />
                </motion.div>
              ) : null,
            )}
          </motion.div>
        </AnimatePresence>

        {formError && (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-md bg-exception/8 px-3 py-2.5 text-sm font-medium text-exception">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </p>
        )}

        <div className="mt-10 flex items-center gap-3">
          {pageIndex > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="h-12 shrink-0 px-3 sm:h-11"
              onClick={() => {
                const previous = shownPages.slice(0, pageIndex).lastIndexOf(true);
                goTo(previous === -1 ? 0 : previous);
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Button>
          )}
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting || undefined}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-(--form-accent) px-6 text-base font-semibold text-(--form-ink) shadow-sm transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:h-11 sm:min-w-36 sm:flex-none sm:text-sm"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                <span className="sr-only">Sending</span>
              </>
            ) : isLast ? (
              form.submitLabel || 'Submit'
            ) : (
              <>
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

/* 16px on a phone so iOS doesn't zoom into the box; the compact size from sm up. */
const inputClass =
  'w-full rounded-md border border-input bg-control px-3 text-base text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground/25 aria-invalid:border-exception sm:text-sm';

/** The focus ring for every choice: the ink colour, so it shows whatever the accent. */
const choiceFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground';

/** One question: its label, help, control and problem — the help and the problem are both read with the control. */
function FieldControl({
  field,
  value,
  problem,
  onChange,
}: {
  field: FormField;
  value: Answer | undefined;
  problem?: string;
  onChange: (value: Answer | undefined) => void;
}) {
  const id = `field-${field.id}`;
  const describedBy = useId();
  const helpId = `${id}-help`;

  if (field.type === 'heading') {
    return (
      <div className="pt-3">
        <h2 className="text-lg font-semibold tracking-title text-heading">{field.label}</h2>
        {field.description && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{field.description}</p>}
      </div>
    );
  }
  if (field.type === 'paragraph') {
    return <p className="text-base leading-relaxed whitespace-pre-line text-muted-foreground sm:text-sm">{field.label}</p>;
  }

  const hasHelp = Boolean(field.description) && field.type !== 'consent';
  const described = hasHelp ? `${helpId} ${describedBy}` : describedBy;
  const aria = { id, 'aria-invalid': Boolean(problem) || undefined, 'aria-describedby': described } as const;
  /** A set of buttons answers it: the group is named by the question and carries its help, problem and state. */
  const group = (role: 'radiogroup' | 'group') =>
    ({
      role,
      id,
      tabIndex: -1,
      'aria-labelledby': `${id}-label`,
      'aria-describedby': described,
      'aria-invalid': Boolean(problem) || undefined,
    }) as const;
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const grouped = ['radio', 'checkboxes', 'yes_no', 'rating', 'scale'].includes(field.type);

  const control = (() => {
    switch (field.type) {
      case 'long_text':
        return (
          <textarea
            {...aria}
            value={text}
            rows={4}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={cn(inputClass, 'min-h-28 py-2.5 leading-relaxed')}
          />
        );
      case 'select':
        return (
          <select
            {...aria}
            value={text}
            onChange={(event) => onChange(event.target.value || undefined)}
            className={cn(inputClass, 'h-12 appearance-auto sm:h-11')}
          >
            <option value="">{field.placeholder || 'Choose…'}</option>
            {(field.options ?? []).map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        );
      case 'radio':
      case 'checkboxes': {
        const multiple = field.type === 'checkboxes';
        const chosen = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
        return (
          <div {...group(multiple ? 'group' : 'radiogroup')} className="grid gap-2 outline-none sm:grid-cols-2">
            {(field.options ?? []).map((option) => {
              const on = chosen.includes(option.label);
              return (
                <button
                  key={option.id}
                  type="button"
                  role={multiple ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  onClick={() =>
                    onChange(
                      multiple
                        ? on
                          ? chosen.filter((entry) => entry !== option.label)
                          : [...chosen, option.label]
                        : on
                          ? undefined
                          : option.label,
                    )
                  }
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-base text-foreground transition-colors sm:min-h-11 sm:text-sm',
                    choiceFocus,
                    on ? 'border-(--form-accent) bg-(--form-accent)/8 font-medium' : 'border-input bg-control hover:bg-band/50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center border transition-colors',
                      multiple ? 'rounded-[5px]' : 'rounded-full',
                      on ? 'border-(--form-accent) bg-(--form-accent) text-(--form-ink)' : 'border-rule bg-background',
                    )}
                  >
                    {on &&
                      (multiple ? (
                        <Check size={13} strokeWidth={3} aria-hidden="true" />
                      ) : (
                        <span className="size-2 rounded-full bg-(--form-ink)" />
                      ))}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        );
      }
      case 'yes_no':
        return (
          <div {...group('radiogroup')} className="grid grid-cols-2 gap-2 outline-none sm:flex">
            {[
              { label: 'Yes', on: value === true },
              { label: 'No', on: value === false },
            ].map((choice) => (
              <button
                key={choice.label}
                type="button"
                role="radio"
                aria-checked={choice.on}
                onClick={() => onChange(choice.on ? undefined : choice.label === 'Yes')}
                className={cn(
                  'h-12 rounded-md border px-5 text-base font-medium transition-colors sm:h-11 sm:min-w-28 sm:text-sm',
                  choiceFocus,
                  choice.on
                    ? 'border-(--form-accent) bg-(--form-accent) text-(--form-ink)'
                    : 'border-input bg-control text-foreground hover:bg-band/50',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        );
      case 'consent':
        return (
          <label
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border bg-control px-3.5 py-3 text-base sm:text-sm',
              problem ? 'border-exception' : 'border-input',
            )}
          >
            <input
              {...aria}
              type="checkbox"
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-(--form-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            />
            <span className="leading-relaxed text-foreground">
              {field.label}
              {field.required && <RequiredMark />}
            </span>
          </label>
        );
      case 'rating': {
        const max = ratingMax(field);
        const current = typeof value === 'number' ? value : 0;
        return (
          <div {...group('radiogroup')} className="-ml-1.5 flex flex-wrap outline-none">
            {Array.from({ length: max }, (_, index) => index + 1).map((score) => (
              <button
                key={score}
                type="button"
                role="radio"
                aria-checked={current === score}
                aria-label={`${score} of ${max}`}
                onClick={() => onChange(current === score ? undefined : score)}
                className={cn(
                  'flex size-11 items-center justify-center rounded-md transition-[color,transform] hover:scale-110',
                  choiceFocus,
                  score <= current ? 'text-(--form-accent)' : 'text-muted-foreground',
                )}
              >
                <Star size={28} className={score <= current ? '[&_path]:fill-current' : undefined} aria-hidden="true" />
              </button>
            ))}
          </div>
        );
      }
      case 'scale': {
        const { min, max } = scaleRange(field);
        const points = Array.from({ length: max - min + 1 }, (_, index) => min + index);
        return (
          <div>
            {/* Wraps to a second line on a phone rather than shrinking the buttons below a thumb. */}
            <div {...group('radiogroup')} className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1.5 outline-none">
              {points.map((score) => (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={value === score}
                  onClick={() => onChange(value === score ? undefined : score)}
                  className={cn(
                    'h-12 min-w-0 rounded-md border text-base font-medium tabular-nums transition-colors sm:h-11 sm:text-sm',
                    choiceFocus,
                    value === score
                      ? 'border-(--form-accent) bg-(--form-accent) text-(--form-ink)'
                      : 'border-input bg-control text-foreground hover:bg-band/50',
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            {(field.minLabel || field.maxLabel) && (
              <div className="mt-2 flex justify-between gap-4 text-xs text-muted-foreground">
                <span>{field.minLabel}</span>
                <span className="text-right">{field.maxLabel}</span>
              </div>
            )}
          </div>
        );
      }
      default: {
        const type =
          field.type === 'email'
            ? 'email'
            : field.type === 'phone'
              ? 'tel'
              : field.type === 'number'
                ? 'number'
                : field.type === 'url'
                  ? 'url'
                  : field.type === 'date'
                    ? 'date'
                    : field.type === 'time'
                      ? 'time'
                      : 'text';
        const autoComplete =
          field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : /name/i.test(field.key) ? 'name' : undefined;
        return (
          <input
            {...aria}
            type={type}
            value={text}
            inputMode={field.type === 'number' ? 'decimal' : undefined}
            min={field.type === 'number' ? (field.min ?? undefined) : undefined}
            max={field.type === 'number' ? (field.max ?? undefined) : undefined}
            autoComplete={autoComplete}
            placeholder={field.placeholder}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(field.type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw);
            }}
            className={cn(inputClass, 'h-12 sm:h-11')}
          />
        );
      }
    }
  })();

  const Title = grouped ? 'p' : 'label';
  return (
    <div>
      {field.type !== 'consent' && (
        <Title
          id={`${id}-label`}
          {...(grouped ? {} : { htmlFor: id })}
          className="block text-base font-semibold text-foreground sm:text-sm"
        >
          {field.label}
          {field.required && <RequiredMark />}
        </Title>
      )}
      {hasHelp && (
        <p id={helpId} className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted-foreground sm:text-xs">
          {field.description}
        </p>
      )}
      <div className="mt-2.5">{control}</div>
      <p
        id={describedBy}
        role={problem ? 'alert' : undefined}
        className={cn('flex items-start gap-1.5 text-sm font-medium text-exception', problem ? 'mt-2' : 'sr-only')}
      >
        {problem && <CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />}
        {problem ?? ''}
      </p>
    </div>
  );
}

/** A red asterisk you see, "required" you hear. */
function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="text-exception">
        {' '}
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
