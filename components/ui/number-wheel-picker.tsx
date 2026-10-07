'use client';

import { ListChecks } from '@/components/icons';

import { rangeValues } from '@/lib/utils/duration';

import { numberOptions, WheelField } from './wheel-field';
import { WheelPicker } from './wheel-picker';

export interface NumberWheelPickerProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown after the number, e.g. "min" — or a function for singular/plural. */
  unit?: string | ((value: number) => string);
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * One wheel over a short, bounded range — a slot interval, a booking window,
 * a minimum headcount. For big or free numbers keep `NumberStepper` or a plain
 * input: a wheel is for choosing among a few dozen nearby values, not typing.
 */
export function NumberWheelPicker({ value, onValueChange, min, max, step = 1, unit, 'aria-label': ariaLabel, ...field }: NumberWheelPickerProps) {
  const unitFor = (amount: number) => (typeof unit === 'function' ? unit(amount) : (unit ?? ''));
  const read = (amount: number) => [amount, unitFor(amount)].filter((part) => part !== '').join(' ');
  const safe = Number.isFinite(value) ? value : min;

  return (
    <WheelField {...field} required icon={ListChecks} display={read(safe)} aria-label={ariaLabel ?? field.label} wheelsClassName="w-36" summary={read(safe)}>
      <WheelPicker options={numberOptions(rangeValues(min, max, step, safe), read)} value={safe} onValueChange={onValueChange} />
    </WheelField>
  );
}
