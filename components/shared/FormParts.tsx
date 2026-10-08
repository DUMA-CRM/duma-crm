'use client';

import { type IconComponent, Loader2, Minus, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/* Small form parts shared by the back office's modals and edit states. */

/**
 * A drawer section in the settings style: icon tile, title, a line of why, then
 * the fields on a panel. Edit details, the supplier and stock-item drawers.
 */
export function FormSection({ icon: Icon, title, note, children }: { icon: IconComponent; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{note}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-3 rounded-lg border border-rule/60 bg-field p-4">{children}</div>
    </section>
  );
}

/** A short set of choices as cards — the payroll drawer's period picker. */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: T;
  onChange: (value: T) => void;
  /** `icon`: a glyph before the label, for choices that read faster as pictures (how someone paid). */
  options: { value: T; label: string; icon?: IconComponent }[];
  /** 3 for a set of three, so it doesn't leave one card alone on a second line. */
  columns?: 2 | 3 | 4;
}) {
  return (
    <div className={cn('grid gap-2', columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors',
            value === option.value
              ? 'border-primary bg-primary/5 font-semibold text-foreground'
              : 'border-rule/60 bg-background/60 font-medium text-foreground hover:bg-band/40',
          )}
        >
          {option.icon && (
            <option.icon size={15} className={cn('shrink-0', value === option.value ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
          )}
          <span className="min-w-0">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A number set with − and + around it — for half-day allowances and contracted
 * hours, where the next value is usually one step away and a bare number input
 * hides its own arrows. The field itself still takes typing.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label: string;
}) {
  const clamp = (next: number) => Math.min(max ?? Infinity, Math.max(min, Math.round(next / step) * step));
  return (
    <div className="flex h-11 items-stretch overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
        aria-label={`Less ${label.toLowerCase()}`}
        className="flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:opacity-40"
      >
        <Minus size={16} />
      </button>
      <label className="flex flex-1 items-center justify-center gap-1 border-x border-rule/60">
        <span className="sr-only">{label}</span>
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          onBlur={() => onChange(clamp(value || 0))}
          className="w-16 bg-transparent text-center text-base font-semibold text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </label>
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        disabled={max !== undefined && value >= max}
        aria-label={`More ${label.toLowerCase()}`}
        className="flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-band hover:text-foreground disabled:opacity-40"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

/** The record's modal footer: Cancel and the action, equal width, as the payroll drawer has them. */
export function ModalActions({
  form,
  submitLabel,
  pending,
  pendingLabel,
  disabled,
  onCancel,
}: {
  /** The id of the `<form>` the submit button belongs to — the footer sits outside it. */
  form: string;
  submitLabel: string;
  pending: boolean;
  pendingLabel?: string;
  disabled?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" form={form} size="lg" className="flex-1" disabled={disabled || pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {pending ? (pendingLabel ?? submitLabel) : submitLabel}
      </Button>
    </div>
  );
}
