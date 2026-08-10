import * as React from 'react';

import { cn } from '@/lib/utils';

import { DatePicker } from './date-picker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputProps extends React.ComponentProps<'input'> {
  label?: string;
  hint?: string; // helper text below the input
  error?: string; // error message — replaces hint, turns input red
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rightAction?: React.ReactNode; // clickable element (button, toggle, etc.)
}

// ─── Component ────────────────────────────────────────────────────────────────

function Input({ className, type, label, hint, error, leftIcon, rightIcon, rightAction, id, ...props }: InputProps) {
  // Labels repeat frequently in drawers and editable table rows. Deriving IDs
  // from the label made those controls share an ID, so each instance gets a
  // stable React ID unless the caller supplies one explicitly.
  const generatedId = React.useId();
  const inputId = id ?? `input-${generatedId}`;

  if (type === 'date') {
    return (
      <DatePicker
        id={inputId}
        name={props.name}
        label={label}
        hint={hint}
        error={error}
        value={String(props.value ?? '')}
        onValueChange={(value) => props.onChange?.({ target: { value }, currentTarget: { value } } as React.ChangeEvent<HTMLInputElement>)}
        min={typeof props.min === 'string' ? props.min : undefined}
        max={typeof props.max === 'string' ? props.max : undefined}
        required={props.required}
        disabled={props.disabled}
        autoFocus={props.autoFocus}
        aria-label={props['aria-label']}
        className={className}
      />
    );
  }

  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon || rightAction);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label */}
      {label && (
        <label htmlFor={inputId} className="block text-label uppercase text-muted-foreground">
          {label}
          {props.required && (
            <span className="ml-1 text-exception" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative flex items-center">
        {/* Left icon */}
        {hasLeft && (
          <span className={cn('pointer-events-none absolute left-3 flex items-center text-muted-foreground', error && 'text-destructive')}>
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          type={type}
          data-slot="input"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            // A field on a plot: the hairline is the control, not decoration —
            // an input sits on the field or straight on the page, and the fill
            // alone cannot carry both. The rule clears 3:1 on every surface.
            // Keep focused fields at 16px on small screens so iOS does not zoom
            // the entire interface; the established 14px density resumes at sm.
            'w-full h-10 bg-field border border-input rounded-md text-base sm:text-sm text-foreground shadow-sm',
            'placeholder:text-muted-foreground outline-none',
            'transition-[border-color,outline-color,box-shadow] duration-150',
            // Focus is the crosshair marker: a hard amber outline, no soft glow.
            'focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
            // Error state
            error && 'border-exception focus:border-exception focus:outline-exception',
            // Dynamic horizontal padding based on icons
            hasLeft ? 'pl-9' : 'pl-3',
            hasRight ? 'pr-10' : 'pr-3',
            // Disabled
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />

        {/* Right icon (static, decorative) */}
        {rightIcon && !rightAction && (
          <span className={cn('pointer-events-none absolute right-3 flex items-center text-muted-foreground', error && 'text-destructive')}>
            {rightIcon}
          </span>
        )}

        {/* Right action (interactive — button, eye toggle, clear, etc.) */}
        {rightAction && <span className="absolute right-2 flex items-center">{rightAction}</span>}
      </div>

      {/* Hint / error message */}
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-exception">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { Input };
export type { InputProps };
