import * as React from 'react';
import { cn } from '@/lib/utils';

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
  // Auto-generate an id from the label if none is passed — ensures label is
  // always associated with the input for accessibility even without an explicit id.
  const inputId = id ?? (label ? label.toLowerCase().replaceAll(/\s+/g, '-') : undefined);

  const hasLeft = Boolean(leftIcon);
  const hasRight = Boolean(rightIcon || rightAction);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label */}
      {label && (
        <label htmlFor={inputId} className="block text-xs font-bold text-muted-foreground tracking-widest">
          {label}
          {props.required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
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
            // Base
            'w-full h-9 bg-surface-offset border border-transparent rounded-lg text-sm text-foreground',
            'placeholder:text-muted-foreground outline-none',
            'transition-[border-color,box-shadow] duration-150',
            // Focus
            'focus:border-primary focus:ring-2 focus:ring-primary/15',
            // Error state
            error && 'border-destructive/60 focus:border-destructive focus:ring-destructive/15',
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
        <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
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
